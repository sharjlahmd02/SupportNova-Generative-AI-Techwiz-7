from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from enum import Enum
import json


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
    "prior_complaint_ref",
    "requested_resolution",
)


class ComplaintIn(BaseModel):
    title: str
    description: str
    customer_type: Optional[str] = None
    product_service: Optional[str] = None
    order_ref: Optional[str] = None
    channel: Optional[str] = None
    attachments: Optional[Union[Dict[str, Any], List[Any], str]] = None
    prior_complaint_ref: Optional[str] = None
    requested_resolution: Optional[str] = None

    @field_validator("title", "description")
    @classmethod
    def _reject_blank_text(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("must not be empty")
        return cleaned

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
        return self


class ComplaintOut(ComplaintIn):
    id: int
    status: str
    customer_id: Optional[int] = None
    date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

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

    class Config:
        from_attributes = True
