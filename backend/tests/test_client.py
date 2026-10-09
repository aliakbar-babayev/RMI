import httpx
import pytest

from app.ai import client
from app.config import settings


@pytest.fixture
def ollama(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "ollama")
    monkeypatch.setattr(settings, "ollama_url", "https://llm.example.com/")
    monkeypatch.setattr(settings, "ollama_model", "gemma4:e4b")
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


def test_model_name_comes_from_settings(ollama):
    client.call_model("sys", "user")
    assert ollama["json"]["model"] == "gemma4:e4b"


def test_missing_model_is_a_clear_error(ollama, monkeypatch):
    monkeypatch.setattr(settings, "ollama_model", "")
    with pytest.raises(client.ModelUnavailableError, match="OLLAMA_MODEL"):
        client.call_model("sys", "user")


def test_rejected_key_is_a_clear_error(ollama, monkeypatch):
    monkeypatch.setattr(settings, "ollama_api_key", "wrong")
    ollama["response"] = httpx.Response(401, request=httpx.Request("POST", "https://llm.example.com"))
    with pytest.raises(client.ModelUnavailableError, match="API key"):
        client.call_model("sys", "user")


@pytest.fixture
def vertex(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "vertex")
    monkeypatch.setattr(settings, "gcp_project_id", "proj-1")
    monkeypatch.setattr(settings, "gcp_location", "us-central1")
    monkeypatch.setattr(settings, "gcp_api_key", "test-key")
    monkeypatch.setattr(settings, "vertex_model", "google/gemini-2.5-flash")
    monkeypatch.setattr(settings, "vertex_thinking_budget", None)
    sent = {}

    def fake_post(url, headers, json, timeout):
        sent.update(url=url, headers=headers, json=json)
        return sent.get("response") or httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "thinking", "thought": True}, {"text": '{"risks": []}'}]}}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(client.httpx, "post", fake_post)
    return sent


def test_vertex_request_shape(vertex):
    assert client.call_model("SYS", "USER") == '{"risks": []}'  # thought parts are skipped
    assert vertex["url"] == ("https://us-central1-aiplatform.googleapis.com/v1/projects/proj-1/locations/"
                             "us-central1/publishers/google/models/gemini-2.5-flash:generateContent")
    assert vertex["headers"] == {"x-goog-api-key": "test-key"}  # key in a header, never in the URL
    assert "test-key" not in vertex["url"]
    assert vertex["json"]["systemInstruction"]["parts"][0]["text"] == "SYS"
    assert vertex["json"]["generationConfig"]["responseMimeType"] == "application/json"
    assert client.model_name() == "vertex:gemini-2.5-flash"


@pytest.mark.parametrize(("status", "message"), [(403, "rejected the API key"), (404, "not available"), (429, "rate limit")])
def test_vertex_errors_are_clear(vertex, status, message):
    vertex["response"] = httpx.Response(status, request=httpx.Request("POST", "https://x"))
    with pytest.raises(client.ModelUnavailableError, match=message):
        client.call_model("s", "u")


def test_vertex_needs_key(vertex, monkeypatch):
    monkeypatch.setattr(settings, "gcp_api_key", "")
    with pytest.raises(client.ModelUnavailableError, match="GCP_API_KEY"):
        client.call_model("s", "u")


def test_vertex_empty_reply(vertex):
    vertex["response"] = httpx.Response(200, json={"candidates": [{"finishReason": "SAFETY"}]}, request=httpx.Request("POST", "https://x"))
    with pytest.raises(client.ModelUnavailableError, match="SAFETY"):
        client.call_model("s", "u")


def test_vertex_thinking_budget(vertex, monkeypatch):
    client.call_model("s", "u")
    assert "thinkingConfig" not in vertex["json"]["generationConfig"]
    monkeypatch.setattr(settings, "vertex_thinking_budget", 0)
    client.call_model("s", "u")
    assert vertex["json"]["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}
