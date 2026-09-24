from typing import Dict, Any, List, Tuple


def check_resolution_checks(
    complaint_data: Dict[str, Any],
    intelligence_output: Dict[str, Any],
    rule_matrix: List[Dict[str, Any]],
) -> Tuple[bool, List[str]]:
    issues: List[str] = []
    category = intelligence_output.get("issue_category")
    steps = intelligence_output.get("resolution_steps") or []

    matching = [r for r in rule_matrix if r.get("category") == category]
    if not matching:
        return True, issues

    rule = matching[0]
    required = rule.get("required_actions") or []
    prohibited = rule.get("prohibited_actions") or []

    step_text = " ".join(str(s).lower() for s in steps)
    for action in required:
        words = [w for w in str(action).lower().split("_") if w and w not in {"the", "a", "to"}]
        if words and not any(w in step_text for w in words):
            issues.append(f"Missing required action: {action}")

    for action in prohibited:
        words = [w for w in str(action).lower().split("_") if w and w not in {"the", "a", "to"}]
        if words and all(w in step_text for w in words[:2]):
            issues.append(f"Prohibited action present: {action}")

    return len(issues) == 0, issues


def check_follow_up_rules(
    complaint_data: Dict[str, Any],
    intelligence_output: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    issues: List[str] = []
    if intelligence_output.get("escalation_required") and not intelligence_output.get("follow_up_required"):
        issues.append("Escalation required but follow_up_required is false")
    return len(issues) == 0, issues
