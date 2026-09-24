from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class DashboardStats(BaseModel):
    total_complaints: int
    by_status: Dict[str, int]
    by_category: Dict[str, int]
    by_department: Dict[str, int]
    by_priority: Dict[str, int]
    by_sentiment: Dict[str, int]
    escalation_count: int
    mismatch_count: int
    manual_review_count: int
    avg_resolution_time_hours: Optional[float] = None


class ReportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    category: Optional[str] = None
    department: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None