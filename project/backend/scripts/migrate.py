"""Additive migration for the customer-side SRS pass.

SQLite cannot add a column twice, so every ALTER is guarded by
``PRAGMA table_info``. Safe to run repeatedly.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect, text

from app.db.models import Complaint, ComplaintEvent, ComplaintMessage, RuleMatrixEntry
from app.db.session import Base, engine

# column name -> DDL fragment
NEW_COMPLAINT_COLUMNS = {
    "preferred_contact": "VARCHAR",
    "duplicate_of": "INTEGER REFERENCES complaints (id)",
    "resolution_accepted_at": "DATETIME",
}

NEW_RULE_COLUMNS = {
    "department_name": "VARCHAR",
    "follow_up_days": "INTEGER",
}

# doc/company uses loyalty tiers and six intake channels; rows written before
# that swap still hold the old spellings. Normalise them in place.
LEGACY_ENUM_FIXES = {
    "customer_type": {
        "individual": "regular",
        "vip": "gold",
        "vip_gold": "gold",
        "first_time": "new",
    },
    "channel": {
        "web": "web_form",
        "web_portal": "web_form",
        "in_app": "mobile_app",
        "in_app_chat": "live_chat",
    },
    "preferred_contact": {
        "web": "web_form",
        "web_portal": "web_form",
        "in_app": "mobile_app",
        "in_app_chat": "live_chat",
    },
}


def _ensure_columns(table: str, columns: dict) -> None:
    inspector = inspect(engine)
    existing = {column["name"] for column in inspector.get_columns(table)}
    with engine.begin() as connection:
        for name, ddl in columns.items():
            if name in existing:
                continue
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
            print(f"added {table}.{name}")


def _normalise_legacy_enums() -> None:
    with engine.begin() as connection:
        for column, mapping in LEGACY_ENUM_FIXES.items():
            for raw, canonical in mapping.items():
                result = connection.execute(
                    text(
                        f"UPDATE complaints SET {column} = :new "
                        f"WHERE {column} = :old AND :new <> :old"
                    ),
                    {"new": canonical, "old": raw},
                )
                if result.rowcount:
                    print(f"complaints.{column}: {raw} -> {canonical} ({result.rowcount})")


def migrate() -> None:
    # New tables only (create_all never alters existing ones).
    Base.metadata.create_all(
        bind=engine,
        tables=[
            Complaint.__table__,
            ComplaintMessage.__table__,
            ComplaintEvent.__table__,
            RuleMatrixEntry.__table__,
        ],
    )

    _ensure_columns("complaints", NEW_COMPLAINT_COLUMNS)
    _ensure_columns("rule_matrix_entries", NEW_RULE_COLUMNS)

    with engine.begin() as connection:
        # Existing tickets need at least one history entry so the customer
        # timeline is never blank (SRS §4.7).
        connection.execute(
            text(
                """
                INSERT INTO complaint_events (complaint_id, event_type, label, detail, actor, created_at)
                SELECT id, 'created', 'Complaint submitted', NULL, 'system', created_at
                FROM complaints
                WHERE id NOT IN (SELECT complaint_id FROM complaint_events)
                """
            )
        )

    _normalise_legacy_enums()

    print("migration complete")


if __name__ == "__main__":
    migrate()
