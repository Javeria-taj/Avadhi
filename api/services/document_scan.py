"""Read a photographed document so the user never has to type.

Why this is not the prescription-reading idea I argued against
--------------------------------------------------------------
These are PRINTED documents with fixed layouts - a policy certificate, a bank
passbook first page. That is a very different problem from handwritten medical
scrawl, and the failure mode is contained: every extracted value is shown back
to the person for confirmation before anything depends on it, and an
unconfirmed field is left BLANK on the generated form rather than guessed.

The model proposes. The human decides. Same rule as everywhere else.

What we deliberately do not scan
--------------------------------
  - Aadhaar. Not required to intimate a claim; storing it is pure liability.
  - Debit or credit cards. Never photograph a card.
"""
from __future__ import annotations

import base64
import json
import logging

from api.config import settings
from api.models.schemas import DocumentKind, FieldConfidence, ScanResult
from api.services.extract import _extract_json
from api.services.llm import InferenceError, generate as llm_generate

log = logging.getLogger(__name__)

# Below this, the UI must show the value prominently and ask for confirmation
# rather than quietly accepting it.
CONFIRM_THRESHOLD = 0.95

_PROMPTS: dict[DocumentKind, str] = {
    DocumentKind.PMFBY_CERTIFICATE: """You read an Indian crop insurance (PMFBY) \
policy certificate or premium receipt.

Output a single JSON object and NOTHING else. Do not greet, do not acknowledge, \
do not write "Certainly" or any preamble, no markdown fences. Start with { and end with }.

{
  "pmfby_policy_number": {"value": string or null, "confidence": 0.0-1.0},
  "insurer": {"value": string or null, "confidence": 0.0-1.0},
  "crop": {"value": string or null, "confidence": 0.0-1.0},
  "land_acres": {"value": string or null, "confidence": 0.0-1.0},
  "survey_numbers": {"value": "comma separated" or null, "confidence": 0.0-1.0},
  "season": {"value": "Kharif" or "Rabi" or null, "confidence": 0.0-1.0}
}

Rules:
- Copy characters EXACTLY as printed. Do not correct, complete or reformat.
- If a character is unclear, lower the confidence. Never guess a digit.
- Use null when a field is not visible on the document.
- Confidence must reflect legibility, not your general certainty.""",

    DocumentKind.BANK_PASSBOOK: """You read the first page of an Indian bank passbook.

Output a single JSON object and NOTHING else. No preamble, no markdown fences.

{
  "bank_account_number": {"value": string or null, "confidence": 0.0-1.0},
  "bank_ifsc": {"value": string or null, "confidence": 0.0-1.0},
  "bank_branch": {"value": string or null, "confidence": 0.0-1.0},
  "name": {"value": string or null, "confidence": 0.0-1.0}
}

Rules:
- Copy digits EXACTLY. Never guess an unclear digit - lower the confidence instead.
- Do NOT read or output any Aadhaar number even if one is visible on the page.
- Use null for anything not visible.""",

    DocumentKind.LAND_RECORD: """You read an Indian land record (RTC / Pahani).

Output a single JSON object and NOTHING else. No preamble, no markdown fences.

{
  "survey_numbers": {"value": "comma separated" or null, "confidence": 0.0-1.0},
  "land_acres": {"value": string or null, "confidence": 0.0-1.0},
  "district": {"value": string or null, "confidence": 0.0-1.0}
}

Copy exactly. Lower confidence rather than guessing. Use null when not visible.""",
}

_MOCK: dict[DocumentKind, dict] = {
    DocumentKind.PMFBY_CERTIFICATE: {
        "pmfby_policy_number": {"value": "PMFBY/KA/2026/8841", "confidence": 0.72},
        "insurer": {"value": "Agriculture Insurance Company", "confidence": 0.94},
        "crop": {"value": "Cotton", "confidence": 0.97},
        "land_acres": {"value": "1.5", "confidence": 0.91},
        "survey_numbers": {"value": "142/3", "confidence": 0.83},
        "season": {"value": "Kharif", "confidence": 0.96},
    },
    DocumentKind.BANK_PASSBOOK: {
        "bank_account_number": {"value": "50100234567890", "confidence": 0.88},
        "bank_ifsc": {"value": "HDFC0001234", "confidence": 0.93},
        "bank_branch": {"value": "Ballari Main", "confidence": 0.9},
        "name": {"value": "Basavaraj H", "confidence": 0.86},
    },
    DocumentKind.LAND_RECORD: {
        "survey_numbers": {"value": "142/3, 142/4", "confidence": 0.79},
        "land_acres": {"value": "2.1", "confidence": 0.85},
        "district": {"value": "Ballari", "confidence": 0.95},
    },
}


def _to_fields(payload: dict) -> dict[str, FieldConfidence]:
    fields: dict[str, FieldConfidence] = {}
    for key, raw in payload.items():
        if not isinstance(raw, dict):
            continue
        value = raw.get("value")
        if value in (None, "", "null"):
            continue
        try:
            confidence = float(raw.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        fields[key] = FieldConfidence(
            value=str(value).strip(),
            confidence=max(0.0, min(1.0, confidence)),
            confirmed=False,
        )
    return fields


def scan_document(image_bytes: bytes, kind: DocumentKind) -> ScanResult:
    """Extract fields from a photographed document.

    Never raises on model failure - an empty result means the UI asks the person
    to retake the photo or skip, which is the correct behaviour.
    """
    if settings.mock_mode:
        payload = _MOCK[kind]
    else:
        try:
            raw = llm_generate(
                _PROMPTS[kind],
                "Read this document.",
                max_tokens=500,
                image_b64=base64.b64encode(image_bytes).decode("ascii"),
            )
            payload = json.loads(_extract_json(raw))
        except json.JSONDecodeError:
            log.warning("Document scan returned non-JSON")
            payload = {}
        except InferenceError:
            log.exception("Document scan inference failed")
            payload = {}

    fields = _to_fields(payload)

    # Anything below the threshold must be shown large and confirmed. In
    # practice almost everything read off a photograph lands here, which is the
    # point: confirmation is the normal path, not an error path.
    needs_confirmation = [
        name for name, field in fields.items() if field.confidence < CONFIRM_THRESHOLD
    ]

    return ScanResult(
        kind=kind, fields=fields, needs_confirmation=needs_confirmation
    )
