from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.db.models import Chunk
from app.knowledge_base.embeddings import get_embedding, cosine_similarity


def retrieve_relevant_chunks(
    db: Session,
    query: str,
    top_k: int = 5,
    category_filter: str = None,
) -> List[Chunk]:
    # TODO: generate query embedding
    # TODO: compute cosine similarity with all chunks (or filtered by category)
    # TODO: return top_k chunks
    pass