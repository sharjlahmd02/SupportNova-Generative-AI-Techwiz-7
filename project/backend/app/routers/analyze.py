from datetime import datetime
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User,
    Complaint,
    ComplaintIntelligence,
    ComplaintStatus,
    ComplaintMessage,
    ComplaintEvent,
    KnowledgeDocument,
    Chunk,
)
from app.routers.complaints import _get_visible_complaint
from app.schemas.intelligence import IntelligenceSchema
from app.security.access_control import get_current_user
from app.genai_pipeline.prompt_builder import build_analysis_prompt
from app.genai_pipeline.gemini_client import call_gemini_structured
from app.python_validation.schema_validator import validate_gemini_output
from app.security.prompt_injection_guard import sanitize_for_prompt


router = APIRouter()

PROMPT_VERSION = "v1"


def _load_policy_chunks(db: Session, limit: int = 5):
    chunks = db.query(Chunk).limit(limit).all()
    return [
        {
            "policy_id": c.document.doc_id if c.document else "unknown",
            "section": c.section or c.heading or "unknown",
            "content": c.content,
        }
        for c in chunks
    ]


def _serialize_intelligence(intel: ComplaintIntelligence) -> dict:
    return {
        "complaint_id": str(intel.complaint_id),
        "primary_issue": intel.primary_issue,
        "secondary_issue": intel.secondary_issue,
        "issue_category": intel.issue_category,
        "subcategory": intel.subcategory,
        "sentiment": intel.sentiment,
        "urgency": intel.urgency,
        "priority": intel.priority,
        "entities": intel.entities or {},
        "department": intel.department,
        "secondary_department": intel.secondary_department,
        "policy_id": intel.policy_id,
        "policy_section": intel.policy_section,
        "resolution_steps": intel.resolution_steps or [],
        "escalation_required": bool(intel.escalation_required),
        "escalation_reason": intel.escalation_reason,
        "escalation_level": intel.escalation_level,
        "response_type": intel.response_type,
        "customer_response": intel.customer_response,
        "follow_up_required": bool(intel.follow_up_required),
        "follow_up_message": intel.follow_up_message,
        "clarification_questions": intel.clarification_questions or [],
        "agent_guidance": intel.agent_guidance or [],
        "prompt_version": intel.prompt_version,
        "model": intel.model,
        "analysis_timestamp": intel.analysis_timestamp,
    }


@router.get("/{complaint_id}/analysis", response_model=IntelligenceSchema)
def get_analysis(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the stored Pipeline 1 (Gemini) output for a complaint, if it exists."""
    complaint = _get_visible_complaint(db, complaint_id, current_user)

    intelligence = (
        db.query(ComplaintIntelligence)
        .filter(ComplaintIntelligence.complaint_id == complaint.id)
        .first()
    )
    if intelligence is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No GenAI analysis yet — run the analyze endpoint first",
        )
    return _serialize_intelligence(intelligence)


@router.post(
    "/{complaint_id}/analyze",
    response_model=IntelligenceSchema,
    status_code=status.HTTP_201_CREATED,
)
def analyze_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = _get_visible_complaint(db, complaint_id, current_user)

    complaint_text = sanitize_for_prompt(
        f"Title: {complaint.title}\nDescription: {complaint.description}"
    )
    policy_chunks = _load_policy_chunks(db)
    prompt = build_analysis_prompt(complaint_text, policy_chunks, prompt_version=PROMPT_VERSION)

    try:
        raw = call_gemini_structured(prompt, IntelligenceSchema)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini analysis failed: {e}",
        )

    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Gemini returned non-JSON output",
            )

    ok, validated, errors = validate_gemini_output(raw)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "Gemini output failed schema validation", "errors": errors},
        )

    data = validated.model_dump()
    intelligence = ComplaintIntelligence(
        complaint_id=complaint.id,
        primary_issue=data["primary_issue"],
        secondary_issue=data.get("secondary_issue"),
        issue_category=data["issue_category"],
        subcategory=data["subcategory"],
        sentiment=data["sentiment"].value if hasattr(data["sentiment"], "value") else data["sentiment"],
        urgency=data["urgency"].value if hasattr(data["urgency"], "value") else data["urgency"],
        priority=data["priority"].value if hasattr(data["priority"], "value") else data["priority"],
        entities=data.get("entities"),
        department=data["department"],
        secondary_department=data.get("secondary_department"),
        policy_id=data.get("policy_id"),
        policy_section=data.get("policy_section"),
        resolution_steps=data.get("resolution_steps"),
        escalation_required=data.get("escalation_required", False),
        escalation_reason=data.get("escalation_reason"),
        escalation_level=data.get("escalation_level"),
        response_type=data.get("response_type"),
        customer_response=data.get("customer_response"),
        follow_up_required=data.get("follow_up_required", False),
        follow_up_message=data.get("follow_up_message"),
        clarification_questions=data.get("clarification_questions"),
        agent_guidance=data.get("agent_guidance"),
        prompt_version=data.get("prompt_version", PROMPT_VERSION),
        model=data.get("model", "unknown"),
        analysis_timestamp=datetime.utcnow(),
    )

    existing = (
        db.query(ComplaintIntelligence)
        .filter(ComplaintIntelligence.complaint_id == complaint.id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    db.add(intelligence)
    questions = list(data.get("clarification_questions") or [])
    previous_status = complaint.status.value if complaint.status else None
    # SRS §4.3 / §5.3 — missing information is *asked for*, never assumed.
    complaint.status = (
        ComplaintStatus.awaiting_customer if questions else ComplaintStatus.analyzed
    )
    db.add(
        ComplaintEvent(
            complaint_id=complaint.id,
            event_type="status",
            label="GenAI analysis completed",
            detail={"from": previous_status, "to": complaint.status.value},
            actor=current_user.username,
        )
    )
    if questions:
        db.add(
            ComplaintMessage(
                complaint_id=complaint.id,
                author_id=current_user.id,
                author_name="SupportNova analysis",
                author_role="agent",
                kind="clarification",
                body="\n".join(
                    f"{index + 1}. {question}" for index, question in enumerate(questions)
                ),
            )
        )
        db.add(
            ComplaintEvent(
                complaint_id=complaint.id,
                event_type="status",
                label="More information requested",
                detail={"to": "Awaiting Customer", "questions": questions},
                actor=current_user.username,
            )
        )
    db.commit()
    db.refresh(intelligence)

    return _serialize_intelligence(intelligence)
