"""ClaimWindow -> a sentence a worried person can act on, in Kannada.

The model writes prose here. It is given the deadline as an already-computed
fact; it is never asked to work one out.
"""
from __future__ import annotations

import logging

from api.config import settings
from api.models.schemas import ClaimStatus, ClaimWindow

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You explain an insurance claim deadline to a farmer in simple \
spoken Kannada. Two or three short sentences. No English words except scheme names.

You are given facts. Do not add facts, do not change any number, and do not \
soften a deadline. State how much time is left, and what to do first.
"""

# Pre-written strings. The demo must never depend on live generation for its
# most important line - if the model stalls, the countdown still speaks.
TEMPLATES = {
    ClaimStatus.OPEN: "ನಿಮಗೆ ಇನ್ನೂ {hours} ಗಂಟೆ ಸಮಯವಿದೆ. ಈಗಲೇ ಫೋಟೋ ತೆಗೆದು ವಿಮಾ ಕಂಪನಿಗೆ ತಿಳಿಸಿ.",
    ClaimStatus.CLOSING_SOON: "ಎಚ್ಚರಿಕೆ: ಕೇವಲ {hours} ಗಂಟೆ ಬಾಕಿ ಇದೆ. ತಕ್ಷಣ ತಿಳಿಸಿ.",
    ClaimStatus.EXPIRED: "ಈ ಕ್ಲೇಮ್‌ನ ಸಮಯ ಮುಗಿದಿದೆ. ಆದರೂ ಕೃಷಿ ಅಧಿಕಾರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ ದೂರು ಸಲ್ಲಿಸಬಹುದು.",
    ClaimStatus.NEED_INFO: "ಇನ್ನಷ್ಟು ಮಾಹಿತಿ ಬೇಕು. ದಯವಿಟ್ಟು ಕೆಳಗಿನ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಿ.",
}


def _template(claim: ClaimWindow) -> str:
    hours = int(claim.hours_remaining) if claim.hours_remaining else 0
    return TEMPLATES[claim.status].format(hours=abs(hours))


def explain(claim: ClaimWindow) -> str:
    """Generate an explanation, falling back to a template on any failure."""
    if settings.mock_mode:
        return _template(claim)

    try:
        from mlx_lm import generate

        from api.services.extract import _load

        model, tokenizer = _load()
        facts = (
            f"Scheme: {claim.scheme_name_en}. "
            f"Status: {claim.status.value}. "
            f"Hours remaining: {claim.hours_remaining}. "
            f"Consequence of missing it: {claim.failure_consequence_kn}"
        )
        prompt = tokenizer.apply_chat_template(
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": facts},
            ],
            tokenize=False,
            add_generation_prompt=True,
        )
        return generate(model, tokenizer, prompt=prompt, max_tokens=160).strip()
    except Exception:
        log.exception("Explanation generation failed, using template")
        return _template(claim)


def attach_explanations(claims: list[ClaimWindow]) -> list[ClaimWindow]:
    for claim in claims:
        claim.explanation_kn = explain(claim)
    return claims
