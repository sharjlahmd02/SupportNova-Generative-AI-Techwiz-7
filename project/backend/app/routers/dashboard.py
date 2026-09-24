from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User,
    UserRole,
    Complaint,
    ComplaintIntelligence,
    ValidationResult,
    VerificationStatus,
    ReviewCase,
)
from app.schemas.dashboard import DashboardStats
from app.security.access_control import get_current_user, require_role


router = APIRouter()

STAFF_ROLES = [UserRole.agent, UserRole.reviewer, UserRole.manager, UserRole.admin]


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Complaint)
    if current_user.role == UserRole.customer:
        query = query.filter(Complaint.customer_id == current_user.id)
    complaints = query.all()

    by_status = Counter(c.status.value for c in complaints)

    intelligence_rows = []
    if current_user.role != UserRole.customer:
        intelligence_rows = db.query(ComplaintIntelligence).all()
    else:
        own_ids = [c.id for c in complaints]
        if own_ids:
            intelligence_rows = (
                db.query(ComplaintIntelligence)
                .filter(ComplaintIntelligence.complaint_id.in_(own_ids))
                .all()
            )

    by_category = Counter(i.issue_category for i in intelligence_rows)
    by_department = Counter(i.department for i in intelligence_rows)
    by_priority = Counter(i.priority for i in intelligence_rows)
    by_sentiment = Counter(i.sentiment for i in intelligence_rows)
    escalation_count = sum(1 for i in intelligence_rows if i.escalation_required)

    mismatch_count = 0
    manual_review_count = 0
    if current_user.role != UserRole.customer:
        statuses = db.query(ValidationResult.verification_status).all()
        for (st,) in statuses:
            if st == VerificationStatus.mismatch:
                mismatch_count += 1
            elif st == VerificationStatus.manual_review:
                manual_review_count += 1

    return DashboardStats(
        total_complaints=len(complaints),
        by_status=dict(by_status),
        by_category=dict(by_category),
        by_department=dict(by_department),
        by_priority=dict(by_priority),
        by_sentiment=dict(by_sentiment),
        escalation_count=escalation_count,
        mismatch_count=mismatch_count,
        manual_review_count=manual_review_count,
        avg_resolution_time_hours=None,
    )


@router.get("/complaints")
def get_complaints_for_dashboard(
    role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Complaint)
    effective_role = current_user.role.value
    if current_user.role == UserRole.customer:
        query = query.filter(Complaint.customer_id == current_user.id)
    elif role == "agent" and current_user.role in STAFF_ROLES:
        # Agents see all open work; no assignment column yet
        query = query.filter(Complaint.status.notin_(["Closed", "Resolved"]))
    return query.order_by(Complaint.created_at.desc()).limit(100).all()
