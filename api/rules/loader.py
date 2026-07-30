"""Load rule JSON from disk and resolve relative dates in code, not in the model."""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from api.rules.engine import IST, now_ist

SCHEMES_DIR = Path(__file__).resolve().parents[2] / "data" / "schemes"

_REQUIRED_KEYS = {"rule_id", "scheme_name_en", "scheme_name_kn", "trigger_predicates"}


def load_rules(directory: Path | None = None) -> list[dict[str, Any]]:
    """Read every rule file. Fails loudly on a malformed rule.

    A silently skipped rule means a claim window nobody is told about, so
    crash at startup instead.
    """
    directory = directory or SCHEMES_DIR
    rules: list[dict[str, Any]] = []

    for path in sorted(directory.glob("*.json")):
        with path.open(encoding="utf-8") as handle:
            rule = json.load(handle)
        missing = _REQUIRED_KEYS - rule.keys()
        if missing:
            raise ValueError(f"{path.name} is missing required keys: {sorted(missing)}")
        if not rule.get("source_url"):
            raise ValueError(
                f"{path.name} has no source_url. Every rule must cite where it came from."
            )
        rules.append(rule)

    if not rules:
        raise ValueError(f"No rules found in {directory}. The engine has nothing to evaluate.")
    return rules


# Relative-time resolution lives here, in plain code. The model reports the
# phrase it heard; it does not do date arithmetic.
_RELATIVE_PATTERNS: list[tuple[str, timedelta]] = [
    (r"\b(just now|right now|ಈಗ)\b", timedelta(0)),
    (r"\b(this morning|ಇಂದು ಬೆಳಿಗ್ಗೆ)\b", timedelta(hours=-6)),
    (r"\b(today|ಇಂದು)\b", timedelta(hours=-3)),
    (r"\b(last night|tonight|ನಿನ್ನೆ ರಾತ್ರಿ)\b", timedelta(hours=-12)),
    (r"\b(yesterday|ನಿನ್ನೆ)\b", timedelta(days=-1)),
    (r"\b(day before yesterday|ಮೊನ್ನೆ)\b", timedelta(days=-2)),
    (r"\b(two days ago)\b", timedelta(days=-2)),
    (r"\b(three days ago)\b", timedelta(days=-3)),
    (r"\b(last week|ಕಳೆದ ವಾರ)\b", timedelta(days=-7)),
]


def resolve_relative_datetime(
    phrase: str | None, now: datetime | None = None
) -> tuple[datetime | None, float]:
    """Turn 'last night' into a timestamp, plus a confidence score.

    Confidence matters: below the threshold the UI asks the person to confirm
    the date before showing a countdown. When a claim depends on the answer,
    asking is correct behaviour, not friction.
    """
    if not phrase:
        return None, 0.0

    current = now or now_ist()
    text = phrase.strip().lower()

    # An explicit ISO timestamp is the only high-confidence case.
    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=IST), 1.0
    except ValueError:
        pass

    for pattern, delta in _RELATIVE_PATTERNS:
        if re.search(pattern, text):
            # Deliberately capped below 1.0: an inferred time is never certain.
            return current + delta, 0.7

    return None, 0.0
