"""Tests for the deterministic engine.

Run: pytest -q

If these pass, the part of the system that decides someone's claim window is
correct. Everything else is presentation. Run these before wiring the UI, and
run them again before the demo.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from api.models.schemas import ClaimStatus, EventReport, EventType
from api.rules.engine import IST, evaluate
from api.rules.loader import load_rules, resolve_relative_datetime

RULES = load_rules()

# Pinned clock. Never let tests depend on the real time of day.
NOW = datetime(2026, 7, 30, 12, 0, 0, tzinfo=IST)


def hail_event(**overrides) -> EventReport:
    base = dict(
        event_type=EventType.HAILSTORM,
        event_datetime=NOW - timedelta(hours=24),
        crop="cotton",
        area_acres=1.5,
        has_pmfby_policy=True,
    )
    base.update(overrides)
    return EventReport(**base)


def _find(claims, rule_id):
    return next((c for c in claims if c.rule_id == rule_id), None)


# --- the demo path -----------------------------------------------------------

def test_hailstorm_24h_ago_is_open_with_48h_left():
    claims = evaluate(hail_event(), RULES, now=NOW)
    claim = _find(claims, "PMFBY_LOCALISED")
    assert claim is not None
    assert claim.status is ClaimStatus.OPEN
    assert claim.hours_remaining == pytest.approx(48.0, abs=0.1)


def test_open_claim_carries_its_source_citation():
    """A rule without a citation is an assertion. Judges will ask."""
    claim = _find(evaluate(hail_event(), RULES, now=NOW), "PMFBY_LOCALISED")
    assert claim.source_url
    assert claim.verified_on


def test_evidence_checklist_is_populated():
    claim = _find(evaluate(hail_event(), RULES, now=NOW), "PMFBY_LOCALISED")
    assert len(claim.evidence_checklist_kn) >= 5


# --- window boundaries -------------------------------------------------------

def test_just_inside_window_is_closing_soon():
    event = hail_event(event_datetime=NOW - timedelta(hours=65))  # 7h left
    claim = _find(evaluate(event, RULES, now=NOW), "PMFBY_LOCALISED")
    assert claim.status is ClaimStatus.CLOSING_SOON


def test_exactly_at_deadline_is_expired():
    event = hail_event(event_datetime=NOW - timedelta(hours=72))
    claim = _find(evaluate(event, RULES, now=NOW), "PMFBY_LOCALISED")
    assert claim.status is ClaimStatus.EXPIRED


def test_past_deadline_is_still_reported_not_hidden():
    """Never silently drop a missed claim. Tell the person the truth."""
    event = hail_event(event_datetime=NOW - timedelta(hours=100))
    claim = _find(evaluate(event, RULES, now=NOW), "PMFBY_LOCALISED")
    assert claim is not None
    assert claim.status is ClaimStatus.EXPIRED
    assert claim.hours_remaining < 0


# --- unknown vs false --------------------------------------------------------

def test_unknown_policy_status_asks_instead_of_refusing():
    event = hail_event(has_pmfby_policy=None)
    claim = _find(evaluate(event, RULES, now=NOW), "PMFBY_LOCALISED")
    assert claim.status is ClaimStatus.NEED_INFO
    assert "has_pmfby_policy" in claim.missing_info


def test_explicit_no_policy_drops_the_scheme_entirely():
    event = hail_event(has_pmfby_policy=False)
    assert _find(evaluate(event, RULES, now=NOW), "PMFBY_LOCALISED") is None


def test_missing_event_time_asks_for_the_date():
    event = hail_event(event_datetime=None)
    claim = _find(evaluate(event, RULES, now=NOW), "PMFBY_LOCALISED")
    assert claim.status is ClaimStatus.NEED_INFO
    assert "event_datetime" in claim.missing_info


# --- the compounding case ----------------------------------------------------

def test_accidental_death_triggers_both_pmsby_and_pmjjby():
    """The insight worth demoing: one event, two clocks, ~4 lakh combined.

    Families routinely claim one and never learn about the other.
    """
    event = EventReport(
        event_type=EventType.ACCIDENTAL_DEATH,
        event_datetime=NOW - timedelta(days=3),
        has_pmsby=True,
        has_pmjjby=True,
        age_at_event=44,
    )
    claims = evaluate(event, RULES, now=NOW)
    ids = {c.rule_id for c in claims}
    assert {"PMSBY_ACCIDENT", "PMJJBY_DEATH"} <= ids
    assert all(c.status is ClaimStatus.OPEN for c in claims)


def test_crop_event_does_not_trigger_insurance_schemes():
    ids = {c.rule_id for c in evaluate(hail_event(), RULES, now=NOW)}
    assert "PMSBY_ACCIDENT" not in ids


# --- ordering ----------------------------------------------------------------

def test_most_urgent_claim_sorts_first():
    event = EventReport(
        event_type=EventType.ACCIDENTAL_DEATH,
        event_datetime=NOW - timedelta(days=29, hours=20),  # ~4h left
        has_pmsby=True,
        has_pmjjby=True,
    )
    claims = evaluate(event, RULES, now=NOW)
    assert claims[0].status is ClaimStatus.CLOSING_SOON


# --- timezone ----------------------------------------------------------------

def test_naive_datetime_is_treated_as_ist_not_utc():
    """A 5.5-hour bug here is invisible in testing and fatal on stage."""
    naive = EventReport(
        event_type=EventType.HAILSTORM,
        event_datetime=datetime(2026, 7, 29, 12, 0, 0),
        has_pmfby_policy=True,
    )
    claim = _find(evaluate(naive, RULES, now=NOW), "PMFBY_LOCALISED")
    assert claim.hours_remaining == pytest.approx(48.0, abs=0.1)


# --- relative dates ----------------------------------------------------------

def test_last_night_resolves_with_reduced_confidence():
    resolved, confidence = resolve_relative_datetime("last night", now=NOW)
    assert resolved is not None
    assert 0 < confidence < 1.0  # inferred time is never certain


def test_unparseable_phrase_returns_no_confidence():
    resolved, confidence = resolve_relative_datetime("sometime back", now=NOW)
    assert resolved is None
    assert confidence == 0.0


def test_iso_timestamp_is_fully_confident():
    _, confidence = resolve_relative_datetime("2026-07-29T21:30:00", now=NOW)
    assert confidence == 1.0


# --- rule file integrity -----------------------------------------------------

def test_every_rule_cites_a_source():
    for rule in RULES:
        assert rule.get("source_url"), f"{rule['rule_id']} has no source_url"
        assert rule.get("verified_on"), f"{rule['rule_id']} has no verified_on"
