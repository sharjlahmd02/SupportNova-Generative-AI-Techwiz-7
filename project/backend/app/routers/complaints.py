from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.db.models import (
    User,
    UserRole,
    Complaint,
    ComplaintStatus,
    ComplaintIntelligence,
    ValidationResult,
)
from app.schemas.complaint import ComplaintIn, ComplaintOut
from app.security.access_control import get_current_user, require_role


router = APIRouter()

STAFF_ROLES = [UserRole.agent, UserRole.reviewer, UserRole.manager, UserRole.admin]


def _pipeline_summaries(db: Session, complaint_ids: list[int]) -> dict[int, dict]:
    """Batch-load Pipeline 1 / Pipeline 2 summaries so list endpoints stay O(1) queries."""
    summaries: dict[int, dict] = {}
    if not complaint_ids:
        return summaries

    for intel in (
        db.query(ComplaintIntelligence)
        .filter(ComplaintIntelligence.complaint_id.in_(complaint_ids))
        .all()
    ):
        summaries.setdefault(intel.complaint_id, {}).update(
            category=intel.issue_category,
            subcategory=intel.subcategory,
            department=intel.department,
            sentiment=intel.sentiment,
            urgency=intel.urgency,
            priority=intel.priority,
            escalation_required=intel.escalation_required,
        )

    for result in (
        db.query(ValidationResult)
        .filter(ValidationResult.complaint_id.in_(complaint_ids))
        .all()
    ):
        summary = summaries.setdefault(result.complaint_id, {})
        summary.setdefault("category", result.issue_category)
        summary.setdefault("subcategory", result.subcategory)
        summary.setdefault("department", result.department)
        summary.setdefault("urgency", result.urgency)
        summary.setdefault("priority", result.priority)
        summary.setdefault("escalation_required", result.escalation_required)
        summary["verification_status"] = (
            result.verification_status.value
            if hasattr(result.verification_status, "value")
            else result.verification_status
        )
        summary["mismatch_reasons"] = result.mismatch_reasons or []

    return summaries


def _serialize(db: Session, complaint: Complaint, summaries: Optional[dict] = None) -> dict:
    if summaries is None:
        summaries = _pipeline_summaries(db, [complaint.id])
    payload = {
        "id": complaint.id,
        "title": complaint.title,
        "description": complaint.description,
        "customer_type": complaint.customer_type,
        "product_service": complaint.product_service,
        "order_ref": complaint.order_ref,
        "channel": complaint.channel,
        "attachments": complaint.attachments,
        "prior_complaint_ref": complaint.prior_complaint_ref,
        "requested_resolution": complaint.requested_resolution,
        "status": complaint.status.value if complaint.status else None,
        "customer_id": complaint.customer_id,
        "date": complaint.date,
        "created_at": complaint.created_at,
        "updated_at": complaint.updated_at,
    }
    payload.update(summaries.get(complaint.id, {}))
    return payload


def _get_visible_complaint(db: Session, complaint_id: int, user: User) -> Complaint:
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if complaint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    if user.role == UserRole.customer and complaint.customer_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your complaint")
    return complaint


@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
def create_complaint(
    complaint_in: ComplaintIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = Complaint(
        title=complaint_in.title,
        description=complaint_in.description,
        customer_type=complaint_in.customer_type,
        product_service=complaint_in.product_service,
        order_ref=complaint_in.order_ref,
        channel=complaint_in.channel,
        attachments=complaint_in.attachments,
        prior_complaint_ref=complaint_in.prior_complaint_ref,
        requested_resolution=complaint_in.requested_resolution,
        status=ComplaintStatus.new,
        customer_id=current_user.id,
    )
    db.add(complaint)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the complaint. Please try again.",
        )
    db.refresh(complaint)
    return _serialize(db, complaint)


@router.get("", response_model=list[ComplaintOut])
def list_complaints(
    status: Optional[str] = None,
    category: Optional[str] = None,
    department: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Complaint)
    if current_user.role == UserRole.customer:
        query = query.filter(Complaint.customer_id == current_user.id)
    if status:
        query = query.filter(Complaint.status == status)
    complaints = (
        query.order_by(Complaint.created_at.desc()).offset(skip).limit(min(limit, 200)).all()
    )

    summaries = _pipeline_summaries(db, [c.id for c in complaints])
    rows = []
    for complaint in complaints:
        payload = _serialize(db, complaint, summaries)
        summary = summaries.get(complaint.id, {})
        # Client-side filters only apply once a pipeline has classified the complaint.
        if category and summary.get("category") != category:
            continue
        if department and summary.get("department") != department:
            continue
        if priority and summary.get("priority") != priority:
            continue
        rows.append(payload)
    return rows


@router.get("/{complaint_id}", response_model=ComplaintOut)
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    return _serialize(db, complaint)


@router.patch("/{complaint_id}/status", response_model=ComplaintOut)
def update_complaint_status(
    complaint_id: int,
    new_status: str = Query(..., description="New status value"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(STAFF_ROLES)),
):
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    try:
        complaint.status = ComplaintStatus(new_status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Allowed: {[s.value for s in ComplaintStatus]}",
        )
    db.commit()
    db.refresh(complaint)
    return _serialize(db, complaint)
