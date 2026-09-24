from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

from app.schemas.complaint import VerificationStatus


class ReviewCaseIn(BaseModel):
    complaint_id: int
    genai_result: Dict[str, Any]
    python_result: Dict[str, Any]
    diff: Dict[str, Any]


class ReviewCaseOut(ReviewCaseIn):
    id: int
    reviewer_action: Optional[str] = None
    reviewer_notes: Optional[str] = None
    audit_log: Optional[Dict[str, Any]] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewActionIn(BaseModel):
    action: str
    notes: Optional[str] = None
    modified_result: Optional[Dict[str, Any]] = None