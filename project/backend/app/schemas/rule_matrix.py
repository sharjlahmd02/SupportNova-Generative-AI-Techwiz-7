from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class RuleMatrixEntry(BaseModel):
    rule_id: str
    category: str
    subcategory: str
    conditions: Dict[str, Any]
    department: str
    urgency: str
    priority: str
    policy_id: str
    escalation_trigger: Dict[str, Any]
    required_actions: Optional[List[str]] = None
    prohibited_actions: Optional[List[str]] = None
    follow_up_rule: Optional[str] = None


class RuleMatrixIn(BaseModel):
    rules: List[RuleMatrixEntry]