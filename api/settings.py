import os
from functools import lru_cache
from typing import List


class Settings:
    """Application settings sourced from environment variables."""

    def __init__(self) -> None:
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
        self.COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "0").lower() in {"1", "true", "yes"}
        origins = os.getenv("ALLOWED_ORIGINS", "")
        self.ALLOWED_ORIGINS: List[str] = [o for o in origins.split(",") if o]
        self.DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
