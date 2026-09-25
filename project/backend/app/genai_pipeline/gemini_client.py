from typing import Any, Optional
import json

import google.generativeai as genai

from app.config import settings


genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(settings.GEMINI_MODEL)

# The protobuf `Schema` message only understands these keys. Pydantic's JSON
# schema also emits `title`, `default`, `$defs`, `$ref` and `anyOf`, which the
# SDK passes straight through and the API then rejects with
# "Unknown field for Schema: default".
_JSON_TO_PROTO_TYPE = {
    "string": "STRING",
    "integer": "INTEGER",
    "number": "NUMBER",
    "boolean": "BOOLEAN",
    "object": "OBJECT",
    "array": "ARRAY",
    "null": "NULL",
    "ANY": "TYPE_UNSPECIFIED",
}


def _resolve(node: Dict[str, Any], defs: Dict[str, Any]) -> Dict[str, Any]:
    """Inline a `$ref` (Pydantic emits `#/$defs/Name` for nested models)."""
    seen = 0
    while isinstance(node, dict) and "$ref" in node and seen < 20:
        name = node["$ref"].rsplit("/", 1)[-1]
        node = defs.get(name, {})
        seen += 1
    return node


def _declared_type(node: Dict[str, Any]) -> tuple[str, bool]:
    """Return (type, nullable) for a JSON-schema node of the simplest shape."""
    raw = node.get("type")
    if isinstance(raw, list):
        non_null = [item for item in raw if item != "null"]
        return (non_null[0] if non_null else "string"), "null" in raw
    if isinstance(raw, str):
        return raw, False
    return "string", False


def _convert(node: Any, defs: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(node, dict):
        return {"type": "STRING"}

    node = _resolve(node, defs)

    if "enum" in node:
        out: Dict[str, Any] = {"type": "STRING", "enum": [str(v) for v in node["enum"]]}
        if isinstance(node.get("description"), str):
            out["description"] = node["description"]
        return out

    for branch_key in ("anyOf", "oneOf"):
        branches = node.get(branch_key)
        if isinstance(branches, list) and branches:
            concrete = [
                _resolve(item, defs)
                for item in branches
                if isinstance(item, dict) and item.get("type") != "null"
            ]
            has_null = any(
                isinstance(item, dict) and item.get("type") == "null" for item in branches
            )
            base = _convert(concrete[0], defs) if concrete else {"type": "STRING"}
            if has_null:
                base["nullable"] = True
            return base

    declared, nullable = _declared_type(node)
    proto_type = _JSON_TO_PROTO_TYPE.get(declared, "STRING")
    out = {"type": proto_type}
    if nullable:
        out["nullable"] = True

    if proto_type == "OBJECT":
        properties = node.get("properties") or {}
        out["properties"] = {name: _convert(value, defs) for name, value in properties.items()}
        required = node.get("required")
        if isinstance(required, list) and required:
            out["required"] = list(required)

    elif proto_type == "ARRAY":
        out["items"] = _convert(node.get("items") or {}, defs)

    if isinstance(node.get("description"), str) and node["description"]:
        out["description"] = node["description"]

    return out


def to_proto_schema(schema: Any) -> Dict[str, Any]:
    """Turn a Pydantic model (class or instance) into a proto-safe schema dict."""
    if isinstance(schema, dict):
        return _convert(schema, {})
    model_class = schema if isinstance(schema, type) else type(schema)
    json_schema = getattr(model_class, "model_json_schema", None)
    if json_schema is None:
        return {"type": "OBJECT", "properties": {}}
    generated = json_schema()
    return _convert(generated, generated.get("$defs") or {})


def call_gemini_structured(
    prompt: str,
    response_schema: Any,
    temperature: float = 0.1,
    max_retries: int = 2,
) -> Optional[str]:
    """Call Gemini in JSON mode with a response schema the API actually accepts."""
    schema = to_proto_schema(response_schema)

    for attempt in range(max_retries + 1):
        try:
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature,
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            text = response.text
            if text:
                # Fail fast on malformed JSON rather than passing it downstream.
                json.loads(text)
            return text
        except Exception:
            if attempt == max_retries:
                raise
    return None
