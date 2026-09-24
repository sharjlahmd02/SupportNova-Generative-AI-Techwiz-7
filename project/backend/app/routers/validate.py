from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User,
    Complaint,
    ComplaintIntelligence,
    ValidationResult,
    VerificationStatus as DBVerificationStatus,
)
from app.schemas.intelligence import ValidationSchema
from app.security.access_control import get_current_user
from app.python_validation.rule_checker import derive_from_rules
from app.comparison_engine.diff import diff_pipelines
from app.comparison_engine.verification_score import (
    calculate_verification_score,
    determine_verification_status,
)


router = APIRouter()


def _serialize_validation(result: ValidationResult, intelligence) -> dict:
    return {
        "complaint_id": str(result.complaint_id),
        "primary_issue": result.primary_issue,
        "secondary_issue": result.secondary_issue,
        "issue_category": result.issue_category,
        "subcategory": result.subcategory,
        "sentiment": result.sentiment,
        "urgency": result.urgency,
        "priority": result.priority,
        "entities": result.entities or {},
        "department": result.department,
        "secondary_department": result.secondary_department,
        "policy_id": result.policy_id,
        "policy_section": result.policy_section,
        "resolution_steps": result.resolution_steps or [],
        "escalation_required": bool(result.escalation_required),
        "escalation_reason": result.escalation_reason,
        "escalation_level": result.escalation_level,
        "response_type": result.response_type,
        "customer_response": result.customer_response,
        "follow_up_required": bool(result.follow_up_required),
        "follow_up_message": result.follow_up_message,
        "clarification_questions": result.clarification_questions or [],
        "agent_guidance": result.agent_guidance or [],
        "prompt_version": intelligence.prompt_version if intelligence else "n/a",
        "model": intelligence.model if intelligence else "rule-engine",
        "analysis_timestamp": result.created_at,
        "verification_status": (
            result.verification_status.value
            if hasattr(result.verification_status, "value")
            else result.verification_status
        ),
        "mismatch_reasons": result.mismatch_reasons or [],
    }


@router.get("/{complaint_id}/validation", response_model=ValidationSchema)
def get_validation(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the stored Pipeline 2 (Python rule engine) output, if it exists."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")

    result = (
        db.query(ValidationResult)
        .filter(ValidationResult.complaint_id == complaint.id)
        .first()
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No validation yet — run the validate endpoint first",
        )

    intelligence = (
        db.query(ComplaintIntelligence)
        .filter(ComplaintIntelligence.complaint_id == complaint.id)
        .first()
    )
    return _serialize_validation(result, intelligence)


@router.post(
    "/{complaint_id}/validate",
    response_model=ValidationSchema,
    status_code=status.HTTP_201_CREATED,
)
def validate_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")

    complaint_text = f"Title: {complaint.title}\nDescription: {complaint.description}"
    entities = {}
    intelligence = (
        db.query(ComplaintIntelligence)
        .filter(ComplaintIntelligence.complaint_id == complaint.id)
        .first()
    )
    if intelligence and intelligence.entities:
        entities = intelligence.entities
    if complaint.order_ref:
        entities.setdefault("order_id", complaint.order_ref)

    complaint_data = {
        "customer_type": complaint.customer_type,
        "amount": entities.get("amount"),
        "issue_duration_hours": entities.get("issue_duration_hours"),
    }
    derived = derive_from_rules(db, complaint_text, complaint_data)

    genai_result = None
    if intelligence:
        genai_result = {
            "issue_category": intelligence.issue_category,
            "subcategory": intelligence.subcategory,
            "department": intelligence.department,
            "secondary_department": intelligence.secondary_department,
            "urgency": intelligence.urgency,
            "priority": intelligence.priority,
            "escalation_required": intelligence.escalation_required,
            "escalation_level": intelligence.escalation_level,
            "policy_id": intelligence.policy_id,
        }

    python_result = {
        "issue_category": derived["category"],
        "subcategory": derived["subcategory"],
        "department": derived["department"],
        "secondary_department": None,
        "urgency": derived["urgency"],
        "priority": derived["priority"],
        "escalation_required": derived["escalation_required"],
        "escalation_level": derived["escalation_level"],
        "policy_id": derived["policy_id"],
    }

    mismatch_reasons = []
    if genai_result:
        diff = diff_pipelines(genai_result, python_result)
        score = calculate_verification_score(diff)
        schema_status = determine_verification_status(diff, score)
        mismatch_reasons = [
            f"{field}: genai={vals['genai']!r} vs python={vals['python']!r}"
            for field, vals in diff.items()
        ]
    else:
        schema_status = "manual_review"
        mismatch_reasons = ["No GenAI analysis found — run /analyze first for comparison"]

    verification_status = DBVerificationStatus(schema_status)

    sentiment = intelligence.sentiment if intelligence else "Neutral"
    urgency = derived["urgency"]
    priority = derived["priority"]

    existing = (
        db.query(ValidationResult)
        .filter(ValidationResult.complaint_id == complaint.id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    result = ValidationResult(
        complaint_id=complaint.id,
        primary_issue=intelligence.primary_issue if intelligence else complaint.title,
        secondary_issue=intelligence.secondary_issue if intelligence else None,
        issue_category=derived["category"],
        subcategory=derived["subcategory"],
        sentiment=sentiment,
        urgency=urgency,
        priority=priority,
        entities=entities,
        department=derived["department"],
        secondary_department=None,
        policy_id=derived["policy_id"],
        policy_section=intelligence.policy_section if intelligence else None,
        resolution_steps=intelligence.resolution_steps if intelligence else [],
        escalation_required=derived["escalation_required"],
        escalation_reason=derived["escalation_reason"],
        escalation_level=derived["escalation_level"],
        response_type=intelligence.response_type if intelligence else None,
        customer_response=intelligence.customer_response if intelligence else None,
        follow_up_required=intelligence.follow_up_required if intelligence else False,
        follow_up_message=intelligence.follow_up_message if intelligence else None,
        clarification_questions=intelligence.clarification_questions if intelligence else [],
        agent_guidance=intelligence.agent_guidance if intelligence else [],
        verification_status=verification_status,
        mismatch_reasons=mismatch_reasons,
        created_at=datetime.utcnow(),
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return _serialize_validation(result, intelligence)
