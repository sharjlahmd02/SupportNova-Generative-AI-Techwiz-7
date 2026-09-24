import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import Base, get_db
from app.db.models import User, UserRole, RuleMatrixEntry
from app.security.access_control import get_password_hash
from app.rules.rule_matrix import load_rule_matrix_from_file, seed_rule_matrix


SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    seed_rule_matrix(session, load_rule_matrix_from_file())
    session.add(
        User(
            username="admin",
            email="admin@test.local",
            hashed_password=get_password_hash("Admin@123"),
            role=UserRole.admin,
        )
    )
    session.add(
        User(
            username="customer",
            email="customer@test.local",
            hashed_password=get_password_hash("Customer@123"),
            role=UserRole.customer,
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def login(client, username, password):
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
