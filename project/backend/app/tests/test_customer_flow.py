"""Customer-side SRS coverage: §4 actions, §5 displays, §6 safety."""

from app.tests.conftest import login


def _create(client, headers, title="Flight booking refund not received", **extra):
    payload = {"title": title, "description": "I have not received my refund for the cancelled flight."}
    payload.update(extra)
    response = client.post("/api/complaints", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_preferred_contact_is_stored(client):
    headers = login(client, "customer", "Customer@123")
    complaint = _create(client, headers, preferred_contact="email", channel="web_form")
    assert complaint["preferred_contact"] == "email"
    assert complaint["channel"] == "web_form"


def test_legacy_channel_aliases_are_normalised(client):
    """Rows written before the TravelNova channel swap still map cleanly."""
    headers = login(client, "customer", "Customer@123")
    complaint = _create(client, headers, customer_type="first_time", channel="web_portal")
    assert complaint["customer_type"] == "new"
    assert complaint["channel"] == "web_form"


def test_unknown_customer_type_is_rejected(client):
    headers = login(client, "customer", "Customer@123")
    response = client.post(
        "/api/complaints",
        json={"title": "Bad tier", "description": "Not a loyalty tier", "customer_type": "platinum_tier"},
        headers=headers,
    )
    assert response.status_code == 422


def test_document_upload_channel_requires_a_file(client):
    headers = login(client, "customer", "Customer@123")
    response = client.post(
        "/api/complaints",
        json={"title": "Missing boarding pass", "description": "See attached letter", "channel": "document_upload"},
        headers=headers,
    )
    assert response.status_code == 422


def test_duplicate_warning_before_submit(client):
    headers = login(client, "customer", "Customer@123")
    _create(client, headers, title="Refund missing for booking PNR 12345")

    check = client.post(
        "/api/complaints/duplicate-check",
        json={"title": "Refund is missing for booking PNR 12345"},
        headers=headers,
    )
    assert check.status_code == 200, check.text
    candidates = check.json()
    assert candidates, "expected the near-identical ticket to be reported"
    assert candidates[0]["similarity"] >= 0.4


def test_duplicate_is_linked_on_create(client):
    headers = login(client, "customer", "Customer@123")
    first = _create(client, headers, title="NovaCloud backup restore failed")
    second = _create(client, headers, title="NovaCloud backup restore has failed")
    assert second["duplicate_of"] == first["id"]


def test_free_text_search(client):
    headers = login(client, "customer", "Customer@123")
    created = _create(client, headers, title="Invoice 88213 charged twice")

    found = client.get("/api/complaints?q=88213", headers=headers)
    assert found.status_code == 200
    assert any(row["id"] == created["id"] for row in found.json())

    missing = client.get("/api/complaints?q=zzzznotfound", headers=headers)
    assert missing.json() == []


def test_status_filter_accepts_visible_value(client):
    headers = login(client, "customer", "Customer@123")
    _create(client, headers, title="Status filter probe")
    response = client.get("/api/complaints?status=New", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()


def test_clarification_reply_moves_status_forward(client, db_session):
    headers = login(client, "customer", "Customer@123")
    complaint = _create(client, headers, title="Rebooking needed for itinerary")
    cid = complaint["id"]

    # The analysis marks the ticket as needing more information (SRS §4.3).
    from app.db.models import Complaint, ComplaintStatus

    row = db_session.query(Complaint).filter(Complaint.id == cid).first()
    row.status = ComplaintStatus.awaiting_customer
    db_session.commit()

    posted = client.post(
        f"/api/complaints/{cid}/messages",
        json={"body": "My PNR is ABC123 and the receipt is attached."},
        headers=headers,
    )
    assert posted.status_code == 201, posted.text
    assert posted.json()["kind"] == "reply"

    thread = client.get(f"/api/complaints/{cid}/messages", headers=headers)
    assert thread.status_code == 200
    kinds = [message["kind"] for message in thread.json()]
    assert "reply" in kinds and "system" in kinds

    refreshed = client.get(f"/api/complaints/{cid}", headers=headers).json()
    assert refreshed["status"] == "In Progress"


def test_accept_then_reopen(client):
    headers = login(client, "customer", "Customer@123")
    cid = _create(client, headers, title="Damaged parcel arrived")["id"]

    too_early = client.post(f"/api/complaints/{cid}/accept", headers=headers)
    assert too_early.status_code == 422

    admin = login(client, "admin", "Admin@123")
    client.patch(f"/api/complaints/{cid}/status?new_status=Resolved", headers=admin)

    accepted = client.post(f"/api/complaints/{cid}/accept", headers=headers)
    assert accepted.status_code == 200, accepted.text
    body = accepted.json()
    assert body["status"] == "Closed"
    assert body["resolution_accepted_at"]

    reopened = client.post(f"/api/complaints/{cid}/reopen", headers=headers)
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["status"] == "Reopened"
    assert reopened.json()["resolution_accepted_at"] is None


def test_history_timeline_is_recorded(client):
    headers = login(client, "customer", "Customer@123")
    cid = _create(client, headers, title="Timeline probe")["id"]

    events = client.get(f"/api/complaints/{cid}/events", headers=headers)
    assert events.status_code == 200
    labels = [event["label"] for event in events.json()]
    assert "Complaint submitted" in labels


def test_customer_cannot_read_another_customers_thread(client):
    mine = login(client, "customer", "Customer@123")
    cid = _create(client, mine, title="Private thread")["id"]

    client.post(
        "/api/auth/register",
        json={"username": "cust2", "email": "c2@example.com", "password": "Pass12345"},
    )
    other = login(client, "cust2", "Pass12345")
    assert client.get(f"/api/complaints/{cid}/messages", headers=other).status_code == 403
    assert client.post(
        f"/api/complaints/{cid}/messages", json={"body": "hi"}, headers=other
    ).status_code == 403


def test_text_is_normalized(client):
    headers = login(client, "customer", "Customer@123")
    complaint = _create(
        client,
        headers,
        title="   Spaced    out   title   ",
        description="Line one.\r\n\r\n\r\n\r\nLine   two\t\tthree.",
        requested_resolution="",
    )
    assert complaint["title"] == "Spaced out title"
    assert "\n\n\n" not in complaint["description"]
    assert "\t" not in complaint["description"]
    assert complaint["requested_resolution"] is None


def test_attachment_upload_rejects_unsupported_type(client):
    headers = login(client, "customer", "Customer@123")
    response = client.post(
        "/api/complaints/attachments",
        files=[("files", ("installer.exe", b"MZ\x90\x00", "application/octet-stream"))],
        headers=headers,
    )
    assert response.status_code == 422
    assert "PDF" in response.json()["detail"]


def test_attachment_upload_accepts_supported_types(client):
    headers = login(client, "customer", "Customer@123")
    response = client.post(
        "/api/complaints/attachments",
        files=[("files", ("receipt.pdf", b"%PDF-1.4\nfake", "application/pdf"))],
        headers=headers,
    )
    assert response.status_code == 201, response.text
    stored = response.json()["files"][0]
    assert stored["original_name"] == "receipt.pdf"
    assert stored["size"] > 0

    # The stored file is only reachable through a complaint the customer owns.
    cid = _create(client, headers, title="Receipt attached", attachments=[stored])["id"]
    download = client.get(
        f"/api/complaints/{cid}/attachments/{stored['filename']}", headers=headers
    )
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF")

    other = client.get(
        f"/api/complaints/{cid}/attachments/{stored['filename']}",
        headers=login(client, "admin", "Admin@123"),
    )
    assert other.status_code == 200  # staff may read any ticket
