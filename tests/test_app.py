from app import app


def test_accueil_et_sante():
    c = app.test_client()
    assert c.get("/").status_code == 200
    assert c.get("/health").get_json()["status"] == "ok"
