from fastapi import FastAPI
from subprocess import check_output
import datetime

app = FastAPI()

def _git_sha():
    try:
        return check_output(["git", "rev-parse", "--short", "HEAD"]).decode().strip()
    except Exception:
        return "unknown"

@app.get("/version")
def version():
    return {"commit": _git_sha(), "timestamp": datetime.datetime.utcnow().isoformat() + "Z"}

@app.get("/healthz")
def healthz():
    return {"ok": True}
