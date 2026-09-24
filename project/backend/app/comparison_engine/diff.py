from typing import Dict, Any, List


COMPARISON_FIELDS = [
    "issue_category",
    "subcategory",
    "department",
    "secondary_department",
    "urgency",
    "priority",
    "escalation_required",
    "escalation_level",
    "policy_id",
]


def diff_pipelines(genai: Dict[str, Any], python: Dict[str, Any]) -> Dict[str, Any]:
    diff = {}
    for field in COMPARISON_FIELDS:
        genai_val = genai.get(field)
        python_val = python.get(field)
        if genai_val != python_val:
            diff[field] = {"genai": genai_val, "python": python_val}
    return diff


def has_critical_mismatch(diff: Dict[str, Any]) -> bool:
    critical_fields = ["escalation_required", "escalation_level", "department", "urgency"]
    return any(field in diff for field in critical_fields)