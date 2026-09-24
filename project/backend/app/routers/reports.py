from fastapi import APIRouter, Depends, Response, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import csv
import io

from app.db.session import get_db
from app.db.models import (
    User,
    UserRole,
    Complaint,
    ComplaintIntelligence,
    ValidationResult,
    ReviewCase,
)
from app.schemas.dashboard import ReportRequest
from app.security.access_control import get_current_user, require_role


router = APIRouter()


def _filtered_complaints(db: Session, request: ReportRequest):
    q = db.query(Complaint)
    if request.start_date:
        q = q.filter(Complaint.created_at >= request.start_date)
    if request.end_date:
        q = q.filter(Complaint.created_at <= request.end_date)
    if request.status:
        q = q.filter(Complaint.status == request.status)
    if request.category or request.department or request.priority:
        q = q.join(
            ComplaintIntelligence,
            ComplaintIntelligence.complaint_id == Complaint.id,
            isouter=True,
        )
        if request.category:
            q = q.filter(ComplaintIntelligence.issue_category == request.category)
        if request.department:
            q = q.filter(ComplaintIntelligence.department == request.department)
        if request.priority:
            q = q.filter(ComplaintIntelligence.priority == request.priority)
    return q.order_by(Complaint.created_at.desc()).all()


@router.post("/export")
def export_report(
    request: ReportRequest,
    format: str = Query("csv", description="csv or json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.manager, UserRole.admin])),
):
    complaints = _filtered_complaints(db, request)
    intel = {
        i.complaint_id: i
        for i in db.query(ComplaintIntelligence).all()
    }

    rows = []
    for c in complaints:
        i = intel.get(c.id)
        rows.append(
            {
                "id": c.id,
                "title": c.title,
                "status": c.status.value,
                "created_at": c.created_at.isoformat() if c.created_at else "",
                "category": i.issue_category if i else "",
                "department": i.department if i else "",
                "priority": i.priority if i else "",
                "urgency": i.urgency if i else "",
                "sentiment": i.sentiment if i else "",
                "escalation_required": i.escalation_required if i else "",
            }
        )

    if format == "json":
        return {"count": len(rows), "rows": rows}

    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=[
            "id",
            "title",
            "status",
            "created_at",
            "category",
            "department",
            "priority",
            "urgency",
            "sentiment",
            "escalation_required",
        ],
    )
    writer.writeheader()
    writer.writerows(rows)
    csv_bytes = buf.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=complaints_report.csv"},
    )


@router.get("/comparison")
def get_comparison_report(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.manager, UserRole.admin])),
):
    q = db.query(ReviewCase)
    if start_date:
        q = q.filter(ReviewCase.created_at >= start_date)
    if end_date:
        q = q.filter(ReviewCase.created_at <= end_date)
    cases = q.order_by(ReviewCase.created_at.desc()).all()

    total = len(cases)
    verified = 0
    mismatch = 0
    manual_review = 0
    field_mismatches: dict[str, int] = {}

    for case in cases:
        diff = case.diff or {}
        if not diff:
            verified += 1
        elif any(k in diff for k in ("escalation_required", "escalation_level", "department", "urgency")):
            manual_review += 1
        else:
            mismatch += 1
        for field in diff:
            field_mismatches[field] = field_mismatches.get(field, 0) + 1

    return {
        "total_review_cases": total,
        "verified": verified,
        "mismatch": mismatch,
        "manual_review": manual_review,
        "field_mismatches": field_mismatches,
        "cases": [
            {
                "id": c.id,
                "complaint_id": c.complaint_id,
                "diff": c.diff,
                "reviewer_action": c.reviewer_action,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            }
            for c in cases
        ],
    }
