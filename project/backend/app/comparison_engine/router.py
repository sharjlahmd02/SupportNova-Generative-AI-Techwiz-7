from typing import Dict, Any
from sqlalchemy.orm import Session

from app.db.models import ReviewCase, VerificationStatus
from app.comparison_engine.diff import diff_pipelines
from app.comparison_engine.verification_score import calculate_verification_score, determine_verification_status


def route_complaint(
    db: Session,
    complaint_id: int,
    genai_result: Dict[str, Any],
    python_result: Dict[str, Any],
) -> tuple[VerificationStatus, Dict[str, Any], ReviewCase | None]:
    diff = diff_pipelines(genai_result, python_result)
    score = calculate_verification_score(diff)
    status = determine_verification_status(diff, score)

    review_case = None
    if status in (VerificationStatus.mismatch, VerificationStatus.manual_review):
        review_case = ReviewCase(
            complaint_id=complaint_id,
            genai_result=genai_result,
            python_result=python_result,
            diff=diff,
        )
        db.add(review_case)
        db.commit()
        db.refresh(review_case)

    return status, diff, review_case