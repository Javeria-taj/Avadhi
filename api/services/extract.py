"""Transcript -> EventReport.

This is the ONE place the model is allowed to interpret anything. It reports
what it heard. It does not decide eligibility and it does not compute dates.

Note the prompt below explicitly forbids date arithmetic: the model returns the
phrase it heard ("last night") and code resolves it. That separation is what we
tell the judges, so the prompt has to actually enforce it.
"""
from __future__ import annotations

import json
import logging
import re

from api.config import settings
from api.models.schemas import EventReport, EventType
from api.rules.loader import resolve_relative_datetime
from api.services.llm import InferenceError, generate as llm_generate

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You extract facts from a farmer's or family member's spoken \
report of a loss.

Output a single JSON object and NOTHING else. Do not greet. Do not acknowledge.
Do not write "Certainly" or "ಖಂಡಿತ" or any preamble. Do not use markdown fences.
Your entire reply must start with { and end with }.

Schema:
{
  "event_type": one of ["hailstorm","landslide","inundation","waterlogging",
                        "cloudburst","post_harvest_loss","accidental_death",
                        "disability","death","unknown"],
  "event_datetime_raw": the time phrase exactly as spoken, e.g. "last night",
                        "yesterday", "ನಿನ್ನೆ ರಾತ್ರಿ". null if not mentioned.
  "crop": string or null,
  "area_acres": number or null,
  "district": string or null,
  "has_pmfby_policy": true/false/null,
  "has_pmsby": true/false/null,
  "has_pmjjby": true/false/null,
  "age_at_event": number or null,
  "policy_number": string or null
}

Rules you must follow:
- Do NOT calculate any date or deadline. Return the raw phrase only.
- Use null when the speaker did not say something. Never guess.
- null means "not stated". false means the speaker explicitly said no.
- A mention of "Fasal Bima", "ಫಸಲ್ ಬಿಮಾ" or "crop insurance" means has_pmfby_policy = true.
- Give "crop" as the ENGLISH crop name, never a transliteration.
  ಹತ್ತಿ -> "cotton"   ಜೋಳ -> "maize"   ಶೇಂಗಾ -> "groundnut"
  ಭತ್ತ -> "rice"      ಕಬ್ಬು -> "sugarcane"   ಸೂರ್ಯಕಾಂತಿ -> "sunflower"
- Return event_datetime_raw in the speaker's own words, in their own script.
"""


def _extract_json(text: str) -> str:
    """Pull the JSON object out of a model response.

    Gemma reliably prefixes answers with conversational filler - "Certainly,",
    "ಖಂಡಿತ," - and sometimes wraps output in code fences. Both break
    json.loads. Rather than fight it in the prompt alone, find the outermost
    balanced {...} and parse that.
    """
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()

    start = text.find("{")
    if start == -1:
        return text

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return text[start:]


def _mock_payload(transcript: str) -> dict:
    """Keeps the whole pipeline runnable with no model. See config.mock_mode."""
    return {
        "event_type": "hailstorm",
        "event_datetime_raw": "last night",
        "crop": "cotton",
        "area_acres": 1.5,
        "has_pmfby_policy": True,
    }


def extract(transcript: str) -> EventReport:
    if settings.mock_mode:
        payload = _mock_payload(transcript)
    else:
        try:
            raw = llm_generate(SYSTEM_PROMPT, transcript, max_tokens=400)
            payload = json.loads(_extract_json(raw))
        except json.JSONDecodeError:
            # A model that returns prose instead of JSON must not 500. An empty
            # report becomes a need_info claim, which asks the user a question.
            log.warning("Model returned non-JSON; falling back to an empty report")
            payload = {}
        except InferenceError:
            log.exception("Inference failed during extraction")
            payload = {}

    # Date resolution happens HERE, in code, with a confidence score attached.
    raw_phrase = payload.get("event_datetime_raw")
    resolved, confidence = resolve_relative_datetime(raw_phrase)

    try:
        event_type = EventType(payload.get("event_type") or "unknown")
    except ValueError:
        event_type = EventType.UNKNOWN

    report = EventReport(
        event_type=event_type,
        event_datetime=resolved,
        event_datetime_raw=raw_phrase,
        crop=payload.get("crop"),
        area_acres=payload.get("area_acres"),
        district=payload.get("district"),
        has_pmfby_policy=payload.get("has_pmfby_policy"),
        has_pmsby=payload.get("has_pmsby"),
        has_pmjjby=payload.get("has_pmjjby"),
        age_at_event=payload.get("age_at_event"),
        policy_number=payload.get("policy_number"),
    )
    if confidence:
        report.confidence["event_datetime"] = confidence
    return report


def is_loaded() -> bool:
    from api.services.llm import is_ready

    return is_ready()