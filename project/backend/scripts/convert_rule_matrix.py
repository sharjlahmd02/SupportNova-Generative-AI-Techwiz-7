"""Regenerate ``app/rules/rule_matrix.json`` from doc/company.

The authoritative matrix lives in ``doc/company/resolution_rule_matrix.json``
(105 rules, 15 travel categories, 10 departments). This script reshapes it into
the column names ``RuleMatrixEntry`` expects, so ``scripts/seed_rule_matrix.py``
can load it unchanged.

Run after any change to doc/company::

    venv/Scripts/python.exe scripts/convert_rule_matrix.py
    venv/Scripts/python.exe scripts/seed_rule_matrix.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BACKEND_ROOT = Path(__file__).resolve().parents[1]
COMPANY_DIR = BACKEND_ROOT.parents[1] / "doc" / "company"
SOURCE = COMPANY_DIR / "resolution_rule_matrix.json"
ESCALATION_SOURCE = COMPANY_DIR / "escalation_rules.json"
TARGET = BACKEND_ROOT / "app" / "rules" / "rule_matrix.json"

# Rows the complaint dataset carries without a real product category. They get
# their own catch-all rules so routing never falls off the matrix.
FALLBACK_RULES = [
    {
        "rule_id": "RULE-GEN-01",
        "category": "General",
        "subcategory": "Other",
        "conditions": ["Complaint does not map to a specific travel category"],
        "department": "DEPT-08",
        "urgency": "Medium",
        "priority": "P3",
        "policy_id": "CMP-POL-07",
        "escalation_required": False,
        "required_actions": ["Acknowledge within 4 business hours", "Identify the real category and re-route"],
        "prohibited_actions": ["Do not close a misrouted complaint without re-routing"],
        "follow_up": True,
        "follow_up_days": 3,
    },
    {
        "rule_id": "RULE-GEN-02",
        "category": "General",
        "subcategory": "Multiple Issues",
        "conditions": ["Complaint spans more than one product line"],
        "department": "DEPT-08",
        "urgency": "Medium",
        "priority": "P2",
        "policy_id": "CMP-SOP-09",
        "escalation_required": False,
        "required_actions": ["Split into primary and secondary issues", "Notify the supporting department"],
        "prohibited_actions": ["Do not reply before both departments have input"],
        "follow_up": True,
        "follow_up_days": 2,
    },
]


def convert() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    departments = source["departments"]

    rules = []
    for raw in source["rules"]:
        follow_up = bool(raw.get("follow_up"))
        rules.append(
            {
                "rule_id": raw["rule_id"],
                "category": raw["category"],
                "subcategory": raw["subcategory"],
                "conditions": raw.get("conditions") or [],
                "department": raw["department"],
                "department_name": departments.get(raw["department"]),
                "urgency": raw["urgency"],
                "priority": raw["priority"],
                "policy_id": raw["policy_id"],
                "escalation_trigger": bool(raw.get("escalation_required")),
                "required_actions": raw.get("required_actions") or [],
                "prohibited_actions": raw.get("prohibited_actions") or [],
                "follow_up_rule": f"FOLLOW-{raw['rule_id']}" if follow_up else None,
                "follow_up_days": raw.get("follow_up_days") if follow_up else None,
            }
        )

    for raw in FALLBACK_RULES:
        follow_up = bool(raw.get("follow_up"))
        rules.append(
            {
                "rule_id": raw["rule_id"],
                "category": raw["category"],
                "subcategory": raw["subcategory"],
                "conditions": raw.get("conditions") or [],
                "department": raw["department"],
                "department_name": departments.get(raw["department"]),
                "urgency": raw["urgency"],
                "priority": raw["priority"],
                "policy_id": raw["policy_id"],
                "escalation_trigger": bool(raw.get("escalation_required")),
                "required_actions": raw.get("required_actions") or [],
                "prohibited_actions": raw.get("prohibited_actions") or [],
                "follow_up_rule": f"FOLLOW-{raw['rule_id']}" if follow_up else None,
                "follow_up_days": raw.get("follow_up_days") if follow_up else None,
            }
        )

    TARGET.write_text(json.dumps(rules, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    escalation = json.loads(ESCALATION_SOURCE.read_text(encoding="utf-8"))
    esc_target = BACKEND_ROOT / "app" / "rules" / "escalation_rules.json"
    esc_target.write_text(
        json.dumps(escalation, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"wrote {len(rules)} rules to {TARGET.relative_to(BACKEND_ROOT)}")
    print(
        f"wrote {len(escalation['rules'])} escalation rules to "
        f"{esc_target.relative_to(BACKEND_ROOT)}"
    )
    print(f"categories: {len(set(r['category'] for r in rules))}")


if __name__ == "__main__":
    convert()
