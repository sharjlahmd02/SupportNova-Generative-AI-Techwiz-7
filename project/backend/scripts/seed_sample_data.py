import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.models import KnowledgeDocument, Chunk
from datetime import datetime

if __name__ == "__main__":
    db = SessionLocal()
    try:
        # TODO: Add sample complaints and policy documents
        print("Sample data seeding not yet implemented.")
    finally:
        db.close()