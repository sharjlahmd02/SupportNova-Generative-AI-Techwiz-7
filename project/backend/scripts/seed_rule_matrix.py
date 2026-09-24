import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.rules.rule_matrix import load_rule_matrix_from_file, seed_rule_matrix

if __name__ == "__main__":
    db = SessionLocal()
    try:
        rules = load_rule_matrix_from_file()
        if rules:
            seed_rule_matrix(db, rules)
            print(f"Seeded {len(rules)} rule matrix entries.")
        else:
            print("No rule matrix file found.")
    finally:
        db.close()