from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.db.models import User, UserRole, Complaint, ComplaintStatus
from app.schemas.complaint import ComplaintIn, ComplaintOut
from app.security.access_control import get_current_user, require_role


router = APIRouter()

STAFF_ROLES = [UserRole.agent, UserRole.reviewer, UserRole.manager, UserRole.admin]


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
    db.commit()
    db.refresh(complaint)
    return complaint


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
    # category / department / priority filters apply after Pipeline 1 attaches intelligence;
    # kept as accepted query params for API compatibility.
    return query.order_by(Complaint.created_at.desc()).offset(skip).limit(min(limit, 200)).all()


@router.get("/{complaint_id}", response_model=ComplaintOut)
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_visible_complaint(db, complaint_id, current_user)


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
    return complaint
