from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ...db import get_session
from ...models import Project, Task, Role
from ...auth import require_roles, get_current_user

router = APIRouter(prefix="/api/rd", tags=["rd"])

# Projects
@router.get("/projects", response_model=List[Project])
def list_projects(session: Session = Depends(get_session), user=Depends(get_current_user)):
    return session.exec(select(Project)).all()

@router.post("/projects", response_model=Project, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def create_project(p: Project, session: Session = Depends(get_session)):
    session.add(p)
    session.commit()
    session.refresh(p)
    return p

@router.put("/projects/{pid}", response_model=Project, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def update_project(pid: int, p: Project, session: Session = Depends(get_session)):
    cur = session.get(Project, pid)
    if not cur:
        raise HTTPException(404, "Not found")
    for k, v in p.dict(exclude_unset=True).items():
        setattr(cur, k, v)
    session.add(cur)
    session.commit()
    session.refresh(cur)
    return cur

@router.delete("/projects/{pid}", dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def delete_project(pid: int, session: Session = Depends(get_session)):
    cur = session.get(Project, pid)
    if not cur:
        raise HTTPException(404, "Not found")
    session.delete(cur)
    session.commit()
    return {"ok": True}

# Tasks
@router.get("/projects/{pid}/tasks", response_model=List[Task])
def list_tasks(pid: int, session: Session = Depends(get_session), user=Depends(get_current_user)):
    return session.exec(select(Task).where(Task.project_id == pid)).all()

@router.post("/projects/{pid}/tasks", response_model=Task, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def create_task(pid: int, t: Task, session: Session = Depends(get_session)):
    t.project_id = pid
    session.add(t)
    session.commit()
    session.refresh(t)
    return t

@router.put("/tasks/{tid}", response_model=Task, dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def update_task(tid: int, t: Task, session: Session = Depends(get_session)):
    cur = session.get(Task, tid)
    if not cur:
        raise HTTPException(404, "Not found")
    for k, v in t.dict(exclude_unset=True).items():
        setattr(cur, k, v)
    session.add(cur)
    session.commit()
    session.refresh(cur)
    return cur

@router.delete("/tasks/{tid}", dependencies=[Depends(require_roles([Role.admin, Role.manager]))])
def delete_task(tid: int, session: Session = Depends(get_session)):
    cur = session.get(Task, tid)
    if not cur:
        raise HTTPException(404, "Not found")
    session.delete(cur)
    session.commit()
    return {"ok": True}
