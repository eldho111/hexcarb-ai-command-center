from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="dev-secret")

# Serve everything in ./ui as static assets
app.mount("/ui", StaticFiles(directory="ui"), name="ui")

# Jinja templates live in ./ui as well
templates = Jinja2Templates(directory="ui")

# Very small in-memory user store
USERS = {
    "admin": {"password": "password", "role": "Admin"},
    "manager": {"password": "password", "role": "Manager"},
    "user": {"password": "password", "role": "Employee"},
}

@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = USERS.get(username)
    if not user or user["password"] != password:
        return HTMLResponse("Invalid credentials", status_code=400)
    request.session["user"] = {"username": username, "role": user["role"]}
    return RedirectResponse("/dashboard", status_code=302)

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/ui/login.html", status_code=302)

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    user = request.session.get("user")
    if not user:
        return RedirectResponse("/ui/login.html", status_code=302)

    role = user["role"]
    menu = []
    if role in ("Admin", "Manager"):
        menu.append(("Accounting", "#"))
        menu.append(("HR", "#"))
    menu.append(("R&D", "#"))
    menu.append(("Secure Test", "#"))

    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "user": user, "menu": menu},
    )
