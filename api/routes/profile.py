"""Profile and document-scan endpoints.

Backs S0 (first run) and S0b (confirm what was read).
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from api.models.schemas import DocumentKind, Profile, ScanResult
from api.services import profile as store
from api.services.document_scan import scan_document

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/profile", response_model=Profile)
async def get_profile() -> Profile:
    """Always 200. A first-run user gets an empty profile, never a 404 -
    onboarding must never look like an error."""
    return store.get_profile()


@router.get("/profile/completeness")
async def completeness() -> dict:
    profile = store.get_profile()
    return {
        "completeness": profile.completeness(),
        "scanned_documents": profile.scanned_documents,
        "account_last4": profile.account_last4(),
        "has_pmfby_policy": profile.has_pmfby_policy,
    }


@router.post("/profile/scan", response_model=ScanResult)
async def scan(
    image: UploadFile = File(...),
    kind: DocumentKind = Form(...),
) -> ScanResult:
    """Read a document. Returns proposed values - saves nothing.

    Nothing is persisted here on purpose. The person confirms first.
    """
    return scan_document(await image.read(), kind)


@router.post("/profile/confirm", response_model=Profile)
async def confirm(
    kind: DocumentKind = Form(...),
    fields: str = Form(...),
    scan_confidences: str | None = Form(None),
) -> Profile:
    """Save the fields the person approved on screen.

    `fields` is JSON: {"pmfby_policy_number": "PMFBY/KA/2026/8841", ...}
    Values may be edited by the person - what arrives here is what gets saved.
    """
    try:
        confirmed = json.loads(fields)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="fields must be a JSON object") from exc

    if not isinstance(confirmed, dict):
        raise HTTPException(status_code=422, detail="fields must be a JSON object")

    original = ScanResult(kind=kind)
    if scan_confidences:
        try:
            original = ScanResult(**json.loads(scan_confidences))
        except (json.JSONDecodeError, ValueError):
            log.warning("Ignoring unparseable scan_confidences")

    return store.apply_scan(original, confirmed)


@router.post("/profile/reset", response_model=Profile)
async def reset() -> Profile:
    """Wipe the profile. Needed between demo runs."""
    store.reset_profile()
    return store.get_profile()
