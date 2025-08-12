from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from modules import db as coredb

app = FastAPI()

# ----- role helpers -----

def get_role(x_role: Optional[str] = Header(default="User")):
    return x_role or "User"

def require_writer(role: str = Depends(get_role)):
    if role not in {"Admin", "Manager"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    return role

# ----- pydantic models -----

class ProjectIn(BaseModel):
    name: str
    owner: str
    status: str = "active"

class Project(ProjectIn):
    id: int
    created_at: str

class TaskIn(BaseModel):
    title: str
    assignee: str = ""
    state: str = "todo"
    due_date: Optional[str] = None

class Task(TaskIn):
    id: int
    project_id: int
    created_at: str

# ----- project endpoints -----

@app.get("/api/rd/projects")
def list_projects():
    return coredb.list_projects()

@app.post("/api/rd/projects", dependencies=[Depends(require_writer)])
def create_project(p: ProjectIn):
    pid = coredb.create_project(p.name, p.owner, p.status)
    return {"id": pid}

@app.get("/api/rd/projects/{pid}")
def get_project(pid: int):
    proj = coredb.get_project(pid)
    if not proj:
        raise HTTPException(status_code=404, detail="Not found")
    return proj

@app.put("/api/rd/projects/{pid}", dependencies=[Depends(require_writer)])
def update_project(pid: int, p: ProjectIn):
    ok = coredb.update_project(pid, p.name, p.owner, p.status)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "ok"}

@app.delete("/api/rd/projects/{pid}", dependencies=[Depends(require_writer)])
def delete_project(pid: int):
    coredb.delete_project(pid)
    return {"status": "ok"}

# ----- task endpoints -----

@app.get("/api/rd/projects/{pid}/tasks")
def list_project_tasks(pid: int):
    return coredb.list_tasks(pid)

@app.post("/api/rd/projects/{pid}/tasks", dependencies=[Depends(require_writer)])
def create_task(pid: int, t: TaskIn):
    tid = coredb.create_task(pid, t.title, t.assignee, t.state, t.due_date)
    return {"id": tid}

@app.put("/api/rd/tasks/{tid}", dependencies=[Depends(require_writer)])
def update_task(tid: int, t: TaskIn):
    ok = coredb.update_task(tid, t.title, t.state, t.assignee, t.due_date)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": "ok"}

@app.delete("/api/rd/tasks/{tid}", dependencies=[Depends(require_writer)])
def delete_task(tid: int):
    coredb.delete_task(tid)
    return {"status": "ok"}
