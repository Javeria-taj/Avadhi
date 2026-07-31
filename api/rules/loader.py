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
#
# Two pattern tables, and the split matters
# -----------------------------------------
# Python's \b word boundary is defined against characters where isalnum() is
# true. Kannada words routinely END in a combining vowel sign (U+0CC6 etc.)
# which is category Mn and NOT alnum - so \b after a Kannada word never
# matches and the phrase silently fails to resolve. The user then sees no
# countdown, with nothing in the logs.
#
# So: \b for ASCII, plain substring for Indic. Indic patterns are ordered
# longest-first, because without a boundary "ನಿನ್ನೆ" would otherwise shadow
# "ನಿನ್ನೆ ರಾತ್ರಿ".

_ASCII_PATTERNS: list[tuple[str, timedelta]] = [
    (r"\b(just now|right now)\b", timedelta(0)),
    (r"\b(this morning)\b", timedelta(hours=-6)),
    (r"\b(last night|tonight)\b", timedelta(hours=-12)),
    (r"\b(day before yesterday)\b", timedelta(days=-2)),
    (r"\b(yesterday)\b", timedelta(days=-1)),
    (r"\b(today)\b", timedelta(hours=-3)),
    (r"\b(two days ago)\b", timedelta(days=-2)),
    (r"\b(three days ago)\b", timedelta(days=-3)),
    (r"\b(last week)\b", timedelta(days=-7)),
]

# LONGEST FIRST. Do not reorder without re-running the tests.
_INDIC_PATTERNS: list[tuple[str, timedelta]] = [
    ("ಮೊನ್ನೆ ರಾತ್ರಿ", timedelta(days=-2, hours=-12)),
    ("ನಿನ್ನೆ ರಾತ್ರಿ", timedelta(hours=-12)),
    ("ಇಂದು ಬೆಳಿಗ್ಗೆ", timedelta(hours=-6)),
    ("ಇವತ್ತು ಬೆಳಿಗ್ಗೆ", timedelta(hours=-6)),
    ("ಕಳೆದ ವಾರ", timedelta(days=-7)),
    ("ಈ ರಾತ್ರಿ", timedelta(hours=-6)),
    ("ಮೊನ್ನೆ", timedelta(days=-2)),
    ("ನಿನ್ನೆ", timedelta(days=-1)),
    ("ಇಂದು", timedelta(hours=-3)),
    ("ಇವತ್ತು", timedelta(hours=-3)),
    ("ಈಗ", timedelta(0)),
    # Hindi, since the same failure mode applies to Devanagari.
    ("कल रात", timedelta(hours=-12)),
    ("परसों", timedelta(days=-2)),
    ("कल", timedelta(days=-1)),
    ("आज", timedelta(hours=-3)),
    ("अभी", timedelta(0)),
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

    for pattern, delta in _ASCII_PATTERNS:
        if re.search(pattern, text):
            # Deliberately capped below 1.0: an inferred time is never certain.
            return current + delta, 0.7

    # Substring, not regex: see the note above the pattern tables.
    for phrase, delta in _INDIC_PATTERNS:
        if phrase in text:
            return current + delta, 0.7

    return None, 0.0