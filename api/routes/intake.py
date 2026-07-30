"""HTTP only: parse the upload, call services, return the response."""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from api.models.schemas import ClaimStatus, IntakeResponse
from api.rules.engine import evaluate
from api.rules.loader import load_rules
from api.services import asr, explain, extract

log = logging.getLogger(__name__)
router = APIRouter()

RULES = load_rules()

DATE_CONFIDENCE_THRESHOLD = 0.9
ASK_POLICY_KN = "ನಿಮ್ಮ ಹತ್ತಿರ ಫಸಲ್ ಬಿಮಾ ಪಾಲಿಸಿ ಇದೆಯೇ?"
ASK_DATE_KN = "ಹಾನಿ ಯಾವ ದಿನಾಂಕದಂದು ಆಯಿತು ಎಂದು ದೃಢಪಡಿಸಿ."


@router.post("/intake", response_model=IntakeResponse)
async def intake(audio: UploadFile = File(...)) -> IntakeResponse:
    suffix = Path(audio.filename or "clip.webm").suffix or ".webm"
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await audio.read())
            tmp_path = tmp.name

        transcript = asr.transcribe(tmp_path)
        if not transcript:
            raise HTTPException(status_code=422, detail="No speech detected. Record again.")

        event = extract.extract(transcript)
        claims = evaluate(event, RULES)
        claims = explain.attach_explanations(claims)

        # Below the threshold we ask the person to confirm the date before
        # showing a countdown. When a claim depends on it, asking is correct.
        date_confidence = event.confidence.get("event_datetime", 0.0)
        needs_confirmation = bool(event.event_datetime) and date_confidence < DATE_CONFIDENCE_THRESHOLD

        question = None
        if any(c.status is ClaimStatus.NEED_INFO for c in claims):
            question = ASK_POLICY_KN
        elif needs_confirmation:
            question = ASK_DATE_KN

        case_id = None
        if claims:
            from api.services.cases import create_case
            case = create_case(event, claims[0])
            case_id = case.case_id

        return IntakeResponse(
            transcript=transcript,
            event=event,
            claims=claims,
            clarifying_question_kn=question,
            needs_date_confirmation=needs_confirmation,
            case_id=case_id,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)
