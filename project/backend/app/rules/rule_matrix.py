import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.db.models import RuleMatrixEntry
from app.schemas.rule_matrix import RuleMatrixEntry as RuleMatrixEntrySchema


RULE_MATRIX_PATH = Path(__file__).parent / "rule_matrix.json"


def load_rule_matrix_from_file() -> List[Dict[str, Any]]:
    if RULE_MATRIX_PATH.exists():
        with open(RULE_MATRIX_PATH, "r") as f:
            return json.load(f)
    return []


def load_rule_matrix_from_db(db: Session) -> List[RuleMatrixEntry]:
    return db.query(RuleMatrixEntry).all()


def get_rule_for_category(db: Session, category: str, subcategory: str) -> Optional[RuleMatrixEntry]:
    return db.query(RuleMatrixEntry).filter(
        RuleMatrixEntry.category == category,
        RuleMatrixEntry.subcategory == subcategory,
    ).first()


def get_all_rules(db: Session) -> List[RuleMatrixEntry]:
    return db.query(RuleMatrixEntry).all()


def seed_rule_matrix(db: Session, rules: List[Dict[str, Any]]) -> None:
    for rule_data in rules:
        existing = (
            db.query(RuleMatrixEntry)
            .filter(RuleMatrixEntry.rule_id == rule_data["rule_id"])
            .first()
        )
        if existing:
            for key, value in rule_data.items():
                setattr(existing, key, value)
        else:
            db.add(RuleMatrixEntry(**rule_data))
    db.commit()