from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class EventType(str, Enum):
    HAILSTORM = "hailstorm"
    LANDSLIDE = "landslide"
    INUNDATION = "inundation"
    WATERLOGGING = "waterlogging"
    CLOUDBURST = "cloudburst"
    POST_HARVEST_LOSS = "post_harvest_loss"
    ACCIDENTAL_DEATH = "accidental_death"
    DISABILITY = "disability"
    DEATH = "death"
    UNKNOWN = "unknown"
    UNAUTHORISED_TRANSACTION = "unauthorised_transaction"


class EventReport(BaseModel):
    event_type: EventType
    event_datetime: datetime | None = None
    event_datetime_raw: str | None = None
    crop: str | None = None
    area_acres: float | None = None
    district: str | None = None
    has_pmfby_policy: bool | None = None
    has_pmsby: bool | None = None
    has_pmjjby: bool | None = None
    age_at_event: int | None = None
    policy_number: str | None = None
    bank_communication_datetime: datetime | None = None
    has_bank_account: bool | None = None
    transaction_amount: float | None = None
    confidence: dict[str, float] = Field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)


class ClaimStatus(str, Enum):
    OPEN = "open"
    CLOSING_SOON = "closing_soon"
    EXPIRED = "expired"
    NEED_INFO = "need_info"


class ClaimWindow(BaseModel):
    rule_id: str
    scheme_name_en: str
    scheme_name_kn: str
    status: ClaimStatus
    deadline_iso: datetime | None = None
    hours_remaining: float | None = None
    matched_rules: list[str] = Field(default_factory=list)
    missing_info: list[str] = Field(default_factory=list)
    evidence_checklist_kn: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)
    explanation_kn: str | None = None
    failure_consequence_kn: str | None = None
    source_url: str
    verified_on: str
    form_id: str | None = None


class CaseState(str, Enum):
    OPEN = "OPEN"
    EXPIRED = "EXPIRED"
    REPORTED = "REPORTED"
    SURVEYED = "SURVEYED"
    SETTLED = "SETTLED"


class Step(BaseModel):
    step_id: str
    text_kn: str
    needs_photo: bool
    done: bool = False
    photo_id: str | None = None


class Photo(BaseModel):
    photo_id: str
    path: str
    lat: float | None = None
    lon: float | None = None
    accuracy_m: float | None = None
    captured_at: datetime
    location_verified: bool


class Case(BaseModel):
    case_id: str
    created_at: datetime
    rule_id: str
    event: EventReport
    claim: ClaimWindow
    state: CaseState
    steps: list[Step] = Field(default_factory=list)
    photos: list[Photo] = Field(default_factory=list)


class StepUpdate(BaseModel):
    done: bool


class IntakeResponse(BaseModel):
    transcript: str
    event: EventReport
    claims: list[ClaimWindow]
    clarifying_question_kn: str | None = None
    needs_date_confirmation: bool
    case_id: str | None = None


class DocumentRequest(BaseModel):
    rule_id: str
    event: EventReport


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    asr_ready: bool
    rules_loaded: int
