"""Tests for case persistence and the case endpoints.

The point of a Case is that it outlives the request. These tests check that it
actually does, and that the awkward paths - denied location permission, a
corrupt store, a reported case near its deadline - behave sanely.
"""
from __future__ import annotations

import io
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from api.config import settings
from api.main import app
from api.models.schemas import CaseState, ClaimStatus, EventReport, EventType
from api.rules.engine import IST, evaluate
from api.rules.loader import load_rules
from api.services import cases as store

RULES = load_rules()
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_store():
    """Every test starts with an empty store."""
    path = settings.data_dir / "cases.json"
    if path.exists():
        path.unlink()
    yield
    if path.exists():
        path.unlink()


def make_hail_case():
    event = EventReport(
        event_type=EventType.HAILSTORM,
        event_datetime=datetime.now(IST) - timedelta(hours=24),
        crop="cotton",
        area_acres=1.5,
        has_pmfby_policy=True,
    )
    claim = next(c for c in evaluate(event, RULES) if c.rule_id == "PMFBY_LOCALISED")
    return store.create_case(event, claim)


# --- persistence -------------------------------------------------------------

def test_case_survives_a_reload():
    """The whole reason this class exists."""
    case_id = make_hail_case().case_id
    assert store.get_case(case_id) is not None


def test_case_gets_steps_from_the_checklist():
    case = make_hail_case()
    assert len(case.steps) >= 5
    assert all(step.step_id for step in case.steps)


def test_photo_steps_are_identified():
    case = make_hail_case()
    assert any(step.needs_photo for step in case.steps)


def test_unknown_case_returns_none_not_an_exception():
    assert store.get_case("c_nope") is None


def test_corrupt_store_is_moved_aside_not_fatal():
    """A corrupt file must not take down the app mid-demo."""
    path = settings.data_dir / "cases.json"
    path.write_text("{ this is not json", encoding="utf-8")
    assert store.list_cases() == []
    assert path.with_suffix(".corrupt.json").exists()
    path.with_suffix(".corrupt.json").unlink()


# --- ordering ----------------------------------------------------------------

def test_urgent_cases_sort_above_relaxed_ones():
    urgent_event = EventReport(
        event_type=EventType.HAILSTORM,
        event_datetime=datetime.now(IST) - timedelta(hours=66),  # ~6h left
        has_pmfby_policy=True,
    )
    urgent_claim = next(
        c for c in evaluate(urgent_event, RULES) if c.rule_id == "PMFBY_LOCALISED"
    )
    store.create_case(urgent_event, urgent_claim)
    make_hail_case()  # ~48h left

    ordered = store.list_cases()
    assert ordered[0].claim.status is ClaimStatus.CLOSING_SOON


# --- step updates ------------------------------------------------------------

def test_marking_a_step_done_persists():
    case = make_hail_case()
    step_id = case.steps[0].step_id
    updated = store.set_step_done(case.case_id, step_id, True)
    assert updated.steps[0].done is True
    assert store.get_case(case.case_id).steps[0].done is True


def test_unknown_step_returns_none():
    case = make_hail_case()
    assert store.set_step_done(case.case_id, "s999", True) is None


# --- photos ------------------------------------------------------------------

def test_photo_with_coordinates_is_marked_verified():
    case = make_hail_case()
    photo = store.attach_photo(
        case.case_id, b"fakejpeg", 15.1394, 76.9214, 8.0, None, case.steps[0].step_id
    )
    assert photo.location_verified is True
    assert store.get_case(case.case_id).steps[0].done is True


def test_photo_without_coordinates_is_still_stored_but_unverified():
    """Denied location permission must not lose the photo - and must not let us
    claim the location was verified."""
    case = make_hail_case()
    photo = store.attach_photo(case.case_id, b"fakejpeg", None, None, None, None)
    assert photo is not None
    assert photo.location_verified is False


def test_photo_on_unknown_case_returns_none():
    assert store.attach_photo("c_nope", b"x", None, None, None, None) is None


# --- state machine -----------------------------------------------------------

def test_expired_claim_marks_the_case_expired():
    event = EventReport(
        event_type=EventType.HAILSTORM,
        event_datetime=datetime.now(IST) - timedelta(hours=100),
        has_pmfby_policy=True,
    )
    claim = next(c for c in evaluate(event, RULES) if c.rule_id == "PMFBY_LOCALISED")
    case = store.create_case(event, claim)
    assert case.state is CaseState.EXPIRED


def test_a_reported_case_does_not_revert_to_expired():
    """Once the user has filed, the deadline passing is not a failure."""
    case = make_hail_case()
    store.advance_state(case.case_id, CaseState.REPORTED)

    stale = store.get_case(case.case_id)
    stale.event.event_datetime = datetime.now(IST) - timedelta(hours=200)
    store.save_case(stale)

    refreshed = store.recompute(store.get_case(case.case_id))
    assert refreshed.state is CaseState.REPORTED


def test_recompute_refreshes_hours_remaining():
    case = make_hail_case()
    raw = json.loads((settings.data_dir / "cases.json").read_text(encoding="utf-8"))
    raw[case.case_id]["claim"]["hours_remaining"] = 999.0
    (settings.data_dir / "cases.json").write_text(json.dumps(raw, default=str), encoding="utf-8")

    assert store.recompute(store.get_case(case.case_id)).claim.hours_remaining < 100


# --- endpoints ---------------------------------------------------------------

def test_get_cases_endpoint_returns_a_list():
    make_hail_case()
    response = client.get("/api/cases")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_case_detail_endpoint():
    case = make_hail_case()
    response = client.get(f"/api/cases/{case.case_id}")
    assert response.status_code == 200
    assert response.json()["rule_id"] == "PMFBY_LOCALISED"


def test_missing_case_returns_404():
    assert client.get("/api/cases/c_nope").status_code == 404


def test_patch_step_endpoint():
    case = make_hail_case()
    step_id = case.steps[0].step_id
    response = client.patch(
        f"/api/cases/{case.case_id}/steps/{step_id}", json={"done": True}
    )
    assert response.status_code == 200
    assert response.json()["steps"][0]["done"] is True


def test_photo_upload_endpoint_accepts_missing_coordinates():
    case = make_hail_case()
    response = client.post(
        f"/api/cases/{case.case_id}/photo",
        files={"image": ("shot.jpg", io.BytesIO(b"fakejpeg"), "image/jpeg")},
        data={"step_id": case.steps[0].step_id},
    )
    assert response.status_code == 200
    assert response.json()["location_verified"] is False


def test_photo_upload_endpoint_with_coordinates():
    case = make_hail_case()
    response = client.post(
        f"/api/cases/{case.case_id}/photo",
        files={"image": ("shot.jpg", io.BytesIO(b"fakejpeg"), "image/jpeg")},
        data={"lat": "15.1394", "lon": "76.9214", "accuracy_m": "8.0"},
    )
    assert response.json()["location_verified"] is True


def test_photo_can_be_fetched_back():
    case = make_hail_case()
    photo = store.attach_photo(case.case_id, b"fakejpeg", None, None, None, None)
    response = client.get(f"/api/cases/{case.case_id}/photo/{photo.photo_id}")
    assert response.status_code == 200
    assert response.content == b"fakejpeg"


def test_intake_creates_a_case_and_returns_its_id():
    """End to end: audio in, a persisted case out."""
    response = client.post(
        "/api/intake",
        files={"audio": ("clip.webm", io.BytesIO(b"fake"), "audio/webm")},
    )
    assert response.status_code == 200
    case_id = response.json()["case_id"]
    assert case_id
    assert store.get_case(case_id) is not None


# --- language support ---------------------------------------------------------

def test_intake_defaults_to_kannada():
    body = client.post(
        "/api/intake",
        files={"audio": ("c.webm", io.BytesIO(b"x"), "audio/webm")},
    ).json()
    assert body["lang"] == "kn"
    assert body["claims"][0]["evidence_checklist"]


def test_intake_in_english_returns_english_content():
    """A judge who does not speak Kannada must be able to use the app."""
    body = client.post(
        "/api/intake",
        files={"audio": ("c.webm", io.BytesIO(b"x"), "audio/webm")},
        data={"lang": "en"},
    ).json()
    assert body["lang"] == "en"
    claim = body["claims"][0]
    assert claim["lang"] == "en"
    # English checklist, and it is genuinely different from the Kannada one.
    assert claim["evidence_checklist"] != claim["evidence_checklist_kn"]
    assert any("Photograph" in step for step in claim["evidence_checklist"])


def test_kannada_fields_stay_kannada_even_in_english_mode():
    """The _kn fields are a stable contract - they never hold English."""
    body = client.post(
        "/api/intake",
        files={"audio": ("c.webm", io.BytesIO(b"x"), "audio/webm")},
        data={"lang": "en"},
    ).json()
    assert body["claims"][0]["evidence_checklist_kn"]
    assert "Photograph" not in " ".join(body["claims"][0]["evidence_checklist_kn"])


def test_unsupported_language_falls_back_to_kannada():
    body = client.post(
        "/api/intake",
        files={"audio": ("c.webm", io.BytesIO(b"x"), "audio/webm")},
        data={"lang": "fr"},
    ).json()
    assert body["lang"] == "kn"


def test_every_rule_has_english_content():
    """Missing English would give a judge a blank checklist."""
    for rule in RULES:
        assert rule.get("evidence_checklist_en"), f"{rule['rule_id']} has no English checklist"
        assert rule.get("failure_consequence_en"), f"{rule['rule_id']} has no English consequence"
