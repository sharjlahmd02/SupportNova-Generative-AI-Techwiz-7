from typing import Dict, Any, List
from pydantic import ValidationError

from app.schemas.intelligence import IntelligenceSchema


def validate_gemini_output(raw_output: Dict[str, Any]) -> tuple[bool, IntelligenceSchema, List[str]]:
    """Validate Gemini's output against the IntelligenceSchema."""
    try:
        validated = IntelligenceSchema(**raw_output)
        return True, validated, []
    except ValidationError as e:
        errors = [f"{err['loc']}: {err['msg']}" for err in e.errors()]
        return False, None, errors