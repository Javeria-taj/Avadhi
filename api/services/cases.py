"""Case persistence.

Why a Case exists
-----------------
Without this, the product is a question-answering service: you ask, it replies,
it forgets. The Case is what makes the clock keep running after the user closes
the app - which is the whole difference between this and a chatbot.

Storage is a single JSON file. No database, deliberately: a 36-hour prototype
that ships a Postgres schema it does not need is showing off, not engineering.
Reads and writes are whole-file, which is fine for one user on one device and
would not be fine for anything real.
"""
from __future__ import annotations

import json
import logging
import secrets
import threading
from datetime import datetime
from pathlib import Path

from api.config import settings
from api.models.schemas import (
    Case,
    CaseState,
    ClaimStatus,
    ClaimWindow,
    EventReport,
    Photo,
    Step,
)
from api.rules.engine import now_ist

log = logging.getLogger(__name__)

def _cases_file() -> Path:
    return Path(settings.data_dir) / "cases.json"


def _photos_dir() -> Path:
    return Path(settings.data_dir) / "photos"

# Whole-file rewrites from multiple requests would interleave without this.
_lock = threading.Lock()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(3)}"


def _read_all() -> dict[str, dict]:
    if not _cases_file().exists():
        return {}
    try:
        with _cases_file().open(encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        # A corrupt store must not take down the app mid-demo. Move it aside
        # and start clean, loudly.
        log.error("cases.json is corrupt; moving it aside and starting fresh")
        _cases_file().rename(_cases_file().with_suffix(".corrupt.json"))
        return {}


def _write_all(payload: dict[str, dict]) -> None:
    _cases_file().parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp file then replace, so a crash mid-write cannot leave a
    # truncated store.
    tmp = _cases_file().with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, default=str)
    tmp.replace(_cases_file())


def _steps_from_claim(claim: ClaimWindow) -> list[Step]:
    """Turn the evidence checklist into trackable steps.

    Photo steps are marked by position: the first four PMFBY steps are camera
    actions, the rest are instructions. Rules could carry this explicitly - a
    `needs_photo` flag per checklist item - and should if there is time.
    """
    steps: list[Step] = []
    for index, text in enumerate(claim.evidence_checklist_kn, start=1):
        needs_photo = any(
            marker in text for marker in ("ಫೋಟೋ", "ಸ್ಕ್ರೀನ್‌ಶಾಟ್")
        )
        steps.append(
            Step(step_id=f"s{index}", text_kn=text, needs_photo=needs_photo)
        )
    return steps


def _refresh_state(case: Case, claim: ClaimWindow) -> Case:
    """Recompute derived state. The claim is recomputed on every read so the
    countdown is never stale, but a case the user has already reported must not
    flip back to expired."""
    case.claim = claim
    if case.state in (CaseState.REPORTED, CaseState.SURVEYED, CaseState.SETTLED):
        return case
    case.state = (
        CaseState.EXPIRED if claim.status is ClaimStatus.EXPIRED else CaseState.OPEN
    )
    return case


def create_case(event: EventReport, claim: ClaimWindow) -> Case:
    case = Case(
        case_id=_new_id("c"),
        created_at=now_ist(),
        rule_id=claim.rule_id,
        event=event,
        claim=claim,
        state=(
            CaseState.EXPIRED
            if claim.status is ClaimStatus.EXPIRED
            else CaseState.OPEN
        ),
        steps=_steps_from_claim(claim),
    )
    with _lock:
        payload = _read_all()
        payload[case.case_id] = json.loads(case.model_dump_json())
        _write_all(payload)
    return case


def get_case(case_id: str) -> Case | None:
    raw = _read_all().get(case_id)
    return Case(**raw) if raw else None


def list_cases() -> list[Case]:
    """All cases, most urgent first. Expired cases sink but are never hidden."""
    cases = [Case(**raw) for raw in _read_all().values()]

    order = {
        ClaimStatus.CLOSING_SOON: 0,
        ClaimStatus.OPEN: 1,
        ClaimStatus.NEED_INFO: 2,
        ClaimStatus.EXPIRED: 3,
    }
    return sorted(
        cases,
        key=lambda c: (order.get(c.claim.status, 9), c.claim.hours_remaining or 1e9),
    )


def save_case(case: Case) -> Case:
    with _lock:
        payload = _read_all()
        payload[case.case_id] = json.loads(case.model_dump_json())
        _write_all(payload)
    return case


def recompute(case: Case) -> Case:
    """Re-run the rules engine so hours_remaining reflects the current time."""
    from api.rules.engine import evaluate
    from api.rules.loader import load_rules

    claims = evaluate(case.event, load_rules())
    claim = next((c for c in claims if c.rule_id == case.rule_id), None)
    return _refresh_state(case, claim) if claim else case


def set_step_done(case_id: str, step_id: str, done: bool) -> Case | None:
    case = get_case(case_id)
    if case is None:
        return None
    for step in case.steps:
        if step.step_id == step_id:
            step.done = done
            break
    else:
        return None
    return save_case(case)


def attach_photo(
    case_id: str,
    image_bytes: bytes,
    lat: float | None,
    lon: float | None,
    accuracy_m: float | None,
    captured_at: datetime | None,
    step_id: str | None = None,
) -> Photo | None:
    """Store a photo and link it to a step.

    A photo with no coordinates is still stored. The user may have denied
    location permission, and an unverified photo beats no photo - but
    location_verified stays False so we never overclaim.
    """
    case = get_case(case_id)
    if case is None:
        return None

    _photos_dir().mkdir(parents=True, exist_ok=True)
    photo_id = _new_id("p")
    path = _photos_dir() / f"{photo_id}.jpg"
    path.write_bytes(image_bytes)

    photo = Photo(
        photo_id=photo_id,
        path=str(path),
        lat=lat,
        lon=lon,
        accuracy_m=accuracy_m,
        captured_at=captured_at or now_ist(),
        location_verified=lat is not None and lon is not None,
    )
    case.photos.append(photo)

    if step_id:
        for step in case.steps:
            if step.step_id == step_id:
                step.photo_id = photo_id
                step.done = True
                break

    save_case(case)
    return photo


def advance_state(case_id: str, state: CaseState) -> Case | None:
    case = get_case(case_id)
    if case is None:
        return None
    case.state = state
    return save_case(case)
