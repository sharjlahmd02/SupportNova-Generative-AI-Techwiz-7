"""Regression: the Gemini SDK must not receive Pydantic's JSON-schema extras.

`protos.Schema(...)` raises "Unknown field for Schema: default" when a raw
`model_json_schema()` is handed to it, which silently broke every GenAI analysis
(SRS 4.4 official responses, 4.3 clarifications).
"""

import google.generativeai  # noqa: F401  (registers the proto types)
import google.ai.generativelanguage_v1beta.types as protos

from app.genai_pipeline.gemini_client import to_proto_schema
from app.schemas.intelligence import IntelligenceSchema, ValidationSchema

BANNED_KEYS = {"default", "title", "anyOf", "oneOf", "$defs", "$ref", "$schema", "examples"}


def _walk(node, found):
    if isinstance(node, dict):
        for key, value in node.items():
            found.add(key)
            _walk(value, found)
    elif isinstance(node, list):
        for item in node:
            _walk(item, found)


def test_intelligence_schema_is_accepted_by_the_proto():
    schema = to_proto_schema(IntelligenceSchema)
    protos.Schema(schema)

    found = set()
    _walk(schema, found)
    assert not (found & BANNED_KEYS), f"unsupported schema keys: {found & BANNED_KEYS}"


def test_validation_schema_is_accepted_by_the_proto():
    schema = to_proto_schema(ValidationSchema)
    protos.Schema(schema)

    found = set()
    _walk(schema, found)
    assert not (found & BANNED_KEYS)


def test_nested_models_are_inlined():
    schema = to_proto_schema(IntelligenceSchema)
    entities = schema["properties"]["entities"]
    assert entities["type"] == "OBJECT"
    assert "properties" in entities
    # Optional[str] must become STRING + nullable, never anyOf.
    assert entities["properties"]["product"]["type"] == "STRING"
    assert entities["properties"]["product"]["nullable"] is True


def test_enums_stay_string_enums():
    schema = to_proto_schema(IntelligenceSchema)
    priority = schema["properties"]["priority"]
    assert priority["type"] == "STRING"
    assert "P0" in priority["enum"]
