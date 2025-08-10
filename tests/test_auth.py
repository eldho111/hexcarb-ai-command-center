import os

os.environ["JWT_SECRET"] = "TEST_SECRET"

from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from passlib.context import CryptContext

from api.app import app
from api.db import get_session
from api.models import RoleEnum, User

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _create_test_app():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    def get_session_override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_session_override

    with Session(engine) as session:
        admin = User(email="admin@hexcarb.in", password_hash=pwd.hash("PASS"), role=RoleEnum.admin)
        ops = User(email="ops@hexcarb.in", password_hash=pwd.hash("PASS"), role=RoleEnum.ops)
        session.add(admin)
        session.add(ops)
        session.commit()

    return TestClient(app)


def test_unauthorized_ping():
    client = _create_test_app()
    response = client.get("/secure/ping")
    assert response.status_code == 401


def test_login_and_ping():
    client = _create_test_app()
    login = client.post("/auth/login", data={"username": "admin@hexcarb.in", "password": "PASS"})
    assert login.status_code == 200
    token = login.cookies.get("hc_token")
    assert token
    ping = client.get("/secure/ping", cookies={"hc_token": token})
    assert ping.status_code == 200
    assert ping.json() == {"ok": True}


def test_role_checks():
    client = _create_test_app()
    login_ops = client.post("/auth/login", data={"username": "ops@hexcarb.in", "password": "PASS"})
    token_ops = login_ops.cookies.get("hc_token")
    forbidden = client.get("/secure/admin-only", cookies={"hc_token": token_ops})
    assert forbidden.status_code == 403

    login_admin = client.post("/auth/login", data={"username": "admin@hexcarb.in", "password": "PASS"})
    token_admin = login_admin.cookies.get("hc_token")
    allowed = client.get("/secure/admin-only", cookies={"hc_token": token_admin})
    assert allowed.status_code == 200
    assert allowed.json() == {"ok": True}
