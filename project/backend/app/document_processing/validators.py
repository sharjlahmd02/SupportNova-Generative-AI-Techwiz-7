ALLOWED_TYPES = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_document(file_content: bytes, content_type: str) -> tuple[bool, str]:
    if content_type not in ALLOWED_TYPES:
        return False, f"Unsupported file type: {content_type}"
    if len(file_content) > MAX_FILE_SIZE:
        return False, f"File size exceeds {MAX_FILE_SIZE / 1024 / 1024}MB limit"
    if len(file_content) == 0:
        return False, "Empty file"
    return True, ""