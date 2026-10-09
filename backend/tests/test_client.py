import httpx
import pytest

from app.ai import client
from app.config import settings


@pytest.fixture
def ollama(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "ollama_url", "https://llm.example.com/")
    sent = {}

    def fake_post(url, json, headers, timeout):
        sent.update(url=url, headers=headers, json=json)
        return sent.get("response") or httpx.Response(
            200, json={"message": {"content": '{"risks": []}'}}, request=httpx.Request("POST", url)
        )

    monkeypatch.setattr(client.httpx, "post", fake_post)
    return sent


def test_sends_api_key_when_set(ollama, monkeypatch):
    monkeypatch.setattr(settings, "ollama_api_key", "secret-key")
    assert client.call_model("sys", "user") == '{"risks": []}'
    assert ollama["url"] == "https://llm.example.com/api/chat"
    assert ollama["headers"] == {"Authorization": "Bearer secret-key"}


def test_no_auth_header_without_key(ollama, monkeypatch):
    monkeypatch.setattr(settings, "ollama_api_key", None)
    client.call_model("sys", "user")
    assert ollama["headers"] == {}


def test_rejected_key_is_a_clear_error(ollama, monkeypatch):
    monkeypatch.setattr(settings, "ollama_api_key", "wrong")
    ollama["response"] = httpx.Response(401, request=httpx.Request("POST", "https://llm.example.com"))
    with pytest.raises(client.ModelUnavailableError, match="API key"):
        client.call_model("sys", "user")
