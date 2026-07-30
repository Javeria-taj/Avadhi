"""Tests for onboarding: document scanning, profile persistence, and prefill.

The rule under test throughout: nothing the model read from a photograph is used
until the person confirms it, and an unconfirmed field is never written.
"""
from __future__ import annotations

import io
import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from api.config import settings
from api.main import app
from api.models.schemas import (
    DocumentKind,
    EventReport,
    EventType,
    FieldConfidence,
    Profile,
    ScanResult,
)
from api.rules.engine import IST
from api.services import profile as store
from api.services.document_scan import CONFIRM_THRESHOLD, scan_document

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_profile():
    store.reset_profile()
    yield
    store.reset_profile()


# --- first run should never look like an error --------------------------------

def test_first_run_returns_an_empty_profile_not_a_404():
    response = client.get("/api/profile")
    assert response.status_code == 200
    assert response.json()["pmfby_policy_number"]["value"] is None
    assert store.get_profile().completeness() == 0.0


def test_completeness_endpoint_works_on_first_run():
    """Drives the quiet nudge on the home screen."""
    body = client.get("/api/profile/completeness").json()
    assert body["completeness"] == 0.0
    assert body["scanned_documents"] == []
    assert body["account_last4"] is None


def test_completeness_starts_at_zero_and_rises():
    assert store.get_profile().completeness() == 0.0
    profile = store.get_profile()
    profile.mobile = "9876543210"
    profile.district = "Ballari"
    store.save_profile(profile)
    assert store.get_profile().completeness() > 0.0


# --- scanning proposes, it does not save --------------------------------------

def test_scanning_a_certificate_returns_fields():
    result = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    assert "pmfby_policy_number" in result.fields
    assert result.fields["crop"].value == "Cotton"


def test_scanned_fields_start_unconfirmed():
    result = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    assert all(not field.confirmed for field in result.fields.values())


def test_low_confidence_fields_are_flagged_for_confirmation():
    """A policy number read at 0.72 must be shown large and confirmed, never
    quietly accepted - a wrong number produces a wrong intimation."""
    result = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    assert "pmfby_policy_number" in result.needs_confirmation
    assert result.fields["pmfby_policy_number"].confidence < CONFIRM_THRESHOLD


def test_scanning_does_not_write_to_the_profile():
    scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    assert store.get_profile().pmfby_policy_number.value is None


def test_scan_endpoint_saves_nothing():
    response = client.post(
        "/api/profile/scan",
        files={"image": ("cert.jpg", io.BytesIO(b"fakejpeg"), "image/jpeg")},
        data={"kind": "pmfby_certificate"},
    )
    assert response.status_code == 200
    assert client.get("/api/profile").json()["pmfby_policy_number"]["value"] is None


# --- confirmation is what persists -------------------------------------------

def test_confirming_writes_the_field_as_confirmed():
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    profile = store.apply_scan(scan, {"pmfby_policy_number": "PMFBY/KA/2026/8841"})
    assert profile.pmfby_policy_number.value == "PMFBY/KA/2026/8841"
    assert profile.pmfby_policy_number.confirmed is True


def test_an_unconfirmed_field_is_never_written():
    """Only what the person approved gets saved, not everything the model read."""
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    profile = store.apply_scan(scan, {"pmfby_policy_number": "PMFBY/KA/2026/8841"})
    assert profile.insurer.value is None


def test_the_person_can_correct_what_the_model_read():
    """The value that persists is what the human typed or approved on screen."""
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    profile = store.apply_scan(scan, {"pmfby_policy_number": "PMFBY/KA/2026/9999"})
    assert profile.pmfby_policy_number.value == "PMFBY/KA/2026/9999"


def test_confirming_a_policy_sets_has_pmfby_policy():
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    profile = store.apply_scan(scan, {"pmfby_policy_number": "X/1"})
    assert profile.has_pmfby_policy is True


def test_confirming_an_account_sets_has_bank_account():
    scan = scan_document(b"fakejpeg", DocumentKind.BANK_PASSBOOK)
    profile = store.apply_scan(scan, {"bank_account_number": "50100234567890"})
    assert profile.has_bank_account is True
    assert profile.account_last4() == "7890"


def test_survey_numbers_accumulate_without_duplicates():
    scan = scan_document(b"fakejpeg", DocumentKind.LAND_RECORD)
    store.apply_scan(scan, {"survey_numbers": "142/3, 142/4"})
    profile = store.apply_scan(scan, {"survey_numbers": "142/4, 142/5"})
    assert profile.survey_numbers == ["142/3", "142/4", "142/5"]


def test_unparseable_land_acres_is_ignored_not_fatal():
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    profile = store.apply_scan(scan, {"land_acres": "about two"})
    assert profile.land_acres is None


def test_confirm_endpoint_persists():
    response = client.post(
        "/api/profile/confirm",
        data={
            "kind": "pmfby_certificate",
            "fields": json.dumps({"pmfby_policy_number": "PMFBY/KA/2026/8841"}),
        },
    )
    assert response.status_code == 200
    assert client.get("/api/profile").json()["pmfby_policy_number"]["confirmed"] is True


def test_confirm_endpoint_rejects_malformed_fields():
    response = client.post(
        "/api/profile/confirm",
        data={"kind": "pmfby_certificate", "fields": "not json"},
    )
    assert response.status_code == 422


# --- profile survives, and speeds up the next report -------------------------

def test_profile_survives_a_reload():
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    store.apply_scan(scan, {"pmfby_policy_number": "PMFBY/KA/2026/8841"})
    assert store.get_profile().pmfby_policy_number.value == "PMFBY/KA/2026/8841"


def test_prefill_fills_what_the_speech_left_out():
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    store.apply_scan(scan, {"pmfby_policy_number": "PMFBY/KA/2026/8841",
                            "crop": "Cotton", "land_acres": "1.5"})

    event = EventReport(
        event_type=EventType.HAILSTORM,
        event_datetime=datetime.now(IST) - timedelta(hours=24),
    )
    filled = store.prefill_event(event)
    assert filled.has_pmfby_policy is True
    assert filled.policy_number == "PMFBY/KA/2026/8841"
    assert filled.crop == "Cotton"


def test_what_the_person_just_said_beats_what_we_remembered():
    """Prefill must never overwrite the current report. If he says two acres
    today, it is two acres today."""
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    store.apply_scan(scan, {"crop": "Cotton", "land_acres": "1.5"})

    event = EventReport(
        event_type=EventType.HAILSTORM,
        crop="maize",
        area_acres=2.0,
    )
    filled = store.prefill_event(event)
    assert filled.crop == "maize"
    assert filled.area_acres == 2.0


def test_prefill_turns_a_need_info_claim_into_an_actionable_one():
    """The point of onboarding: the second report does not have to ask again."""
    from api.rules.engine import evaluate
    from api.rules.loader import load_rules

    rules = load_rules()
    event = EventReport(
        event_type=EventType.HAILSTORM,
        event_datetime=datetime.now(IST) - timedelta(hours=24),
    )
    before = next(c for c in evaluate(event, rules) if c.rule_id == "PMFBY_LOCALISED")
    assert before.status.value == "need_info"

    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    store.apply_scan(scan, {"pmfby_policy_number": "PMFBY/KA/2026/8841"})

    after = next(
        c for c in evaluate(store.prefill_event(EventReport(
            event_type=EventType.HAILSTORM,
            event_datetime=datetime.now(IST) - timedelta(hours=24),
        )), rules)
        if c.rule_id == "PMFBY_LOCALISED"
    )
    assert after.status.value == "open"


# --- privacy ------------------------------------------------------------------

def test_profile_has_no_aadhaar_field():
    """Deliberate. Not needed to intimate a claim; storing it is pure liability."""
    assert not any("aadhaar" in name.lower() for name in Profile.model_fields)


def test_passbook_prompt_forbids_reading_aadhaar():
    from api.services.document_scan import _PROMPTS

    assert "Aadhaar" in _PROMPTS[DocumentKind.BANK_PASSBOOK]


def test_reset_clears_everything():
    scan = scan_document(b"fakejpeg", DocumentKind.PMFBY_CERTIFICATE)
    store.apply_scan(scan, {"pmfby_policy_number": "X/1"})
    assert client.post("/api/profile/reset").status_code == 200
    assert store.get_profile().pmfby_policy_number.value is None
