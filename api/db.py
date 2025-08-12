import os
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local.db")

# SQLite needs check_same_thread=False
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args, pool_pre_ping=True)

def init_db():
    from . import models  # noqa: F401  (ensures models are imported)
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
