import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.models import User, UserRole
from app.security.access_control import get_password_hash

DEMO_USERS = [
    {"username": "admin", "email": "admin@supportnova.local", "password": "Admin@123", "role": UserRole.admin},
    {"username": "manager", "email": "manager@supportnova.local", "password": "Manager@123", "role": UserRole.manager},
    {"username": "reviewer", "email": "reviewer@supportnova.local", "password": "Reviewer@123", "role": UserRole.reviewer},
    {"username": "agent", "email": "agent@supportnova.local", "password": "Agent@123", "role": UserRole.agent},
    {"username": "customer", "email": "customer@supportnova.local", "password": "Customer@123", "role": UserRole.customer},
]

if __name__ == "__main__":
    db = SessionLocal()
    try:
        created = 0
        for u in DEMO_USERS:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if existing:
                continue
            db.add(
                User(
                    username=u["username"],
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                )
            )
            created += 1
        db.commit()
        if created:
            print(f"Seeded {created} demo users.")
        else:
            print("Demo users already present — nothing to do.")
    finally:
        db.close()
