from sqlmodel import SQLModel, Session, create_engine

from .settings import get_settings

settings = get_settings()
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)


def init_db() -> None:
    """Create database tables."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    """Yield a database session."""
    with Session(engine) as session:
        yield session
