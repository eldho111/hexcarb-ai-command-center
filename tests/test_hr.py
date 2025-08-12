def auth_token(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]

def test_hr_crud_permissions(client):
    admin_token = auth_token(client, "admin@hexcarb.in", "adminpass")
    member_token = auth_token(client, "member@hexcarb.in", "memberpass")

    # member can list employees
    r = client.get("/api/hr/", headers={"Authorization": f"Bearer {member_token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # member cannot create employee
    r = client.post(
        "/api/hr/",
        json={"name": "Alice", "email": "alice@hexcarb.in", "role": "engineer"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert r.status_code == 403

    # admin can create
    r = client.post(
        "/api/hr/",
        json={"name": "Alice", "email": "alice@hexcarb.in", "role": "engineer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    emp_id = r.json()["id"]

    # admin can update
    r = client.put(
        f"/api/hr/{emp_id}",
        json={"status": "inactive"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "inactive"

    # admin can delete
    r = client.delete(f"/api/hr/{emp_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code in (200, 204)
