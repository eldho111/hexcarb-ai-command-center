def auth_token(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]

def test_rd_projects_and_tasks(client):
    admin_token = auth_token(client, "admin@hexcarb.in", "adminpass")

    # create project
    r = client.post("/api/rd/projects", json={"name":"SWCNT Fiber", "owner":"Eldho", "status":"active"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    pid = r.json()["id"]

    # list projects
    r = client.get("/api/rd/projects", headers={"Authorization": f"Bearer {admin_token}"})
    assert any(p["id"] == pid for p in r.json())

    # add task
    r = client.post(f"/api/rd/projects/{pid}/tasks", json={"title":"Spin test batch A","state":"todo","assignee":"Lab"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    tid = r.json()["id"]

    # list tasks
    r = client.get(f"/api/rd/projects/{pid}/tasks", headers={"Authorization": f"Bearer {admin_token}"})
    assert any(t["id"] == tid for t in r.json())
