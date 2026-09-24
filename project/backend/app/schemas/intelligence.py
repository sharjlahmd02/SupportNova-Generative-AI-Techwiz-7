from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

from app.schemas.complaint import (
    IntelligenceOutput,
    ValidationOutput,
    Entities,
    Sentiment,
    Urgency,
    Priority,
    EscalationLevel,
    VerificationStatus,
)

IntelligenceSchema = IntelligenceOutput
ValidationSchema = ValidationOutput