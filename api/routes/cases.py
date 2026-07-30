"""Case endpoints. HTTP only: parse, call the service, return.

These back the five UI screens:
  GET  /api/cases                          -> S1 home
  GET  /api/cases/{id}                     -> S3 detail
  PATCH /api/cases/{id}/steps/{step_id}    -> S3 checklist tick
  POST /api/cases/{id}/photo               -> S4 capture
  GET  /api/cases/{id}/photo/{photo_id}    -> S3 thumbnail
"""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from api.models.schemas import Case, StepUpdate
from api.services import cases as store

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/cases", response_model=list[Case])
async def list_cases() -> list[Case]:
    """Every case, most urgent first.

    Claims are recomputed on read so the countdown is never stale - a case
    written 20 hours ago must not report the hours it had then.
    """
    return [store.recompute(case) for case in store.list_cases()]


@router.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: str) -> Case:
    case = store.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return store.recompute(case)


@router.patch("/cases/{case_id}/steps/{step_id}", response_model=Case)
async def update_step(case_id: str, step_id: str, update: StepUpdate) -> Case:
    case = store.set_step_done(case_id, step_id, update.done)
    if case is None:
        raise HTTPException(status_code=404, detail="Case or step not found")
    return store.recompute(case)


@router.post("/cases/{case_id}/photo")
async def upload_photo(
    case_id: str,
    image: UploadFile = File(...),
    # Browser camera capture does not write EXIF GPS, so coordinates arrive as
    # separate fields from the Geolocation API. All optional: a denied
    # permission must not block the capture.
    lat: float | None = Form(None),
    lon: float | None = Form(None),
    accuracy_m: float | None = Form(None),
    captured_at: str | None = Form(None),
    step_id: str | None = Form(None),
) -> dict:
    when: datetime | None = None
    if captured_at:
        try:
            when = datetime.fromisoformat(captured_at)
        except ValueError:
            log.warning("Unparseable captured_at from client: %r", captured_at)

    photo = store.attach_photo(
        case_id=case_id,
        image_bytes=await image.read(),
        lat=lat,
        lon=lon,
        accuracy_m=accuracy_m,
        captured_at=when,
        step_id=step_id,
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Case not found")

    return {
        "photo_id": photo.photo_id,
        "location_verified": photo.location_verified,
        "captured_at": photo.captured_at,
    }


@router.get("/cases/{case_id}/photo/{photo_id}")
async def get_photo(case_id: str, photo_id: str) -> Response:
    case = store.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    photo = next((p for p in case.photos if p.photo_id == photo_id), None)
    if photo is None or not Path(photo.path).exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    return Response(content=Path(photo.path).read_bytes(), media_type="image/jpeg")
