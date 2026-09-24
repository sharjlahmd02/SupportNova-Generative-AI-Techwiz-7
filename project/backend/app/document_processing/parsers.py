import fitz  # PyMuPDF
from docx import Document
from typing import List, Dict, Any


def parse_pdf(file_content: bytes) -> List[Dict[str, Any]]:
    """Returns list of pages with text content."""
    doc = fitz.open(stream=file_content, filetype="pdf")
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text()
        pages.append({"page": i + 1, "text": text})
    return pages


def parse_docx(file_content: bytes) -> List[Dict[str, Any]]:
    """Returns list of paragraphs with text content."""
    from io import BytesIO
    doc = Document(BytesIO(file_content))
    paragraphs = []
    for i, para in enumerate(doc.paragraphs):
        if para.text.strip():
            paragraphs.append({"index": i, "text": para.text, "style": para.style.name})
    return paragraphs