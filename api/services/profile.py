"""Profile persistence.

One profile per device, at data/profile.json. No accounts, no auth, no login -
the person who holds the phone is the user. That is the correct model for a
kiosk or an assisted-operator deployment, and it is one less barrier.
"""
from __future__ import annotations

import json
import logging
import threading
from pathlib import Path

from api.config import settings
from api.models.schemas import DocumentKind, FieldConfidence, Profile, ScanResult
from api.rules.engine import now_ist

log = logging.getLogger(__name__)
_lock = threading.Lock()

# Scanned field name -> Profile attribute. Anything not listed here is ignored,
# so a model that invents a field cannot write into the profile.
_FIELD_MAP = {
    "pmfby_policy_number": "pmfby_policy_number",
    "insurer": "insurer",
    "bank_account_number": "bank_account_number",
    "bank_ifsc": "bank_ifsc",
}
_PLAIN_MAP = {
    "crop": "crop",
    "bank_branch": "bank_branch",
    "name": "name",
    "district": "district",
    "season": "season",
}


def _profile_file() -> Path:
    return Path(settings.data_dir) / "profile.json"


def get_profile() -> Profile:
    """Always returns a Profile. A first-run user gets an empty one."""
    path = _profile_file()
    if not path.exists():
        return Profile()
    try:
        return Profile(**json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, ValueError):
        log.error("profile.json is unreadable; starting from an empty profile")
        return Profile()


def save_profile(profile: Profile) -> Profile:
    profile.updated_at = now_ist()
    with _lock:
        path = _profile_file()
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(
            profile.model_dump_json(indent=2), encoding="utf-8"
        )
        tmp.replace(path)
    return profile


def apply_scan(scan: ScanResult, confirmed_fields: dict[str, str]) -> Profile:
    """Merge a confirmed scan into the profile.

    `confirmed_fields` is what the PERSON approved on screen, not what the model
    read. A field the person did not confirm is not written. This is where the
    "model proposes, human decides" rule is actually enforced.
    """
    profile = get_profile()

    for name, value in confirmed_fields.items():
        cleaned = (value or "").strip()
        if not cleaned:
            continue

        if name in _FIELD_MAP:
            original = scan.fields.get(name)
            setattr(
                profile,
                _FIELD_MAP[name],
                FieldConfidence(
                    value=cleaned,
                    confidence=original.confidence if original else 1.0,
                    confirmed=True,
                ),
            )
        elif name in _PLAIN_MAP:
            setattr(profile, _PLAIN_MAP[name], cleaned)
        elif name == "land_acres":
            try:
                profile.land_acres = float(cleaned)
            except ValueError:
                log.warning("Ignoring unparseable land_acres: %r", cleaned)
        elif name == "survey_numbers":
            numbers = [s.strip() for s in cleaned.split(",") if s.strip()]
            profile.survey_numbers = sorted(set(profile.survey_numbers) | set(numbers))

    if profile.pmfby_policy_number.confirmed:
        profile.has_pmfby_policy = True
    if profile.bank_account_number.confirmed:
        profile.has_bank_account = True

    if scan.kind.value not in profile.scanned_documents:
        profile.scanned_documents.append(scan.kind.value)

    return save_profile(profile)


def prefill_event(event, profile: Profile | None = None):
    """Fill event fields the profile already knows.

    This is what makes the second report take 30 seconds. It only fills fields
    the speech did NOT provide - what the person just said always wins over what
    we remembered.
    """
    profile = profile or get_profile()

    if event.has_pmfby_policy is None and profile.has_pmfby_policy is not None:
        event.has_pmfby_policy = profile.has_pmfby_policy
    if event.has_bank_account is None and profile.has_bank_account is not None:
        event.has_bank_account = profile.has_bank_account
    if event.policy_number is None and profile.pmfby_policy_number.confirmed:
        event.policy_number = profile.pmfby_policy_number.value
    if event.district is None and profile.district:
        event.district = profile.district
    if event.state is None and profile.state:
        event.state = profile.state
    if event.crop is None and profile.crop:
        event.crop = profile.crop
    if event.area_acres is None and profile.land_acres:
        event.area_acres = profile.land_acres

    return event


def reset_profile() -> None:
    """For tests, and for the demo reset button."""
    path = _profile_file()
    if path.exists():
        path.unlink()
