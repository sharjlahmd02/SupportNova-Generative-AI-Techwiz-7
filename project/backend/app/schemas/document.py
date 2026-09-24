from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class KnowledgeDocumentIn(BaseModel):
    title: str
    category: str
    version: str
    effective_date: datetime
    expiry_date: Optional[datetime] = None
    content: str


class KnowledgeDocumentOut(KnowledgeDocumentIn):
    id: int
    doc_id: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChunkOut(BaseModel):
    id: int
    chunk_id: str
    doc_id: int
    section: Optional[str] = None
    heading: Optional[str] = None
    page: Optional[int] = None
    version: str
    content: str

    class Config:
        from_attributes = True