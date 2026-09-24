import re
from typing import List


INJECTION_PATTERNS = [
    r"ignore\s+(?:your\s+)?(?:instructions?|rules?|prompt)",
    r"disregard\s+(?:the\s+)?(?:above|previous|system)",
    r"you\s+are\s+(?:now\s+)?(?:a|an)\s+\w+",
    r"pretend\s+(?:to\s+be|you\s+are)",
    r"simulate\s+(?:a|an)\s+\w+",
    r"override\s+(?:the\s+)?(?:system|rules?)",
    r"bypass\s+(?:the\s+)?(?:security|rules?)",
    r"forget\s+(?:your\s+)?(?:instructions?|role)",
    r"new\s+(?:instructions?|rules?|prompt)",
    r"system\s*:\s*",
    r"assistant\s*:\s*",
    r"user\s*:\s*",
]


def detect_prompt_injection(text: str) -> List[str]:
    """Detect potential prompt injection attempts in text."""
    matches = []
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            matches.append(pattern)
    return matches


def sanitize_for_prompt(text: str) -> str:
    """Wrap untrusted text in clear delimiters."""
    return f"<<<UNTRUSTED_USER_INPUT>>>\n{text}\n<<<END_UNTRUSTED_USER_INPUT>>>"