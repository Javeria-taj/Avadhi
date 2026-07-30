"""ClaimWindow -> a sentence a worried person can act on, in Kannada.

The model writes prose here. It is given the deadline as an already-computed
fact; it is never asked to work one out.
"""
from __future__ import annotations

import logging

from api.config import settings
from api.models.schemas import ClaimStatus, ClaimWindow

log = logging.getLogger(__name__)

LANG_NAMES = {"kn": "simple spoken Kannada", "en": "plain simple English"}


def _system_prompt(lang: str) -> str:
    return (
        f"You explain an insurance or banking claim deadline to an ordinary person in "
        f"{LANG_NAMES.get(lang, LANG_NAMES['kn'])}. Two or three short sentences.\n\n"
        "You are given facts. Do not add facts, do not change any number, and do not "
        "soften a deadline. State how much time is left, and what to do first."
    )

# Pre-written strings. The demo must never depend on live generation for its
# most important line - if the model stalls, the countdown still speaks.
TEMPLATES_EN = {
    ClaimStatus.OPEN: "You have {hours} hours left. Take photos now and inform the insurer.",
    ClaimStatus.CLOSING_SOON: "Warning: only {hours} hours left. Report immediately.",
    ClaimStatus.EXPIRED: "This claim window has closed. You can still contact the officer and file a grievance.",
    ClaimStatus.NEED_INFO: "More information is needed. Please answer the question below.",
}

TEMPLATES_KN = {
    ClaimStatus.OPEN: "ನಿಮಗೆ ಇನ್ನೂ {hours} ಗಂಟೆ ಸಮಯವಿದೆ. ಈಗಲೇ ಫೋಟೋ ತೆಗೆದು ವಿಮಾ ಕಂಪನಿಗೆ ತಿಳಿಸಿ.",
    ClaimStatus.CLOSING_SOON: "ಎಚ್ಚರಿಕೆ: ಕೇವಲ {hours} ಗಂಟೆ ಬಾಕಿ ಇದೆ. ತಕ್ಷಣ ತಿಳಿಸಿ.",
    ClaimStatus.EXPIRED: "ಈ ಕ್ಲೇಮ್‌ನ ಸಮಯ ಮುಗಿದಿದೆ. ಆದರೂ ಕೃಷಿ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ ದೂರು ಸಲ್ಲಿಸಬಹುದು.",
    ClaimStatus.NEED_INFO: "ಇನ್ನಷ್ಟು ಮಾಹಿತಿ ಬೇಕು. ದಯವಿಟ್ಟು ಕೆಳಗಿನ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಿ.",
}


def _template(claim: ClaimWindow, lang: str) -> str:
    hours = int(claim.hours_remaining) if claim.hours_remaining else 0
    table = TEMPLATES_EN if lang == "en" else TEMPLATES_KN
    return table[claim.status].format(hours=abs(hours))


def explain(claim: ClaimWindow, lang: str = "kn") -> str:
    """Generate an explanation, falling back to a template on any failure."""
    if settings.mock_mode:
        return _template(claim, lang)

    try:
        from api.services.llm import generate as llm_generate

        facts = (
            f"Scheme: {claim.scheme_name_en}. "
            f"Status: {claim.status.value}. "
            f"Hours remaining: {claim.hours_remaining}. "
            f"Consequence of missing it: {claim.failure_consequence_kn}"
        )
        return llm_generate(_system_prompt(lang), facts, max_tokens=160).strip()
    except Exception:
        log.exception("Explanation generation failed, using template")
        return _template(claim, lang)


def relocalise(claim: ClaimWindow, lang: str) -> str:
    """Explanation in `lang` without a model call.

    Used when re-reading a stored case in a different language. Regenerating
    via the model would be slow and non-deterministic on a screen the user is
    already looking at; the templates are correct and instant.
    """
    return _template(claim, lang)


def attach_explanations(
    claims: list[ClaimWindow], lang: str = "kn"
) -> list[ClaimWindow]:
    for claim in claims:
        text = explain(claim, lang)
        claim.explanation = text
        # The _kn field always holds Kannada, whatever was requested.
        claim.explanation_kn = text if lang == "kn" else _template(claim, "kn")
    return claims