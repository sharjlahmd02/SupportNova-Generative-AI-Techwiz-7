import os
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent / "prompts"
PROMPTS_DIR.mkdir(exist_ok=True)

DEFAULT_PROMPT_VERSION = "v1"


def get_prompt_template(version: str = DEFAULT_PROMPT_VERSION) -> str:
    prompt_file = PROMPTS_DIR / f"analysis_{version}.txt"
    if prompt_file.exists():
        return prompt_file.read_text()
    return ""