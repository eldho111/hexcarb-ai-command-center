def test_login_and_me(client):
    # login as admin
    r = client.post("/auth/login", data={"username": "admin@hexcarb.in", "password": "adminpass"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    # check /auth/me with Authorization header
    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["role"] == "admin"
