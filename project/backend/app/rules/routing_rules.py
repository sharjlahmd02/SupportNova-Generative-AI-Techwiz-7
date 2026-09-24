from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.db.models import RuleMatrixEntry
from app.rules.rule_matrix import get_all_rules


def get_department_for_category(db: Session, category: str, subcategory: str) -> Optional[str]:
    rule = db.query(RuleMatrixEntry).filter(
        RuleMatrixEntry.category == category,
        RuleMatrixEntry.subcategory == subcategory,
    ).first()
    return rule.department if rule else None


def get_urgency_for_category(db: Session, category: str, subcategory: str) -> Optional[str]:
    rule = db.query(RuleMatrixEntry).filter(
        RuleMatrixEntry.category == category,
        RuleMatrixEntry.subcategory == subcategory,
    ).first()
    return rule.urgency if rule else None


def get_escalation_rules(db: Session) -> List[Dict[str, Any]]:
    rules = get_all_rules(db)
    return [
        {
            "rule_id": r.rule_id,
            "category": r.category,
            "subcategory": r.subcategory,
            "escalation_trigger": r.escalation_trigger,
        }
        for r in rules
        if r.escalation_trigger
    ]