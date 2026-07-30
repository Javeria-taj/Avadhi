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

log = logging.getLogger(__name__)
_model = None
_tokenizer = None

SYSTEM_PROMPT = """You extract facts from a farmer's or family member's spoken \
report of a loss. Reply with JSON only. No preamble, no markdown fences.

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
- A mention of "Fasal Bima" or "crop insurance" means has_pmfby_policy = true.
"""


def _load():
    global _model, _tokenizer
    if _model is None:
        from mlx_lm import load

        log.info("Loading Gemma from %s", settings.model_path)
        _model, _tokenizer = load(settings.model_path)
    return _model, _tokenizer


def _strip_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?", "", text.strip())
    return re.sub(r"```$", "", text.strip()).strip()


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
        from mlx_lm import generate

        model, tokenizer = _load()
        prompt = tokenizer.apply_chat_template(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": transcript},
            ],
            tokenize=False,
            add_generation_prompt=True,
        )
        raw = generate(model, tokenizer, prompt=prompt, max_tokens=400)
        try:
            payload = json.loads(_strip_fences(raw))
        except json.JSONDecodeError:
            log.warning("Model returned non-JSON, falling back to empty report: %s", raw[:200])
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
    return settings.mock_mode or _model is not None
