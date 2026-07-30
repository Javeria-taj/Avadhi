"""HTTP only: parse the upload, call services, return the response."""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from api.models.schemas import ClaimStatus, EventType, IntakeResponse
from api.rules.engine import evaluate
from api.rules.loader import load_rules
from api.services import asr, cases as store, explain, extract
from api.services import profile as profile_store

log = logging.getLogger(__name__)
router = APIRouter()

RULES = load_rules()

DATE_CONFIDENCE_THRESHOLD = 0.9
ASK_POLICY_KN = "ನಿಮ್ಮ ಹತ್ತಿರ ಫಸಲ್ ಬಿಮಾ ಪಾಲಿಸಿ ಇದೆಯೇ?"
ASK_DATE_KN = "ಹಾನಿ ಯಾವ ದಿನಾಂಕದಂದು ಆಯಿತು ಎಂದು ದೃಢಪಡಿಸಿ."

# Never ask the user to classify a peril - they cannot. Ask what they observed
# and let the engine map observations to candidate rules.
ASK_OBSERVED_KN = "ಹೊಲದಲ್ಲಿ ಏನು ಕಾಣುತ್ತಿದೆ?"
OBSERVED_OPTIONS_KN = [
    "ಆಲಿಕಲ್ಲು ಬಿದ್ದಿದೆ, ಎಲೆ ಹರಿದಿದೆ",
    "ನೀರು ನಿಂತಿದೆ",
    "ಕೊಯ್ದ ಬೆಳೆ ಹೊಲದಲ್ಲಿ ನೆನೆದಿದೆ",
]

# English equivalents. Note these ask what the person SAW, never which peril
# applies - a farmer cannot classify "inundation" vs "waterlogging", and does
# not need to.
ASK_POLICY_EN = "Do you have a Fasal Bima (crop insurance) policy?"
ASK_DATE_EN = "Please confirm the date the damage happened."
ASK_OBSERVED_EN = "What do you see in the field?"
OBSERVED_OPTIONS_EN = [
    "Hail fell, leaves are shredded",
    "Water is standing in the field",
    "Harvested crop is lying wet in the field",
]

PROMPTS = {
    "kn": {"policy": ASK_POLICY_KN, "date": ASK_DATE_KN,
           "observed": ASK_OBSERVED_KN, "options": OBSERVED_OPTIONS_KN},
    "en": {"policy": ASK_POLICY_EN, "date": ASK_DATE_EN,
           "observed": ASK_OBSERVED_EN, "options": OBSERVED_OPTIONS_EN},
}


@router.post("/intake", response_model=IntakeResponse)
async def intake(
    audio: UploadFile = File(...),
    # None = let the model auto-detect. This is what allows someone who does
    # not speak Kannada to use the app, including a judge trying it live.
    lang: str | None = Form(None),
) -> IntakeResponse:
    suffix = Path(audio.filename or "clip.webm").suffix or ".webm"
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name

        transcript, detected = asr.transcribe(tmp_path, lang)
        if not transcript:
            raise HTTPException(status_code=422, detail="No speech detected. Record again.")

        active = detected if detected in ("kn", "en") else "kn"

        event = extract.extract(transcript)
        # Fill what the profile already knows. What the person just said always
        # wins - prefill only touches fields the speech left empty.
        event = profile_store.prefill_event(event)
        claims = evaluate(event, RULES, lang=active)
        claims = explain.attach_explanations(claims, active)

        # Below the threshold we ask the person to confirm the date before
        # showing a countdown. When a claim depends on it, asking is correct.
        date_confidence = event.confidence.get("event_datetime", 0.0)
        needs_confirmation = bool(event.event_datetime) and date_confidence < DATE_CONFIDENCE_THRESHOLD

        # One question, and only when the answer would change the outcome.
        prompts = PROMPTS[active]
        question = None
        options: list[str] = []
        if event.event_type is EventType.UNKNOWN:
            question, options = prompts["observed"], prompts["options"]
        elif any(c.status is ClaimStatus.NEED_INFO for c in claims):
            question = prompts["policy"]
        elif needs_confirmation:
            question = prompts["date"]

        # Persist the strongest claim as a Case. This is what keeps the clock
        # running after the app closes.
        case_id = None
        actionable = [c for c in claims if c.status is not ClaimStatus.NEED_INFO]
        if actionable:
            case_id = store.create_case(event, actionable[0]).case_id

        return IntakeResponse(
            transcript=transcript,
            lang=active,
            event=event,
            claims=claims,
            case_id=case_id,
            clarifying_question=question,
            clarifying_options=options,
            clarifying_question_kn=PROMPTS["kn"]["observed"] if options else question,
            clarifying_options_kn=PROMPTS["kn"]["options"] if options else [],
            needs_date_confirmation=needs_confirmation,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)
