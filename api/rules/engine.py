"""Deterministic claim-window engine.

THIS IS THE MOST IMPORTANT FILE IN THE PROJECT.

No model call happens here. No network call happens here. Given an event report
and a set of rules, this function returns the same answer every time.

That is the point. A language model must never compute the deadline on which
someone's insurance claim depends.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from api.models.schemas import ClaimStatus, ClaimWindow, EventReport

# Everything is IST. A naive datetime here produces a deadline 5.5 hours wrong,
# which is invisible in testing and fatal on stage.
IST = timezone(timedelta(hours=5, minutes=30))

CLOSING_SOON_HOURS = 12.0


def now_ist() -> datetime:
    return datetime.now(IST)


def _as_ist(dt: datetime) -> datetime:
    """Force any datetime into IST. Naive datetimes are assumed to be IST."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=IST)
    return dt.astimezone(IST)


def _evaluate_predicate(predicate: dict[str, Any], event: EventReport) -> tuple[bool, bool]:
    """Evaluate one predicate.

    Returns (passed, was_missing). `was_missing` distinguishes "we know this is
    false" from "we don't know yet" — the difference between telling someone
    they don't qualify and asking them a question.
    """
    field = predicate["field"]
    op = predicate["op"]
    expected = predicate.get("value")

    actual = event.get(field)
    if actual is None:
        return False, True

    # Enums compare by value
    if hasattr(actual, "value"):
        actual = actual.value

    if op == "==":
        return actual == expected, False
    if op == "!=":
        return actual != expected, False
    if op == "in":
        return actual in expected, False
    if op == ">=":
        return actual >= expected, False
    if op == "<=":
        return actual <= expected, False
    if op == "between":
        return expected[0] <= actual <= expected[1], False

    raise ValueError(f"Unknown operator in rule: {op!r}")


def _window_delta(rule: dict[str, Any]) -> timedelta | None:
    if rule.get("window_hours") is not None:
        return timedelta(hours=rule["window_hours"])
    if rule.get("window_days") is not None:
        return timedelta(days=rule["window_days"])
    return None


def _clock_start(rule: dict[str, Any], event: EventReport) -> tuple[str, Any]:
    """Which field the clock runs from, and its value.

    PMFBY runs from the event. RBI runs from the bank's communication - a
    different field, and getting this wrong would silently shift the deadline.
    """
    field = rule.get("window_starts_at", "event_datetime")
    return field, event.get(field)


def _compute_deadline(
    rule: dict[str, Any], start: datetime
) -> datetime | None:
    """Deadline from a start datetime, calendar or working-day."""
    working = rule.get("window_working_days")
    if working is not None:
        # Imported lazily: workdays imports IST from this module.
        from api.rules.workdays import working_day_deadline

        return working_day_deadline(start, working)

    delta = _window_delta(rule)
    if delta is None:
        return None
    return _as_ist(start) + delta


SUPPORTED_LANGS = ("kn", "en")


def _localised(rule: dict[str, Any], key: str, lang: str, default: Any) -> Any:
    """Pick a rule field for the active language, falling back to Kannada.

    Falling back rather than returning empty matters: a missing English string
    should degrade to a language the content definitely exists in, not to a
    blank checklist.
    """
    return rule.get(f"{key}_{lang}") or rule.get(f"{key}_kn") or default


def evaluate(
    event: EventReport,
    rules: list[dict[str, Any]],
    now: datetime | None = None,
    lang: str = "kn",
) -> list[ClaimWindow]:
    """Return every claim window triggered by this event.

    `now` is injectable so tests can pin time. Never call now_ist() inside the
    loop — a rule evaluated at 23:59:59.9 and another at 00:00:00.1 would use
    different clocks.
    """
    current = _as_ist(now) if now else now_ist()
    lang = lang if lang in SUPPORTED_LANGS else "kn"
    results: list[ClaimWindow] = []

    for rule in rules:
        passed_labels: list[str] = []
        missing: list[str] = []
        failed = False

        for predicate in rule.get("trigger_predicates", []):
            ok, was_missing = _evaluate_predicate(predicate, event)
            if was_missing:
                missing.append(predicate["field"])
            elif ok:
                passed_labels.append(
                    f"{predicate['field']} {predicate['op']} {predicate.get('value')}"
                )
            else:
                failed = True
                break

        # A predicate we can evaluate and that is false means this scheme
        # genuinely does not apply. Say nothing rather than clutter the screen.
        if failed:
            continue

        base = {
            "rule_id": rule["rule_id"],
            "scheme_name_en": rule["scheme_name_en"],
            "scheme_name_kn": rule["scheme_name_kn"],
            "matched_rules": passed_labels,
            "channels": _localised(rule, "channels", lang, rule.get("channels", [])),
            "evidence_checklist_kn": rule.get("evidence_checklist_kn", []),
            "failure_consequence_kn": rule.get("failure_consequence_kn"),
            "lang": lang,
            "scheme_name": rule[f"scheme_name_{lang}"] if f"scheme_name_{lang}" in rule
                           else rule["scheme_name_en"],
            "evidence_checklist": _localised(rule, "evidence_checklist", lang, []),
            "window_description": _localised(rule, "window_description", lang, None),
            "required_documents": _localised(rule, "required_documents", lang, []),
            "required_documents_kn": rule.get("required_documents_kn", []),
            "required_documents_en": rule.get("required_documents_en", []),
            "failure_consequence": _localised(rule, "failure_consequence", lang, None),
            "source_url": rule.get("source_url"),
            "verified_on": rule.get("verified_on"),
            "form_id": rule.get("form_id"),
        }

        if missing:
            results.append(
                ClaimWindow(status=ClaimStatus.NEED_INFO, missing_info=missing, **base)
            )
            continue

        clock_field, clock_start = _clock_start(rule, event)
        if clock_start is None:
            results.append(
                ClaimWindow(
                    status=ClaimStatus.NEED_INFO,
                    missing_info=[clock_field],
                    **base,
                )
            )
            continue

        deadline = _compute_deadline(rule, clock_start)
        if deadline is None:
            results.append(
                ClaimWindow(
                    status=ClaimStatus.NEED_INFO,
                    missing_info=[clock_field],
                    **base,
                )
            )
            continue

        hours_remaining = (deadline - current).total_seconds() / 3600.0

        if hours_remaining <= 0:
            status = ClaimStatus.EXPIRED
        elif hours_remaining < CLOSING_SOON_HOURS:
            status = ClaimStatus.CLOSING_SOON
        else:
            status = ClaimStatus.OPEN

        results.append(
            ClaimWindow(
                status=status,
                deadline_iso=deadline,
                hours_remaining=round(hours_remaining, 1),
                **base,
            )
        )

    # Most urgent first. Expired sinks to the bottom but is never hidden —
    # a system that conceals bad news can't be trusted with someone's money.
    def sort_key(claim: ClaimWindow) -> tuple[int, float]:
        order = {
            ClaimStatus.CLOSING_SOON: 0,
            ClaimStatus.OPEN: 1,
            ClaimStatus.NEED_INFO: 2,
            ClaimStatus.EXPIRED: 3,
        }
        return order[claim.status], claim.hours_remaining or 1e9

    return sorted(results, key=sort_key)