import re
from typing import Dict, Any, List


PROMISE_PATTERNS = [
    r"\bwe will refund\b",
    r"\byou will receive (?:a )?refund\b",
    r"\bguaranteed refund\b",
    r"\bcompensation of\b",
    r"\bwe promise\b",
    r"\bfull refund\b",
    r"\bwe will compensate\b",
]


def detect_promises(text: str) -> List[str]:
    if not text:
        return []
    found = []
    for pattern in PROMISE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            found.append(pattern)
    return found


def detect_unsupported_promises(
    customer_response: str,
    policy_chunks: List[Dict[str, Any]],
) -> List[str]:
    promises = detect_promises(customer_response or "")
    if not promises:
        return []
    policy_text = " ".join((c.get("content") or "") for c in policy_chunks).lower()
    unsupported = []
    for promise in promises:
        # if the promise keywords don't appear in policy, flag it
        keywords = [w for w in re.findall(r"[a-z]{5,}", promise) if w not in {"we", "will", "you", "receive"}]
        if not any(k in policy_text for k in keywords):
            unsupported.append(f"Promise not backed by policy: {promise}")
    return unsupported


def detect_hallucinated_facts(
    intelligence_output: Dict[str, Any],
    complaint_text: str,
    policy_chunks: List[Dict[str, Any]],
) -> List[str]:
    issues: List[str] = []
    complaint_lower = (complaint_text or "").lower()
    policy_lower = " ".join((c.get("content") or "") for c in policy_chunks).lower()

    policy_id = intelligence_output.get("policy_id")
    if policy_id and policy_chunks:
        known_ids = {c.get("policy_id") for c in policy_chunks}
        if policy_id not in known_ids and policy_id.lower() not in policy_lower:
            issues.append(f"policy_id {policy_id} not found in retrieved context")

    response = intelligence_output.get("customer_response") or ""
    issues.extend(detect_unsupported_promises(response, policy_chunks))
    return issues


def check_policy_traceability(
    intelligence_output: Dict[str, Any],
    policy_chunks: List[Dict[str, Any]],
) -> List[str]:
    issues: List[str] = []
    policy_id = intelligence_output.get("policy_id")
    if not policy_id:
        issues.append("No policy_id referenced in intelligence output")
        return issues

    known_ids = {c.get("policy_id") for c in policy_chunks}
    if policy_chunks and policy_id not in known_ids:
        issues.append(f"Referenced policy_id {policy_id} not in retrieved chunks")
    return issues
