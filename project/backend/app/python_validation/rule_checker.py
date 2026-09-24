from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.db.models import RuleMatrixEntry

CATEGORY_KEYWORDS = {
    "Billing": ["refund", "charge", "invoice", "billing", "payment", "price", "overcharg", "subscription fee"],
    "Technical": ["outage", "crash", "bug", "error", "slow", "lag", "downtime", "not working", "fail", "performance"],
    "Account": ["login", "password", "account", "access", "locked", "privacy", "data", "delete account", "sign in"],
    "Shipping": ["delivery", "shipping", "parcel", "package", "arrive", "tracking", "courier", "lost package"],
    "Product": ["broken", "defect", "damaged", "quality", "faulty", "worn", "scratch", "missing part"],
    "Service": ["staff", "rude", "support", "agent", "wait", "hold", "response", "attitude", "unprofessional"],
    "Subscription": ["subscription", "auto-renew", "autorenew", "cancel subscription", "renewal"],
}

SUBCATEGORY_KEYWORDS = {
    ("Billing", "Incorrect Charge"): ["wrong charge", "incorrect charge", "overcharg", "charged twice", "double charge"],
    ("Billing", "Refund Request"): ["refund", "money back", "return payment", "reimburse"],
    ("Technical", "Service Outage"): ["outage", "down", "offline", "cannot connect", "unavailable", "downtime"],
    ("Technical", "Performance Issue"): ["slow", "lag", "performance", "freezes", "timeout"],
    ("Account", "Access Issue"): ["cannot login", "can't log", "locked out", "password", "access denied", "sign in"],
    ("Account", "Data Privacy"): ["privacy", "gdpr", "delete my data", "personal data", "data breach"],
    ("Shipping", "Lost Package"): ["lost", "never arrived", "missing package", "not received"],
    ("Shipping", "Delayed Delivery"): ["late", "delayed", "not arrived", "overdue", "still waiting"],
    ("Product", "Defective Product"): ["broken", "defect", "faulty", "damaged", "does not work"],
    ("Product", "Feature Request"): ["feature request", "please add", "would be nice", "suggestion"],
    ("Service", "Poor Service Quality"): ["rude", "unprofessional", "attitude", "poor service", "bad service"],
    ("Service", "Staff Conduct"): ["staff conduct", "employee behavior", "harassment", "misconduct"],
    ("Subscription", "Cancellation Issue"): ["cancel", "cancellation", "cannot cancel"],
    ("Subscription", "Auto-Renewal Dispute"): ["auto-renew", "autorenew", "renewed without", "charged for renewal"],
    ("General", "Other"): [],
}


def classify_category_subcategory(text: str) -> Tuple[str, str]:
    lowered = text.lower()
    best_category = "General"
    best_score = 0
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in lowered)
        if score > best_score:
            best_score = score
            best_category = category
    if best_score == 0:
        best_category = "General"

    best_sub = "Other"
    best_sub_score = 0
    for (cat, sub), keywords in SUBCATEGORY_KEYWORDS.items():
        if cat != best_category:
            continue
        score = sum(1 for kw in keywords if kw in lowered)
        if score > best_sub_score:
            best_sub_score = score
            best_sub = sub
    if best_sub_score == 0:
        if best_category == "General":
            best_sub = "Other"
        else:
            # fall back to first subcategory for the category
            for (cat, sub) in SUBCATEGORY_KEYWORDS:
                if cat == best_category:
                    best_sub = sub
                    break
    return best_category, best_sub


def evaluate_escalation_trigger(trigger: Any, complaint_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    if trigger is True:
        return True, "Rule marks this category as auto-escalation"
    if not isinstance(trigger, dict):
        return False, None

    amount = complaint_data.get("amount")
    if "amount_threshold" in trigger and isinstance(amount, (int, float)):
        if amount > trigger["amount_threshold"]:
            return True, f"Amount {amount} exceeds threshold {trigger['amount_threshold']}"

    if trigger.get("is_vip") and str(complaint_data.get("customer_type", "")).lower() == "vip":
        return True, "VIP customer escalation"

    duration = complaint_data.get("issue_duration_hours")
    if "duration_hours" in trigger and isinstance(duration, (int, float)):
        if duration > trigger["duration_hours"]:
            return True, f"Duration {duration}h exceeds threshold {trigger['duration_hours']}h"

    return False, None


def derive_from_rules(
    db: Session,
    complaint_text: str,
    complaint_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    complaint_data = complaint_data or {}
    category, subcategory = classify_category_subcategory(complaint_text)

    rule: Optional[RuleMatrixEntry] = (
        db.query(RuleMatrixEntry)
        .filter(
            RuleMatrixEntry.category == category,
            RuleMatrixEntry.subcategory == subcategory,
        )
        .first()
    )
    if rule is None:
        rule = (
            db.query(RuleMatrixEntry)
            .filter(RuleMatrixEntry.category == category)
            .first()
        )

    escalation_required = False
    escalation_reason = None
    escalation_level = "No Escalation"
    department = rule.department if rule else "General Support"
    urgency = rule.urgency if rule else "Medium"
    priority = rule.priority if rule else "P3"
    policy_id = rule.policy_id if rule else None

    if rule is not None:
        escalation_required, escalation_reason = evaluate_escalation_trigger(
            rule.escalation_trigger, complaint_data
        )
        if escalation_required:
            escalation_level = {
                "P0": "Critical Management Escalation",
                "P1": "Specialist Team",
                "P2": "Department Manager",
            }.get(rule.priority, "Supervisor Review")

    return {
        "category": category,
        "subcategory": subcategory,
        "department": department,
        "urgency": urgency,
        "priority": priority,
        "policy_id": policy_id,
        "escalation_required": escalation_required,
        "escalation_reason": escalation_reason,
        "escalation_level": escalation_level,
        "rule_id": rule.rule_id if rule else None,
    }
