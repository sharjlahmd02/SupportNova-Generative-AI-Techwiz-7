from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


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


class ComplaintIn(BaseModel):
    title: str
    description: str
    customer_type: Optional[str] = None
    product_service: Optional[str] = None
    order_ref: Optional[str] = None
    channel: Optional[str] = None
    attachments: Optional[Dict[str, Any]] = None
    prior_complaint_ref: Optional[str] = None
    requested_resolution: Optional[str] = None


class ComplaintOut(ComplaintIn):
    id: int
    status: str
    customer_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True