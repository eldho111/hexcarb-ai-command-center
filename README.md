# HexCarb Command Center

## Auth & Users

1. Set required environment variable `JWT_SECRET` and optional `DB_URL` (defaults to `sqlite:///./hexcarb.db`).
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   uvicorn api.app:app --reload
   ```
4. Create a user:
   ```bash
   python scripts/create_user.py admin@hexcarb.in admin
   ```
5. Login and access secure endpoints with curl:
   ```bash
   curl -i -c cookies.txt -X POST http://localhost:8000/auth/login -d "username=admin@hexcarb.in&password=PASS"
   curl -i -b cookies.txt http://localhost:8000/secure/ping
   ```
