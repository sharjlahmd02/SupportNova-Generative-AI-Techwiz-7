import google.generativeai as genai
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.config import settings


genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(settings.GEMINI_MODEL)


def call_gemini_structured(
    prompt: str,
    response_schema: BaseModel,
    temperature: float = 0.1,
    max_retries: int = 2,
) -> Optional[Dict[str, Any]]:
    """Call Gemini with JSON mode / response schema."""
    for attempt in range(max_retries + 1):
        try:
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature,
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )
            return response.text  # JSON string
        except Exception as e:
            if attempt == max_retries:
                raise
    return None