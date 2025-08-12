def auth_token(client, email, password):
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200
    return r.json()["access_token"]

def test_accounting_crud_permissions(client):
    admin_token = auth_token(client, "admin@hexcarb.in", "adminpass")
    member_token = auth_token(client, "member@hexcarb.in", "memberpass")

    # member can read list
    r = client.get("/api/accounting/", headers={"Authorization": f"Bearer {member_token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    # member cannot create
    r = client.post("/api/accounting/", json={"type": "income", "amount": 1000.0, "note": "seed"}, headers={"Authorization": f"Bearer {member_token}"})
    assert r.status_code == 403

    # admin can create
    r = client.post("/api/accounting/", json={"type": "income", "amount": 1000.0, "note": "seed"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    tx = r.json()
    tx_id = tx["id"]

    # admin can update
    r = client.put(f"/api/accounting/{tx_id}", json={"type": "expense", "amount": 500.0, "note": "tools"}, headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["type"] == "expense"

    # admin can delete
    r = client.delete(f"/api/accounting/{tx_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code in (200, 204)
