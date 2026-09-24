from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, UserRole, ReviewCase, Complaint, VerificationStatus
from app.schemas.review import ReviewCaseOut, ReviewActionIn
from app.security.access_control import get_current_user, require_role


router = APIRouter()

REVIEWER_ROLES = [UserRole.reviewer, UserRole.manager, UserRole.admin]


@router.get("/queue", response_model=list[ReviewCaseOut])
def get_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(REVIEWER_ROLES)),
):
    return (
        db.query(ReviewCase)
        .filter(ReviewCase.resolved_at.is_(None))
        .order_by(ReviewCase.created_at.desc())
        .all()
    )


@router.get("/{case_id}", response_model=ReviewCaseOut)
def get_review_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(REVIEWER_ROLES)),
):
    case = db.query(ReviewCase).filter(ReviewCase.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review case not found")
    return case


@router.post("/{case_id}/action", response_model=ReviewCaseOut)
def take_review_action(
    case_id: int,
    action_in: ReviewActionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(REVIEWER_ROLES)),
):
    case = db.query(ReviewCase).filter(ReviewCase.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review case not found")

    allowed = {"approve", "modify", "reassign", "escalate", "regenerate"}
    if action_in.action not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid action. Allowed: {sorted(allowed)}",
        )

    case.reviewer_action = action_in.action
    case.reviewer_notes = action_in.notes
    audit = case.audit_log or []
    audit.append(
        {
            "at": datetime.utcnow().isoformat(),
            "by": current_user.username,
            "action": action_in.action,
            "notes": action_in.notes,
        }
    )
    case.audit_log = audit
    case.resolved_at = datetime.utcnow()

    complaint = db.query(Complaint).filter(Complaint.id == case.complaint_id).first()
    if complaint is not None and action_in.action in {"approve", "modify"}:
        from app.db.models import ComplaintStatus
        complaint.status = ComplaintStatus.assigned

    db.commit()
    db.refresh(case)
    return case
