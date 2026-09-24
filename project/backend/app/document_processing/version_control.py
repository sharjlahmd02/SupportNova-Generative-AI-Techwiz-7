from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.db.models import KnowledgeDocument, Chunk


def upsert_document_version(
    db: Session,
    doc_id: str,
    title: str,
    category: str,
    version: str,
    effective_date: datetime,
    expiry_date: Optional[datetime],
    content: str,
) -> KnowledgeDocument:
    # TODO: check if doc_id exists
    # TODO: if exists and version differs, mark old as superseded
    # TODO: create new document with status "active"
    pass


def get_active_document(db: Session, doc_id: str) -> Optional[KnowledgeDocument]:
    # TODO: return active document by doc_id
    pass


def get_document_chunks(db: Session, doc_id: int) -> list[Chunk]:
    # TODO: return all chunks for a document
    pass