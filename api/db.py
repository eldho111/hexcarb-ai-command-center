import os
from typing import Generator

from sqlmodel import SQLModel, Session, create_engine


DB_URL = os.environ.get("DB_URL", "sqlite:///./hexcarb.db")
connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}
engine = create_engine(DB_URL, connect_args=connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
