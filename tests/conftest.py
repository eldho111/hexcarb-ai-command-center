import os
import tempfile
import pytest
from fastapi.testclient import TestClient

# Set a temp SQLite database for tests before app import
tmpdb = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{tmpdb.name}"
os.environ["SECRET_KEY"] = "testsecret"
os.environ["COOKIE_SECURE"] = "false"
os.environ["ALLOWED_ORIGINS"] = "http://testserver"

from api.app import app  # noqa
from api.db import init_db, get_session, engine
from sqlmodel import Session
from api.models import User, Role
from api.auth import get_password_hash

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    init_db()
    # create two users
    with Session(engine) as s:
        if not s.query(User).first():
            s.add(User(email="admin@hexcarb.in", hashed_password=get_password_hash("adminpass"), role=Role.admin))
            s.add(User(email="member@hexcarb.in", hashed_password=get_password_hash("memberpass"), role=Role.member))
            s.commit()
    yield

@pytest.fixture
def client():
    return TestClient(app)
