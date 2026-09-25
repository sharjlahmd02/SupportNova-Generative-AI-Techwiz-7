from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from typing import Optional, List, Dict, Any, Union, ClassVar
from enum import Enum
import json
import re

from app.security.input_sanitizer import sanitize_text


class Sentiment(str, Enum):
    positive = "Positive"
    neutral = "Neutral"
    negative = "Negative"
    strongly_negative = "Strongly Negative"


class Urgency(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"


class Priority(str, Enum):
    p3 = "P3"
    p2 = "P2"
    p1 = "P1"
    p0 = "P0"


class EscalationLevel(str, Enum):
    no_escalation = "No Escalation"
    supervisor_review = "Supervisor Review"
    department_manager = "Department Manager"
    specialist_team = "Specialist Team"
    compliance_review = "Compliance Review"
    critical_management = "Critical Management Escalation"


class VerificationStatus(str, Enum):
    verified = "verified"
    mismatch = "mismatch"
    manual_review = "manual_review"


class Entities(BaseModel):
    product: Optional[str] = None
    order_id: Optional[str] = None
    transaction_id: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    location: Optional[str] = None


class IntelligenceOutput(BaseModel):
    complaint_id: str
    primary_issue: str
    secondary_issue: Optional[str] = None
    issue_category: str
    subcategory: str
    sentiment: Sentiment
    urgency: Urgency
    priority: Priority
    entities: Entities = Field(default_factory=Entities)
    department: str
    secondary_department: Optional[str] = None
    policy_id: Optional[str] = None
    policy_section: Optional[str] = None
    resolution_steps: List[str] = Field(default_factory=list)
    escalation_required: bool = False
    escalation_reason: Optional[str] = None
    escalation_level: EscalationLevel = EscalationLevel.no_escalation
    response_type: Optional[str] = None
    customer_response: Optional[str] = None
    follow_up_required: bool = False
    follow_up_message: Optional[str] = None
    clarification_questions: List[str] = Field(default_factory=list)
    agent_guidance: List[str] = Field(default_factory=list)
    prompt_version: str
    model: str
    analysis_timestamp: datetime


class ValidationOutput(IntelligenceOutput):
    verification_status: VerificationStatus
    mismatch_reasons: List[str] = Field(default_factory=list)


OPTIONAL_TEXT_FIELDS = (
    "customer_type",
    "product_service",
    "order_ref",
    "channel",
    "preferred_contact",
    "prior_complaint_ref",
    "requested_resolution",
)

# TravelNova (doc/company) — loyalty-tier customer classification, from the
# complaint dataset's `customer_type` column.
CUSTOMER_TYPES = (
    "regular",
    "new",
    "silver",
    "gold",
    "platinum",
    "diamond",
    "corporate",
)
# TravelNova intake channels (complaints_dataset) plus the SRS document-upload path.
INTAKE_CHANNELS = (
    "web_form",
    "email",
    "phone",
    "live_chat",
    "social_media",
    "mobile_app",
    "document_upload",
)
# The medium the customer agrees to be contacted on.
CONTACT_CHANNELS = ("web_form", "email", "phone", "live_chat", "mobile_app")
# Reference list for the product/service picker — free text is still accepted, so
# legacy rows and free-form answers are never rejected.
PRODUCT_SERVICES = (
    "flight",
    "hotel",
    "cruise",
    "car_rental",
    "tour",
    "package",
    "transfer",
    "travel_insurance",
    "multiple",
    "unknown",
)

# Older builds and the imported dataset used different spellings for the same
# concept. Anything not listed here falls through to the slug of the raw value.
CHOICE_ALIASES = {
    "customer_type": {
        "individual": "regular",
        "vip": "gold",
        "vip_gold": "gold",
        "first_time": "new",
        "gold_member": "gold",
        "guest": "new",
    },
    "channel": {
        "web": "web_form",
        "web_portal": "web_form",
        "in_app": "mobile_app",
        "in_app_chat": "live_chat",
        "portal": "web_form",
    },
    "preferred_contact": {
        "web": "web_form",
        "web_portal": "web_form",
        "in_app": "mobile_app",
        "in_app_chat": "live_chat",
        "portal": "web_form",
    },
}


def normalise_choice(field: str, value: Optional[str]) -> Optional[str]:
    """Map a raw stored/submitted value onto its canonical TravelNova spelling.

    Returns ``None`` when the value cannot be mapped — callers decide whether
    that is a validation error (input) or simply "not provided" (output).
    """
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None

    slug = re.sub(r"[^a-z0-9]+", "_", raw.lower()).strip("_")
    if not slug:
        return None

    aliased = CHOICE_ALIASES.get(field, {}).get(slug, slug)
    allowed = {
        "customer_type": CUSTOMER_TYPES,
        "channel": INTAKE_CHANNELS,
        "preferred_contact": CONTACT_CHANNELS,
        "product_service": PRODUCT_SERVICES,
    }.get(field)
    if allowed is None:
        return aliased
    return aliased if aliased in allowed else None


class ComplaintIn(BaseModel):
    # Input is strict: a choice outside the TravelNova vocabulary is a 422.
    STRICT_CHOICES: ClassVar[bool] = True

    title: str
    description: str
    customer_type: Optional[str] = None
    product_service: Optional[str] = None
    order_ref: Optional[str] = None
    channel: Optional[str] = None
    preferred_contact: Optional[str] = None
    attachments: Optional[Union[Dict[str, Any], List[Any], str]] = None
    prior_complaint_ref: Optional[str] = None
    requested_resolution: Optional[str] = None

    @field_validator("title", "description")
    @classmethod
    def _reject_blank_text(cls, value: str) -> str:
        cleaned = sanitize_text(value)
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

    @field_validator(
        "customer_type",
        "product_service",
        "order_ref",
        "channel",
        "preferred_contact",
        "prior_complaint_ref",
        "requested_resolution",
    )
    @classmethod
    def _normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return sanitize_text(value, max_length=2000)

    @classmethod
    def _restrict_choice(cls, field: str, value: Optional[str]) -> Optional[str]:
        """Normalise a choice field; reject unmapped values on the way in."""
        if value is None or value == "":
            return None
        canonical = normalise_choice(field, value)
        if canonical is None:
            if not cls.STRICT_CHOICES:
                # Output side: a legacy row must never break serialisation.
                return None
            allowed = {
                "customer_type": CUSTOMER_TYPES,
                "channel": INTAKE_CHANNELS,
                "preferred_contact": CONTACT_CHANNELS,
            }[field]
            raise ValueError(f"must be one of: {', '.join(allowed)}")
        return canonical

    @field_validator("customer_type")
    @classmethod
    def _validate_customer_type(cls, value: Optional[str]) -> Optional[str]:
        return cls._restrict_choice("customer_type", value)

    @field_validator("channel")
    @classmethod
    def _validate_channel(cls, value: Optional[str]) -> Optional[str]:
        return cls._restrict_choice("channel", value)

    @field_validator("preferred_contact")
    @classmethod
    def _validate_preferred_contact(cls, value: Optional[str]) -> Optional[str]:
        return cls._restrict_choice("preferred_contact", value)

    @model_validator(mode="after")
    def _normalize_empty_values(self) -> "ComplaintIn":
        """Treat form-submitted "" as "not provided" instead of a validation error."""
        for name in OPTIONAL_TEXT_FIELDS:
            value = getattr(self, name)
            if isinstance(value, str):
                setattr(self, name, value.strip() or None)

        attachments = self.attachments
        if isinstance(attachments, str):
            text = attachments.strip()
            if not text:
                self.attachments = None
            else:
                try:
                    self.attachments = json.loads(text)
                except json.JSONDecodeError:
                    self.attachments = {"raw": text}
        elif isinstance(attachments, list):
            # A pasted raw array must never be allowed to carry nested objects.
            self.attachments = [
                item if isinstance(item, dict) else {"filename": str(item)}
                for item in attachments
            ]
        return self


class ComplaintOut(ComplaintIn):
    # A legacy row must never be able to 500 a list endpoint: unmapped choice
    # values serialise as null instead of raising.
    STRICT_CHOICES: ClassVar[bool] = False

    id: int
    status: str
    customer_id: Optional[int] = None
    date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    duplicate_of: Optional[int] = None
    resolution_accepted_at: Optional[datetime] = None

    # Pipeline summaries (populated by the router; null until analyzed/validated)
    category: Optional[str] = None
    subcategory: Optional[str] = None
    department: Optional[str] = None
    sentiment: Optional[str] = None
    urgency: Optional[str] = None
    priority: Optional[str] = None
    escalation_required: Optional[bool] = None
    verification_status: Optional[str] = None
    mismatch_reasons: Optional[List[str]] = None
    clarification_questions: Optional[List[str]] = None
    resolution_steps: Optional[List[str]] = None
    customer_response: Optional[str] = None
    follow_up_message: Optional[str] = None

    class Config:
        from_attributes = True


class MessageIn(BaseModel):
    """SRS §4.3 — the customer answers a clarification request."""

    body: str
    kind: Optional[str] = "reply"

    @field_validator("body")
    @classmethod
    def _clean_body(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=4000)
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned


class MessageOut(BaseModel):
    id: int
    complaint_id: int
    author_name: str
    author_role: str
    kind: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class EventOut(BaseModel):
    id: int
    complaint_id: int
    event_type: str
    label: str
    detail: Optional[Dict[str, Any]] = None
    actor: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DuplicateCheckIn(BaseModel):
    """SRS §6 — duplicate submission warning before the ticket is created."""

    title: str
    description: Optional[str] = None

    @field_validator("title")
    @classmethod
    def _clean_title(cls, value: str) -> str:
        cleaned = sanitize_text(value)
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned


class DuplicateCandidate(BaseModel):
    id: int
    title: str
    status: str
    similarity: float
    created_at: datetime

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    filename: str
    original_name: str
    content_type: str
    size: int
    url: str
