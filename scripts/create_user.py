from getpass import getpass
import sys

from passlib.context import CryptContext
from sqlmodel import Session

from api.db import engine, init_db
from api.models import RoleEnum, User


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python scripts/create_user.py EMAIL ROLE")
        sys.exit(1)
    email = sys.argv[1]
    role = sys.argv[2]
    if role not in RoleEnum.__members__:
        print("Role must be one of: admin, ops, viewer")
        sys.exit(1)
    password = getpass("Password: ")
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    init_db()
    with Session(engine) as session:
        user = User(email=email, password_hash=pwd_context.hash(password), role=RoleEnum[role])
        session.add(user)
        session.commit()
        print(f"Created user {email} with role {role}")


if __name__ == "__main__":
    main()
