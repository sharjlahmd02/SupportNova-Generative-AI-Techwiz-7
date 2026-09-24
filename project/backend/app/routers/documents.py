from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import User, UserRole, KnowledgeDocument, Chunk
from app.schemas.document import KnowledgeDocumentIn, KnowledgeDocumentOut, ChunkOut
from app.security.access_control import get_current_user, require_role
from app.document_processing.validators import validate_document
from app.document_processing.parsers import parse_pdf, parse_docx
from app.document_processing.chunker import chunk_text


router = APIRouter()


def _parse_content(filename: str, content: bytes):
    lower = (filename or "").lower()
    if lower.endswith(".pdf"):
        pages = parse_pdf(content)
        return "\n".join(p["text"] for p in pages if p.get("text"))
    if lower.endswith(".docx"):
        paras = parse_docx(content)
        return "\n".join(p["text"] for p in paras)
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Only .pdf and .docx files are supported",
    )


@router.post("/upload", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    version: str = Form(...),
    effective_date: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.manager])),
):
    content = await file.read()
    ok, err = validate_document(content, file.content_type or "")
    if not ok:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)

    try:
        effective = datetime.fromisoformat(effective_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="effective_date must be ISO-8601 (YYYY-MM-DD)",
        )

    full_text = _parse_content(file.filename or "", content)
    if not full_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No extractable text in document",
        )

    base_doc_id = (file.filename or "document").rsplit(".", 1)[0]
    doc_id = base_doc_id
    suffix = 1
    while db.query(KnowledgeDocument).filter(KnowledgeDocument.doc_id == doc_id).first():
        suffix += 1
        doc_id = f"{base_doc_id}_v{suffix}"

    # supersede prior active docs in same category+title
    prior = (
        db.query(KnowledgeDocument)
        .filter(
            KnowledgeDocument.title == file.filename,
            KnowledgeDocument.category == category,
            KnowledgeDocument.status == "active",
        )
        .all()
    )
    for p in prior:
        p.status = "superseded"

    doc = KnowledgeDocument(
        doc_id=doc_id,
        title=file.filename or doc_id,
        category=category,
        version=version,
        effective_date=effective,
        status="active",
        content=full_text,
    )
    db.add(doc)
    db.flush()

    piece_size, overlap = 1000, 200
    start = 0
    idx = 0
    while start < len(full_text):
        end = min(start + piece_size, len(full_text))
        piece = full_text[start:end]
        db.add(
            Chunk(
                chunk_id=f"{doc_id}_chunk_{idx}",
                doc_id=doc.id,
                section=f"chunk {idx}",
                heading=None,
                page=None,
                version=version,
                content=piece,
            )
        )
        idx += 1
        if end >= len(full_text):
            break
        start = end - overlap

    db.commit()
    db.refresh(doc)
    return doc


@router.get("", response_model=list[KnowledgeDocumentOut])
def list_documents(
    category: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(KnowledgeDocument)
    if category:
        q = q.filter(KnowledgeDocument.category == category)
    if status:
        q = q.filter(KnowledgeDocument.status == status)
    return q.order_by(KnowledgeDocument.created_at.desc()).all()


@router.get("/{doc_id}/chunks", response_model=list[ChunkOut])
def get_document_chunks(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return db.query(Chunk).filter(Chunk.doc_id == doc.id).all()


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin])),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    doc.status = "archived"
    db.commit()
    return {"id": doc.id, "status": doc.status}
