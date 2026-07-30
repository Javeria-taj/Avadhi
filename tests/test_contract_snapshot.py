"""Guards against contract drift between backend and frontend.

ui/lib/contract-snapshot.json is generated from real API responses and imported
by the frontend. If the backend schema changes and the snapshot is not
regenerated, the frontend silently builds against a stale shape - and you find
out at integration, which is the worst possible time.

These tests fail loudly instead. Fix by running:

    python scripts/snapshot_contract.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from api.models.schemas import Case, ClaimWindow, IntakeResponse, Profile, ScanResult

SNAPSHOT = Path(__file__).resolve().parents[1] / "ui" / "lib" / "contract-snapshot.json"

REGENERATE = "Stale snapshot. Run: python scripts/snapshot_contract.py"


@pytest.fixture(scope="module")
def snapshot() -> dict:
    if not SNAPSHOT.exists():
        pytest.fail(f"{SNAPSHOT} is missing. {REGENERATE}")
    return json.loads(SNAPSHOT.read_text(encoding="utf-8"))


def test_snapshot_covers_every_endpoint_the_ui_calls(snapshot):
    for key in (
        "GET /api/cases",
        "GET /api/cases/{id}",
        "POST /api/intake (kn)",
        "POST /api/intake (en)",
        "GET /api/profile (first run)",
        "GET /api/profile/completeness (first run)",
        "POST /api/profile/scan (pmfby_certificate)",
        "GET /health",
    ):
        assert key in snapshot, f"{key} missing from snapshot. {REGENERATE}"


def test_case_shapes_still_validate(snapshot):
    """Every snapshotted case must still parse as the current Case model."""
    for raw in snapshot["GET /api/cases"]:
        Case(**raw)
    Case(**snapshot["GET /api/cases/{id}"])


def test_intake_shapes_still_validate(snapshot):
    IntakeResponse(**snapshot["POST /api/intake (kn)"])
    IntakeResponse(**snapshot["POST /api/intake (en)"])


def test_profile_and_scan_shapes_still_validate(snapshot):
    Profile(**snapshot["GET /api/profile (first run)"])
    Profile(**snapshot["POST /api/profile/confirm"])
    ScanResult(**snapshot["POST /api/profile/scan (pmfby_certificate)"])


def test_ui_gets_an_example_of_every_case_status(snapshot):
    """The UI renders differently per status. Missing one means an untested screen."""
    statuses = {case["claim"]["status"] for case in snapshot["GET /api/cases"]}
    assert {"open", "closing_soon", "expired"} <= statuses, REGENERATE


def test_ui_gets_both_verticals(snapshot):
    rule_ids = {case["rule_id"] for case in snapshot["GET /api/cases"]}
    assert {"PMFBY_LOCALISED", "RBI_UNAUTH_TXN"} <= rule_ids, REGENERATE


def test_english_intake_really_returns_english(snapshot):
    claim = snapshot["POST /api/intake (en)"]["claims"][0]
    assert claim["lang"] == "en"
    assert claim["evidence_checklist"] != claim["evidence_checklist_kn"]


def test_snapshot_has_an_in_progress_case_with_a_photo(snapshot):
    """The UI needs the shape of a ticked step and an attached photo."""
    case = snapshot["GET /api/cases/{id} (in progress)"]
    assert any(step["done"] for step in case["steps"])
    assert case["photos"]
    assert case["photos"][0]["location_verified"] is True


def test_snapshot_documents_the_404_shape(snapshot):
    error = snapshot["GET /api/cases/{id} (404)"]
    assert error["status"] == 404
    assert "detail" in error["body"]


def test_every_claim_carries_its_source_citation(snapshot):
    """Visible in the UI footer. A judge will ask."""
    for raw in snapshot["GET /api/cases"]:
        claim = ClaimWindow(**raw["claim"])
        assert claim.source_url
        assert claim.verified_on
