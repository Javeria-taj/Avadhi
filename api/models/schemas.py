"""Data shapes for the whole system. This file IS the interface contract.

Freeze this at T+4. If a field changes after that, both people stop and re-sync.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Loss events we can currently reason about.

    Adding a value here means adding matching predicates in data/schemes/.
    """

    HAILSTORM = "hailstorm"
    LANDSLIDE = "landslide"
    INUNDATION = "inundation"
    WATERLOGGING = "waterlogging"
    CLOUDBURST = "cloudburst"
    POST_HARVEST_LOSS = "post_harvest_loss"
    ACCIDENTAL_DEATH = "accidental_death"
    DISABILITY = "disability"
    DEATH = "death"
    UNAUTHORISED_TRANSACTION = "unauthorised_transaction"
    UNKNOWN = "unknown"


class ClaimStatus(str, Enum):
    OPEN = "open"
    CLOSING_SOON = "closing_soon"
    EXPIRED = "expired"
    NEED_INFO = "need_info"


class EventReport(BaseModel):
    """What the model extracted from the person's speech.

    Note what is NOT here: no deadline, no eligibility verdict. The model
    reports what happened. It never decides anything.
    """

    event_type: EventType = EventType.UNKNOWN
    event_datetime: datetime | None = None
    event_datetime_raw: str | None = Field(
        default=None,
        description="Relative phrase as spoken, e.g. 'last night'. Resolved in code, not by the model.",
    )
    crop: str | None = None
    area_acres: float | None = None
    loss_scope: str | None = None
    district: str | None = None
    state: str | None = None

    has_pmfby_policy: bool | None = None
    has_pmsby: bool | None = None
    has_pmjjby: bool | None = None
    has_bank_account: bool | None = None
    age_at_event: int | None = None

    # Bank-fraud vertical. The RBI clock runs from the BANK'S communication,
    # not from when the customer noticed - so these are separate fields.
    bank_communication_datetime: datetime | None = None
    bank_communication_raw: str | None = None
    transaction_amount: float | None = None

    policy_number: str | None = None
    missing_fields: list[str] = Field(default_factory=list)
    confidence: dict[str, float] = Field(default_factory=dict)

    def get(self, field: str) -> Any:
        return getattr(self, field, None)


class ClaimWindow(BaseModel):
    """One scheme's clock, as computed by the deterministic engine."""

    rule_id: str
    scheme_name_en: str
    scheme_name_kn: str
    status: ClaimStatus
    deadline_iso: datetime | None = None
    hours_remaining: float | None = None
    matched_rules: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)

    # Kannada fields are always populated, whatever language was requested.
    evidence_checklist_kn: list[str] = Field(default_factory=list)
    explanation_kn: str | None = None
    failure_consequence_kn: str | None = None

    # Language-neutral fields hold the ACTIVE language. Prefer these in the UI.
    lang: str = "kn"
    scheme_name: str | None = None
    evidence_checklist: list[str] = Field(default_factory=list)
    explanation: str | None = None
    failure_consequence: str | None = None
    source_url: str | None = None
    verified_on: str | None = None
    form_id: str | None = None


class FieldConfidence(BaseModel):
    """A value the model read off a document, plus how sure it was.

    Nothing extracted from an image is used until confirmed. A wrong policy
    number produces a wrong intimation, so the human is always the last step.
    """

    value: str | None = None
    confidence: float = 0.0
    confirmed: bool = False


class Profile(BaseModel):
    """What the app remembers about the person, so reporting takes 30 seconds.

    Deliberately absent: Aadhaar. It is not required to intimate a claim, and
    storing it would be liability with no benefit. Say this to judges.
    """

    profile_id: str = "me"
    updated_at: datetime | None = None

    name: str | None = None
    mobile: str | None = None
    district: str | None = None
    state: str | None = "KA"

    # Crop insurance
    pmfby_policy_number: FieldConfidence = Field(default_factory=FieldConfidence)
    insurer: FieldConfidence = Field(default_factory=FieldConfidence)
    survey_numbers: list[str] = Field(default_factory=list)
    crop: str | None = None
    land_acres: float | None = None
    season: str | None = None

    # Banking. Full number stored locally; display uses the last four only.
    bank_account_number: FieldConfidence = Field(default_factory=FieldConfidence)
    bank_ifsc: FieldConfidence = Field(default_factory=FieldConfidence)
    bank_branch: str | None = None

    has_pmfby_policy: bool | None = None
    has_bank_account: bool | None = None

    scanned_documents: list[str] = Field(default_factory=list)

    def completeness(self) -> float:
        """Fraction of the useful fields we have. Drives the quiet nudge on the
        home screen - never a blocking wall."""
        checks = [
            bool(self.mobile),
            bool(self.district),
            self.pmfby_policy_number.confirmed,
            bool(self.survey_numbers),
            self.bank_account_number.confirmed,
        ]
        return round(sum(checks) / len(checks), 2)

    def account_last4(self) -> str | None:
        number = self.bank_account_number.value
        return number[-4:] if number and len(number) >= 4 else None


class DocumentKind(str, Enum):
    PMFBY_CERTIFICATE = "pmfby_certificate"
    BANK_PASSBOOK = "bank_passbook"
    LAND_RECORD = "land_record"


class ScanResult(BaseModel):
    kind: DocumentKind
    fields: dict[str, FieldConfidence] = Field(default_factory=dict)
    needs_confirmation: list[str] = Field(default_factory=list)
    raw_text: str | None = None


class CaseState(str, Enum):
    OPEN = "open"
    REPORTED = "reported"
    SURVEYED = "surveyed"
    SETTLED = "settled"
    EXPIRED = "expired"


class Photo(BaseModel):
    photo_id: str
    path: str
    lat: float | None = None
    lon: float | None = None
    accuracy_m: float | None = None
    captured_at: datetime | None = None
    # False when the user denied location permission. We still keep the photo -
    # an unverified photo beats no photo - but we never claim it is verified.
    location_verified: bool = False


class Step(BaseModel):
    step_id: str
    text_kn: str
    done: bool = False
    needs_photo: bool = False
    photo_id: str | None = None


class Case(BaseModel):
    """The persistent object. This is what makes the app not a chatbot:
    it survives the session and the clock keeps running."""

    case_id: str
    created_at: datetime
    rule_id: str
    event: EventReport
    claim: ClaimWindow
    state: CaseState = CaseState.OPEN
    steps: list[Step] = Field(default_factory=list)
    photos: list[Photo] = Field(default_factory=list)
    reminders_sent: list[str] = Field(default_factory=list)


class IntakeResponse(BaseModel):
    transcript: str
    lang: str = "kn"
    event: EventReport
    claims: list[ClaimWindow]
    case_id: str | None = None
    clarifying_question_kn: str | None = None
    clarifying_options_kn: list[str] = Field(default_factory=list)
    clarifying_question: str | None = None
    clarifying_options: list[str] = Field(default_factory=list)
    needs_date_confirmation: bool = False


class DocumentRequest(BaseModel):
    rule_id: str
    event: EventReport


class StepUpdate(BaseModel):
    done: bool


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    asr_ready: bool
    rules_loaded: int
    backend: str = "unknown"
    model_name: str = "unknown"
    # "local" (offline, on the demo machine) or "hosted" (the submission link)
    deployment: str = "local"
