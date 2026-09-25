from pydantic import BaseModel, field_validator
from typing import List, Optional, Union, Dict, Any


class RuleMatrixEntry(BaseModel):
    rule_id: str
    category: str
    subcategory: str
    # doc/company stores free-text criteria such as ["Incorrect booking details"].
    conditions: Union[Dict[str, Any], List[Any], str, None] = None
    department: str
    department_name: Optional[str] = None
    urgency: str
    priority: str
    policy_id: str
    escalation_trigger: Union[Dict[str, Any], bool, None] = False
    required_actions: Optional[List[str]] = None
    prohibited_actions: Optional[List[str]] = None
    follow_up_rule: Optional[str] = None
    follow_up_days: Optional[int] = None

    @field_validator("escalation_trigger", mode="before")
    @classmethod
    def _coerce_trigger(cls, value: Any) -> Any:
        # Older exports used a bare "escalation_required" boolean.
        if value is None:
            return False
        return value


class RuleMatrixIn(BaseModel):
    rules: List[RuleMatrixEntry]
