"""SRS §6 — customer-side input sanitization and whitespace normalization.

Every free-text field a customer can type into goes through ``sanitize_text`` so
the pipelines never receive control characters, CRLF noise or runaway blank
lines. Prompt-injection *content* is a separate concern handled by
``app.security.prompt_injection_guard`` — text is never rewritten here, only
normalized, so the complaint body stays the customer's own words.
"""

import re
import unicodedata

# C0/C1 control characters except tab and newline.
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
_MULTI_SPACE = re.compile(r"[^\S\n]{2,}")
_MULTI_NEWLINE = re.compile(r"\n{3,}")
# Zero-width / bidi-override characters used to smuggle fake statuses.
_INVISIBLE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]")


def sanitize_text(value: str | None, max_length: int | None = None) -> str | None:
    """Normalize one free-text value. Returns ``None`` for blank input."""
    if value is None:
        return None

    text = unicodedata.normalize("NFKC", str(value))
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _INVISIBLE.sub("", text)
    text = _CONTROL_CHARS.sub(" ", text)
    text = _MULTI_SPACE.sub(" ", text)
    text = _MULTI_NEWLINE.sub("\n\n", text)
    text = "\n".join(line.rstrip() for line in text.split("\n")).strip()

    if not text:
        return None
    if max_length is not None and len(text) > max_length:
        text = text[:max_length].rstrip()
    return text or None


def sanitize_optional(value: str | None, max_length: int | None = None) -> str | None:
    """Same as :func:`sanitize_text` but keeps the ``"" -> None`` contract."""
    return sanitize_text(value, max_length)
