from app.tests.conftest import login


def test_login_success(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
    assert r.status_code == 401


def test_register_and_me(client):
    r = client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "NewPass123",
            "role": "customer",
        },
    )
    assert r.status_code == 201
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "newuser"
    assert me.json()["role"] == "customer"


def test_register_duplicate_username(client):
    payload = {
        "username": "admin",
        "email": "other@example.com",
        "password": "Whatever123",
    }
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 409


def test_register_invalid_email(client):
    r = client.post(
        "/api/auth/register",
        json={"username": "badmail", "email": "not-an-email", "password": "Whatever123"},
    )
    assert r.status_code == 422


def test_register_forces_customer_role(client):
    r = client.post(
        "/api/auth/register",
        json={
            "username": "sneaky",
            "email": "sneaky@example.com",
            "password": "Whatever123",
            "role": "admin",
        },
    )
    assert r.status_code == 201
    token = r.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["role"] == "customer"


def test_protected_route_without_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_complaints_require_auth(client):
    assert client.get("/api/complaints").status_code == 401
    assert client.post("/api/complaints", json={"title": "t", "description": "d"}).status_code == 401


def test_role_guard_blocks_customer_from_review_queue(client):
    headers = login(client, "customer", "Customer@123")
    r = client.get("/api/review/queue", headers=headers)
    assert r.status_code == 403
