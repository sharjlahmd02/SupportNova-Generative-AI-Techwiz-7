from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.db.models import RuleMatrixEntry


def check_escalation_required(
    db: Session,
    category: str,
    subcategory: str,
    complaint_data: Dict[str, Any],
) -> tuple[bool, Optional[str], Optional[str]]:
    rule = db.query(RuleMatrixEntry).filter(
        RuleMatrixEntry.category == category,
        RuleMatrixEntry.subcategory == subcategory,
    ).first()

    if not rule or not rule.escalation_trigger:
        return False, None, None

    trigger = rule.escalation_trigger
    # TODO: evaluate trigger conditions against complaint_data
    # For now, return the rule's escalation info if trigger is boolean true
    if isinstance(trigger, bool) and trigger:
        return True, f"Escalation triggered by rule {rule.rule_id}", rule.priority
    elif isinstance(trigger, dict):
        # TODO: evaluate complex conditions
        pass

    return False, None, None