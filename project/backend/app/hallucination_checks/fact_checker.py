from typing import Dict, Any, List

from app.hallucination_checks import promise_detector as _pd


def detect_unsupported_promises(
    customer_response: str,
    policy_chunks: List[Dict[str, Any]],
) -> List[str]:
    return _pd.detect_unsupported_promises(customer_response, policy_chunks)


def detect_hallucinated_facts(
    intelligence_output: Dict[str, Any],
    complaint_text: str,
    policy_chunks: List[Dict[str, Any]],
) -> List[str]:
    return _pd.detect_hallucinated_facts(intelligence_output, complaint_text, policy_chunks)


def check_policy_traceability(
    intelligence_output: Dict[str, Any],
    policy_chunks: List[Dict[str, Any]],
) -> List[str]:
    return _pd.check_policy_traceability(intelligence_output, policy_chunks)
