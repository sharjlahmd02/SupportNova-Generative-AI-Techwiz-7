from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.db.session import Base


class UserRole(str, enum.Enum):
    customer = "customer"
    agent = "agent"
    reviewer = "reviewer"
    manager = "manager"
    admin = "admin"


class ComplaintStatus(str, enum.Enum):
    """SRS §5.2 lifecycle — every value a customer can be shown."""

    new = "New"
    analyzed = "Analyzed"
    assigned = "Assigned"
    in_progress = "In Progress"
    awaiting_customer = "Awaiting Customer"
    escalated = "Escalated"
    resolved = "Resolved"
    closed = "Closed"
    reopened = "Reopened"


class VerificationStatus(str, enum.Enum):
    verified = "verified"
    mismatch = "mismatch"
    manual_review = "manual_review"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.customer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    customer_type = Column(String, nullable=True)
    product_service = Column(String, nullable=True)
    order_ref = Column(String, nullable=True)
    channel = Column(String, nullable=True)
    preferred_contact = Column(String, nullable=True)
    date = Column(DateTime, default=datetime.utcnow)
    attachments = Column(JSON, nullable=True)
    prior_complaint_ref = Column(String, nullable=True)
    requested_resolution = Column(String, nullable=True)
    status = Column(SQLEnum(ComplaintStatus), default=ComplaintStatus.new, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    duplicate_of = Column(Integer, ForeignKey("complaints.id"), nullable=True)
    resolution_accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    intelligence = relationship("ComplaintIntelligence", back_populates="complaint", uselist=False)
    validation = relationship("ValidationResult", back_populates="complaint", uselist=False)
    review_case = relationship("ReviewCase", back_populates="complaint", uselist=False)
    messages = relationship(
        "ComplaintMessage",
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="ComplaintMessage.created_at",
    )
    events = relationship(
        "ComplaintEvent",
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="ComplaintEvent.created_at",
    )


class ComplaintMessage(Base):
    """SRS §4.3 / §5.3 — the customer-visible response & clarification thread."""

    __tablename__ = "complaint_messages"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String, nullable=False)
    author_role = Column(String, nullable=False)
    # clarification | reply | response | system
    kind = Column(String, nullable=False, default="reply")
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="messages")


class ComplaintEvent(Base):
    """SRS §4.2 / §5.2 — lifecycle history the customer can replay."""

    __tablename__ = "complaint_events"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    label = Column(String, nullable=False)
    detail = Column(JSON, nullable=True)
    actor = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="events")


class ComplaintIntelligence(Base):
    __tablename__ = "complaint_intelligence"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), unique=True, nullable=False)
    primary_issue = Column(String, nullable=False)
    secondary_issue = Column(String, nullable=True)
    issue_category = Column(String, nullable=False)
    subcategory = Column(String, nullable=False)
    sentiment = Column(String, nullable=False)
    urgency = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    entities = Column(JSON, nullable=True)
    department = Column(String, nullable=False)
    secondary_department = Column(String, nullable=True)
    policy_id = Column(String, nullable=True)
    policy_section = Column(String, nullable=True)
    resolution_steps = Column(JSON, nullable=True)
    escalation_required = Column(Boolean, default=False)
    escalation_reason = Column(String, nullable=True)
    escalation_level = Column(String, nullable=True)
    response_type = Column(String, nullable=True)
    customer_response = Column(Text, nullable=True)
    follow_up_required = Column(Boolean, default=False)
    follow_up_message = Column(String, nullable=True)
    clarification_questions = Column(JSON, nullable=True)
    agent_guidance = Column(JSON, nullable=True)
    prompt_version = Column(String, nullable=False)
    model = Column(String, nullable=False)
    analysis_timestamp = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="intelligence")


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), unique=True, nullable=False)
    primary_issue = Column(String, nullable=False)
    secondary_issue = Column(String, nullable=True)
    issue_category = Column(String, nullable=False)
    subcategory = Column(String, nullable=False)
    sentiment = Column(String, nullable=False)
    urgency = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    entities = Column(JSON, nullable=True)
    department = Column(String, nullable=False)
    secondary_department = Column(String, nullable=True)
    policy_id = Column(String, nullable=True)
    policy_section = Column(String, nullable=True)
    resolution_steps = Column(JSON, nullable=True)
    escalation_required = Column(Boolean, default=False)
    escalation_reason = Column(String, nullable=True)
    escalation_level = Column(String, nullable=True)
    response_type = Column(String, nullable=True)
    customer_response = Column(Text, nullable=True)
    follow_up_required = Column(Boolean, default=False)
    follow_up_message = Column(String, nullable=True)
    clarification_questions = Column(JSON, nullable=True)
    agent_guidance = Column(JSON, nullable=True)
    verification_status = Column(SQLEnum(VerificationStatus), nullable=False)
    mismatch_reasons = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="validation")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    version = Column(String, nullable=False)
    effective_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)
    status = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    chunks = relationship("Chunk", back_populates="document")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(String, unique=True, index=True, nullable=False)
    doc_id = Column(Integer, ForeignKey("knowledge_documents.id"), nullable=False)
    section = Column(String, nullable=True)
    heading = Column(String, nullable=True)
    page = Column(Integer, nullable=True)
    version = Column(String, nullable=False)
    content = Column(Text, nullable=False)

    document = relationship("KnowledgeDocument", back_populates="chunks")


class RuleMatrixEntry(Base):
    __tablename__ = "rule_matrix_entries"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, nullable=False)
    subcategory = Column(String, nullable=False)
    conditions = Column(JSON, nullable=False)
    department = Column(String, nullable=False)
    urgency = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    policy_id = Column(String, nullable=False)
    escalation_trigger = Column(JSON, nullable=False)
    required_actions = Column(JSON, nullable=True)
    prohibited_actions = Column(JSON, nullable=True)
    follow_up_rule = Column(String, nullable=True)
    # doc/company/resolution_rule_matrix.json carries a human-readable department
    # name and an explicit follow-up window alongside the DEPT code.
    department_name = Column(String, nullable=True)
    follow_up_days = Column(Integer, nullable=True)


class ReviewCase(Base):
    __tablename__ = "review_cases"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), unique=True, nullable=False)
    genai_result = Column(JSON, nullable=False)
    python_result = Column(JSON, nullable=False)
    diff = Column(JSON, nullable=False)
    reviewer_action = Column(String, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    audit_log = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    complaint = relationship("Complaint", back_populates="review_case")