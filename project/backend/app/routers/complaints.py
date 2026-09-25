from datetime import datetime
from pathlib import Path
from typing import Optional
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import (
    User,
    UserRole,
    Complaint,
    ComplaintStatus,
    ComplaintIntelligence,
    ValidationResult,
    ComplaintMessage,
    ComplaintEvent,
)
from app.schemas.complaint import (
    ComplaintIn,
    ComplaintOut,
    DuplicateCheckIn,
    DuplicateCandidate,
    EventOut,
    MessageIn,
    MessageOut,
)
from app.security.access_control import get_current_user, require_role
from app.security.input_sanitizer import sanitize_text


router = APIRouter()

STAFF_ROLES = [UserRole.agent, UserRole.reviewer, UserRole.manager, UserRole.admin]

# SRS §5.1 — the submission form only accepts these attachment types, max 5MB each.
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ATTACHMENTS = 5
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"

# SRS §6 duplicate detection: near-identical tickets from the same customer.
_DUPLICATE_THRESHOLD = 0.4
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
    "with", "my", "i", "me", "is", "am", "are", "was", "were", "be", "been",
    "it", "this", "that", "from", "by", "as", "so", "we", "you",
}


def _pipeline_summaries(
    db: Session, complaint_ids: list[int], narrative: bool = False
) -> dict[int, dict]:
    """Batch-load Pipeline 1 / Pipeline 2 summaries so list endpoints stay O(1) queries.

    ``narrative=True` also pulls the customer-facing prose (official response,
    next steps, clarification questions) — only the detail endpoint needs it.
    """
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
        if narrative:
            summaries[intel.complaint_id].update(
                clarification_questions=intel.clarification_questions or [],
                resolution_steps=intel.resolution_steps or [],
                customer_response=intel.customer_response,
                follow_up_message=intel.follow_up_message,
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
        if narrative:
            summary.setdefault("clarification_questions", result.clarification_questions or [])
            summary.setdefault("resolution_steps", result.resolution_steps or [])
            summary.setdefault("customer_response", result.customer_response)
            summary.setdefault("follow_up_message", result.follow_up_message)

    return summaries


def _serialize(db: Session, complaint: Complaint, summaries: Optional[dict] = None) -> dict:
    if summaries is None:
        summaries = _pipeline_summaries(db, [complaint.id], narrative=True)
    payload = {
        "id": complaint.id,
        "title": complaint.title,
        "description": complaint.description,
        "customer_type": complaint.customer_type,
        "product_service": complaint.product_service,
        "order_ref": complaint.order_ref,
        "channel": complaint.channel,
        "preferred_contact": complaint.preferred_contact,
        "attachments": complaint.attachments,
        "prior_complaint_ref": complaint.prior_complaint_ref,
        "requested_resolution": complaint.requested_resolution,
        "status": complaint.status.value if complaint.status else None,
        "customer_id": complaint.customer_id,
        "duplicate_of": complaint.duplicate_of,
        "resolution_accepted_at": complaint.resolution_accepted_at,
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


def _record_event(
    db: Session,
    complaint: Complaint,
    event_type: str,
    label: str,
    detail: Optional[dict] = None,
    actor: Optional[str] = None,
) -> ComplaintEvent:
    """SRS §5.2 — every lifecycle step the customer can replay in the history view."""
    event = ComplaintEvent(
        complaint_id=complaint.id,
        event_type=event_type,
        label=label,
        detail=detail,
        actor=actor,
    )
    db.add(event)
    return event


def _record_message(
    db: Session, complaint: Complaint, user: User, kind: str, body: str
) -> ComplaintMessage:
    message = ComplaintMessage(
        complaint_id=complaint.id,
        author_id=user.id,
        author_name=user.username,
        author_role=user.role.value if hasattr(user.role, "value") else str(user.role),
        kind=kind,
        body=body,
    )
    db.add(message)
    return message


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", (text or "").lower())
        if token not in _STOPWORDS and len(token) > 2
    }


def _similarity(left: str, right: str) -> float:
    a, b = _tokens(left), _tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def find_duplicates(
    db: Session,
    customer_id: int,
    title: str,
    description: str = "",
    limit: int = 3,
    exclude_id: Optional[int] = None,
) -> list[Complaint]:
    """SRS §6 — near-duplicate tickets raised by the same customer."""
    open_statuses = [s for s in ComplaintStatus if s != ComplaintStatus.closed]
    query = db.query(Complaint).filter(
        Complaint.customer_id == customer_id, Complaint.status.in_(open_statuses)
    )
    if exclude_id is not None:
        query = query.filter(Complaint.id != exclude_id)
    candidates = query.order_by(Complaint.created_at.desc()).limit(100).all()
    needle = f"{title} {description}"
    scored = []
    for candidate in candidates:
        score = max(
            _similarity(title, candidate.title),
            _similarity(needle, f"{candidate.title} {candidate.description or ''}"),
        )
        if score >= _DUPLICATE_THRESHOLD:
            scored.append((score, candidate))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [complaint for _, complaint in scored[:limit]]


def _resolve_status_filter(requested: str) -> ComplaintStatus:
    """Accept both the stored member name (``new``) and the visible value (``New``)."""
    wanted = (requested or "").strip()
    compact = wanted.replace(" ", "_").lower()
    for member in ComplaintStatus:
        if member.name.lower() in (wanted.lower(), compact) or member.value.lower() == wanted.lower():
            return member
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid status filter. Allowed: {[s.value for s in ComplaintStatus]}",
    )


@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
def create_complaint(
    complaint_in: ComplaintIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if complaint_in.channel == "document_upload" and not complaint_in.attachments:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The document upload channel needs at least one file attached.",
        )

    complaint = Complaint(
        title=complaint_in.title,
        description=complaint_in.description,
        customer_type=complaint_in.customer_type,
        product_service=complaint_in.product_service,
        order_ref=complaint_in.order_ref,
        channel=complaint_in.channel,
        preferred_contact=complaint_in.preferred_contact or "web_form",
        attachments=complaint_in.attachments,
        prior_complaint_ref=complaint_in.prior_complaint_ref,
        requested_resolution=complaint_in.requested_resolution,
        status=ComplaintStatus.new,
        customer_id=current_user.id,
    )
    db.add(complaint)
    db.flush()

    duplicates = find_duplicates(
        db,
        current_user.id,
        complaint.title,
        complaint.description,
        exclude_id=complaint.id,
    )
    if duplicates:
        complaint.duplicate_of = duplicates[0].id

    _record_event(
        db,
        complaint,
        "created",
        "Complaint submitted",
        detail={"channel": complaint.channel, "duplicate_of": complaint.duplicate_of},
        actor=current_user.username,
    )
    db.add(
        ComplaintMessage(
            complaint_id=complaint.id,
            author_id=current_user.id,
            author_name=current_user.username,
            author_role="customer",
            kind="system",
            body="Complaint received. It is queued for GenAI analysis and independent Python verification.",
        )
    )

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


@router.post("/duplicate-check", response_model=list[DuplicateCandidate])
def duplicate_check(
    payload: DuplicateCheckIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SRS §6 — warn *before* the customer files a second identical ticket."""
    matches = find_duplicates(db, current_user.id, payload.title, payload.description or "")
    return [
        DuplicateCandidate(
            id=complaint.id,
            title=complaint.title,
            status=complaint.status.value,
            similarity=round(
                max(
                    _similarity(payload.title, complaint.title),
                    _similarity(
                        f"{payload.title} {payload.description or ''}",
                        f"{complaint.title} {complaint.description or ''}",
                    ),
                ),
                2,
            ),
            created_at=complaint.created_at,
        )
        for complaint in matches
    ]


@router.post("/attachments", status_code=status.HTTP_201_CREATED)
async def upload_attachments(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """SRS §5.1 — drag-and-drop attachments with type + size validation."""
    if not files:
        raise HTTPException(status_code=422, detail="Attach at least one file.")
    if len(files) > MAX_ATTACHMENTS:
        raise HTTPException(
            status_code=422, detail=f"Attach at most {MAX_ATTACHMENTS} files."
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored = []
    for upload in files:
        original = Path(upload.filename or "file").name
        extension = Path(original).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail=f"'{original}' is not supported. Use PDF, DOCX, TXT, PNG or JPG.",
            )
        content = await upload.read()
        if not content:
            raise HTTPException(status_code=422, detail=f"'{original}' is empty.")
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=422,
                detail=f"'{original}' is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
            )

        safe_stem = re.sub(r"[^A-Za-z0-9._-]", "_", Path(original).stem)[:60] or "file"
        stored_name = f"{uuid.uuid4().hex[:10]}_{safe_stem}{extension}"
        (UPLOAD_DIR / stored_name).write_bytes(content)
        stored.append(
            {
                "filename": stored_name,
                "original_name": original,
                "content_type": upload.content_type or "application/octet-stream",
                "size": len(content),
            }
        )
    return {"files": stored}


@router.get("", response_model=list[ComplaintOut])
def list_complaints(
    status: Optional[str] = None,
    category: Optional[str] = None,
    department: Optional[str] = None,
    priority: Optional[str] = None,
    q: Optional[str] = Query(None, description="Free-text search (SRS §4.7)"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Complaint)
    if current_user.role == UserRole.customer:
        query = query.filter(Complaint.customer_id == current_user.id)
    if status:
        query = query.filter(Complaint.status == _resolve_status_filter(status))
    if q and q.strip():
        needle = f"%{sanitize_text(q, max_length=120) or ''}%"
        query = query.filter(
            or_(
                Complaint.title.ilike(needle),
                Complaint.description.ilike(needle),
                Complaint.order_ref.ilike(needle),
                Complaint.prior_complaint_ref.ilike(needle),
                Complaint.product_service.ilike(needle),
            )
        )
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


@router.get("/{complaint_id}/events", response_model=list[EventOut])
def list_events(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SRS §4.7 — the full lifecycle history of one complaint."""
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    return (
        db.query(ComplaintEvent)
        .filter(ComplaintEvent.complaint_id == complaint.id)
        .order_by(ComplaintEvent.created_at.asc())
        .all()
    )


@router.get("/{complaint_id}/messages", response_model=list[MessageOut])
def list_messages(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SRS §5.3 — responses, clarifications and the customer's own replies."""
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    return (
        db.query(ComplaintMessage)
        .filter(ComplaintMessage.complaint_id == complaint.id)
        .order_by(ComplaintMessage.created_at.asc())
        .all()
    )


@router.post("/{complaint_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    complaint_id: int,
    payload: MessageIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    is_customer = current_user.role == UserRole.customer
    kind = "reply" if is_customer else "response"
    message = _record_message(db, complaint, current_user, kind, payload.body)

    # SRS §4.3 — answering a clarification request moves the ticket forward again.
    if is_customer and complaint.status == ComplaintStatus.awaiting_customer:
        complaint.status = ComplaintStatus.in_progress
        _record_event(
            db,
            complaint,
            "status",
            "Customer clarification received",
            detail={"from": "Awaiting Customer", "to": "In Progress"},
            actor=current_user.username,
        )

    _record_event(
        db,
        complaint,
        "message",
        "Reply added to the thread",
        detail={"kind": kind},
        actor=current_user.username,
    )
    db.commit()
    db.refresh(message)
    return message


@router.post("/{complaint_id}/clarifications", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def request_clarification(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(STAFF_ROLES)),
):
    """SRS §4.3 — raise the analysis' missing-information questions to the customer."""
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    intelligence = (
        db.query(ComplaintIntelligence)
        .filter(ComplaintIntelligence.complaint_id == complaint.id)
        .first()
    )
    questions = list((intelligence.clarification_questions if intelligence else None) or [])
    if not questions:
        raise HTTPException(
            status_code=422,
            detail="This complaint has no clarification questions to send.",
        )

    body = "\n".join(f"{index + 1}. {question}" for index, question in enumerate(questions))
    message = ComplaintMessage(
        complaint_id=complaint.id,
        author_id=current_user.id,
        author_name="SupportNova analysis",
        author_role="agent",
        kind="clarification",
        body=body,
    )
    db.add(message)
    complaint.status = ComplaintStatus.awaiting_customer
    _record_event(
        db,
        complaint,
        "status",
        "More information requested",
        detail={"from": "Analyzed", "to": "Awaiting Customer", "questions": questions},
        actor=current_user.username,
    )
    db.commit()
    db.refresh(message)
    return message


@router.post("/{complaint_id}/accept", response_model=ComplaintOut)
def accept_resolution(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SRS §4.5 — the customer formally acknowledges and closes the ticket."""
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    if complaint.status == ComplaintStatus.closed:
        return _serialize(db, complaint)
    if complaint.status not in (ComplaintStatus.resolved,):
        raise HTTPException(
            status_code=422,
            detail="Only a resolved complaint can be accepted. Current status: "
            + complaint.status.value,
        )

    previous = complaint.status.value
    complaint.status = ComplaintStatus.closed
    complaint.resolution_accepted_at = datetime.utcnow()
    db.add(
        ComplaintMessage(
            complaint_id=complaint.id,
            author_id=current_user.id,
            author_name=current_user.username,
            author_role="customer",
            kind="system",
            body="Resolution accepted by the customer — the ticket is now closed.",
        )
    )
    _record_event(
        db,
        complaint,
        "status",
        "Resolution accepted",
        detail={"from": previous, "to": "Closed"},
        actor=current_user.username,
    )
    db.commit()
    db.refresh(complaint)
    return _serialize(db, complaint)


@router.post("/{complaint_id}/reopen", response_model=ComplaintOut)
def reopen_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SRS §4.6 — reopen a closed complaint when the issue persists."""
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    if complaint.status in (ComplaintStatus.closed, ComplaintStatus.resolved):
        previous = complaint.status.value
        complaint.status = ComplaintStatus.reopened
        complaint.resolution_accepted_at = None
        db.add(
            ComplaintMessage(
                complaint_id=complaint.id,
                author_id=current_user.id,
                author_name=current_user.username,
                author_role="customer",
                kind="system",
                body="Reopened by the customer — the issue is reported as unresolved.",
            )
        )
        _record_event(
            db,
            complaint,
            "status",
            "Complaint reopened",
            detail={"from": previous, "to": "Reopened"},
            actor=current_user.username,
        )
        db.commit()
        db.refresh(complaint)
        return _serialize(db, complaint)

    raise HTTPException(
        status_code=422,
        detail="Only a resolved or closed complaint can be reopened. Current status: "
        + complaint.status.value,
    )


@router.get("/{complaint_id}/attachments/{stored_name}")
def download_attachment(
    complaint_id: int,
    stored_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    attachments = complaint.attachments if isinstance(complaint.attachments, list) else []
    known = {
        item.get("filename")
        for item in attachments
        if isinstance(item, dict) and isinstance(item.get("filename"), str)
    }
    safe_name = Path(stored_name).name
    if safe_name not in known:
        raise HTTPException(status_code=404, detail="Attachment not found")

    target = UPLOAD_DIR / safe_name
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Attachment file is missing on the server")

    original = next(
        (
            item.get("original_name") or safe_name
            for item in attachments
            if isinstance(item, dict) and item.get("filename") == safe_name
        ),
        safe_name,
    )
    return FileResponse(target, filename=original)


@router.patch("/{complaint_id}/status", response_model=ComplaintOut)
def update_complaint_status(
    complaint_id: int,
    new_status: str = Query(..., description="New status value"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(STAFF_ROLES)),
):
    complaint = _get_visible_complaint(db, complaint_id, current_user)
    try:
        target = ComplaintStatus(new_status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Allowed: {[s.value for s in ComplaintStatus]}",
        )

    previous = complaint.status.value if complaint.status else None
    complaint.status = target
    if target != ComplaintStatus.closed:
        complaint.resolution_accepted_at = None
    if previous != target:
        _record_event(
            db,
            complaint,
            "status",
            f"Status changed to {target.value}",
            detail={"from": previous, "to": target.value},
            actor=current_user.username,
        )
    db.commit()
    db.refresh(complaint)
    return _serialize(db, complaint)
