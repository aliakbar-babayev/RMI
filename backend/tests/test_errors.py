import logging

from fastapi.testclient import TestClient

from app.main import app

SECRET_DOC = "Confidential plan: merger with Bank X"


def test_unexpected_error_is_generic_and_not_leaked(monkeypatch, caplog):
    def boom(*_):
        raise RuntimeError(f"failed while reading {SECRET_DOC}")

    monkeypatch.setattr("app.routers.analyze.run_analysis", boom)
    with TestClient(app, raise_server_exceptions=False) as client, caplog.at_level(logging.ERROR, "rm_ai"):
        r = client.post("/analyses", json={"text": SECRET_DOC})

    assert r.status_code == 500
    assert r.json() == {"error": "internal_error", "message": "Something went wrong."}
    assert "RuntimeError" in caplog.text and "/analyses" in caplog.text
    assert SECRET_DOC not in caplog.text
