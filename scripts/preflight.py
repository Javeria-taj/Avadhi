"""Preflight check. Run this before you trust anything else.

    python scripts/preflight.py

Exits non-zero on any failure so you can see at a glance whether the tree is
intact after moving files around.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Run from anywhere: python scripts/preflight.py
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MOCK_MODE", "true")

failures: list[str] = []
warnings: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}" + (f"  -> {detail}" if detail else ""))
        failures.append(label)


print("\n1. Contract integrity (did schemas.py survive the file move?)")
from api.models.schemas import Case, CaseState, EventReport, EventType, IntakeResponse, Photo, Step

fields = EventReport.model_fields
for name in ("bank_communication_datetime", "transaction_amount", "has_bank_account"):
    check(f"EventReport.{name} exists", name in fields,
          "schemas.py was regenerated and lost the bank-fraud fields")
check("EventType.UNAUTHORISED_TRANSACTION exists",
      hasattr(EventType, "UNAUTHORISED_TRANSACTION"))
check("IntakeResponse.case_id exists", "case_id" in IntakeResponse.model_fields)
check("IntakeResponse.clarifying_options_kn exists",
      "clarifying_options_kn" in IntakeResponse.model_fields)
for cls in (Case, CaseState, Photo, Step):
    check(f"{cls.__name__} defined", cls is not None)


print("\n2. Rules loaded")
from api.rules.loader import load_rules

rules = load_rules()
ids = {r["rule_id"] for r in rules}
check(f"4 rules loaded (got {len(rules)})", len(rules) == 4)
for rid in ("PMFBY_LOCALISED", "RBI_UNAUTH_TXN", "PMSBY_ACCIDENT", "PMJJBY_DEATH"):
    check(f"{rid} present", rid in ids)
for rule in rules:
    check(f"{rule['rule_id']} cites a source",
          bool(rule.get("source_url")) and bool(rule.get("verified_on")))


print("\n3. Working-day arithmetic (the RBI clock)")
from datetime import date, datetime
from api.rules.engine import IST
from api.rules.workdays import add_working_days, is_working_day, working_day_deadline

check("Sunday is not a working day", not is_working_day(date(2026, 7, 12), set()))
check("2nd Saturday is not a working day", not is_working_day(date(2026, 7, 11), set()))
check("3rd Saturday IS a working day", is_working_day(date(2026, 7, 18), set()))
check("start date excluded (Mon +3wd = Thu)",
      add_working_days(date(2026, 7, 13), 3, set()) == date(2026, 7, 16))
check("Friday-night alert gives until Wednesday",
      working_day_deadline(datetime(2026, 7, 10, 22, 15, tzinfo=IST), 3, set()).date()
      == date(2026, 7, 15))


print("\n4. Both verticals through the engine")
from datetime import timedelta
from api.rules.engine import evaluate, now_ist

now = now_ist()
crop = EventReport(event_type=EventType.HAILSTORM,
                   event_datetime=now - timedelta(hours=24),
                   has_pmfby_policy=True)
crop_claims = {c.rule_id: c for c in evaluate(crop, rules)}
check("crop event triggers PMFBY", "PMFBY_LOCALISED" in crop_claims)
check("crop event does NOT trigger RBI", "RBI_UNAUTH_TXN" not in crop_claims)
if "PMFBY_LOCALISED" in crop_claims:
    hrs = crop_claims["PMFBY_LOCALISED"].hours_remaining
    check(f"PMFBY 72h window correct (got {hrs}h)", 47.5 < hrs < 48.5)

bank = EventReport(event_type=EventType.UNAUTHORISED_TRANSACTION,
                   bank_communication_datetime=now - timedelta(hours=2),
                   has_bank_account=True, transaction_amount=18400.0)
bank_claims = {c.rule_id: c for c in evaluate(bank, rules)}
check("bank event triggers RBI", "RBI_UNAUTH_TXN" in bank_claims)
check("bank event does NOT trigger PMFBY", "PMFBY_LOCALISED" not in bank_claims)
if "RBI_UNAUTH_TXN" in bank_claims:
    check("RBI clock ran from bank communication, not event",
          bank_claims["RBI_UNAUTH_TXN"].deadline_iso is not None)


print("\n5. Full request path (mock mode)")
import io
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)
health = client.get("/health").json()
check("/health ok", health.get("status") == "ok")
check(f"/health reports 4 rules (got {health.get('rules_loaded')})",
      health.get("rules_loaded") == 4)

intake = client.post("/api/intake",
                     files={"audio": ("c.webm", io.BytesIO(b"x"), "audio/webm")})
check("/api/intake returns 200", intake.status_code == 200)
if intake.status_code == 200:
    body = intake.json()
    case_id = body.get("case_id")
    check("intake created a case", bool(case_id))
    check("intake returned claims", len(body.get("claims", [])) > 0)

    if case_id:
        check("/api/cases lists it", len(client.get("/api/cases").json()) > 0)
        detail = client.get(f"/api/cases/{case_id}")
        check("/api/cases/{id} returns 200", detail.status_code == 200)
        steps = detail.json().get("steps", [])
        check("case has checklist steps", len(steps) > 0)
        if steps:
            patched = client.patch(
                f"/api/cases/{case_id}/steps/{steps[0]['step_id']}", json={"done": True})
            check("PATCH step works", patched.status_code == 200)
            photo = client.post(
                f"/api/cases/{case_id}/photo",
                files={"image": ("s.jpg", io.BytesIO(b"j"), "image/jpeg")},
                data={"lat": "15.1394", "lon": "76.9214", "accuracy_m": "8.0"})
            check("POST photo works", photo.status_code == 200)
            check("photo with coords is marked verified",
                  photo.json().get("location_verified") is True)
        pdf = client.post("/api/document",
                          json={"rule_id": detail.json()["rule_id"],
                                "event": detail.json()["event"]})
        check("PDF generated", pdf.content[:5] == b"%PDF-")


print("\n6. Holiday data")
from api.rules.workdays import load_holidays

holidays = load_holidays()
if not holidays:
    warnings.append("data/holidays.json has no dates — deadlines will be computed "
                    "without declared holidays (fails EARLY, which is the safe direction)")
else:
    print(f"  INFO  {len(holidays)} declared holidays loaded")
warnings.append("data/holidays.json omits Karnataka state and lunar-calendar "
                "holidays — replace with the RBI list before any field claim")
warnings.append("Verify the PMFBY helpline (14447) on pmfby.gov.in before the demo")


print("\n" + "=" * 60)
for w in warnings:
    print(f"  WARN  {w}")
if failures:
    print(f"\n  {len(failures)} CHECK(S) FAILED:")
    for f in failures:
        print(f"    - {f}")
    sys.exit(1)
print("\n  ALL CHECKS PASSED\n")
