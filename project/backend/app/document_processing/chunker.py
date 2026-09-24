from typing import List, Dict, Any


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Simple text chunking with overlap."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start = end - overlap
    return chunks


def chunk_document(parsed_content: List[Dict[str, Any]], doc_id: str, version: str) -> List[Dict[str, Any]]:
    """Chunk parsed document content with metadata."""
    chunks = []
    chunk_index = 0
    for page in parsed_content:
        if "text" in page:
            text_chunks = chunk_text(page["text"])
            for chunk_text_content in text_chunks:
                chunks.append({
                    "chunk_id": f"{doc_id}_chunk_{chunk_index}",
                    "section": f"Page {page.get('page', 'N/A')}",
                    "heading": None,
                    "page": page.get("page"),
                    "version": version,
                    "content": chunk_text_content,
                })
                chunk_index += 1
        elif "text" in page and "paragraphs" not in page:
            # DOCX paragraphs
            pass
    return chunks