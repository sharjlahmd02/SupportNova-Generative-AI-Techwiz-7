from typing import Dict, Any
from app.schemas.complaint import VerificationStatus


def calculate_verification_score(diff: Dict[str, Any]) -> float:
    """Calculate a verification score (0-1) based on diff."""
    total_fields = 9  # len(COMPARISON_FIELDS)
    matched_fields = total_fields - len(diff)
    return matched_fields / total_fields


def determine_verification_status(diff: Dict[str, Any], score: float) -> VerificationStatus:
    if not diff:
        return VerificationStatus.verified
    if has_critical_mismatch(diff):
        return VerificationStatus.manual_review
    if score < 0.7:
        return VerificationStatus.mismatch
    return VerificationStatus.verified


def has_critical_mismatch(diff: Dict[str, Any]) -> bool:
    critical_fields = ["escalation_required", "escalation_level", "department", "urgency"]
    return any(field in diff for field in critical_fields)