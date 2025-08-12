"""Utility script to initialize the database without running migrations."""
from sqlmodel import SQLModel

from api.db import engine


def main() -> None:
    SQLModel.metadata.create_all(engine)


if __name__ == "__main__":
    main()
