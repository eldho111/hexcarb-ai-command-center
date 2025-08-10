import os
from fastapi.testclient import TestClient
from api.app import app


def _set_credentials():
    os.environ["ADMIN_USER"] = "hexcarb"
    os.environ["ADMIN_PASS"] = "PASS"


def test_unauthorized_ping():
    _set_credentials()
    client = TestClient(app)
    response = client.get("/secure/ping")
    assert response.status_code == 401
    assert response.headers.get("WWW-Authenticate") == "Basic"


def test_authorized_ping():
    _set_credentials()
    client = TestClient(app)
    response = client.get("/secure/ping", auth=("hexcarb", "PASS"))
    assert response.status_code == 200
    assert response.json() == {"ok": True}
