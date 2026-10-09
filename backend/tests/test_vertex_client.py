from unittest.mock import MagicMock, patch
import pytest

from app.ai import client
from app.config import settings
from app.models.schemas import AIExtraction


@pytest.fixture
def vertex_mode(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "vertex")
    monkeypatch.setattr(settings, "gcp_project_id", "rma-app-511110")
    monkeypatch.setattr(settings, "gcp_location", "us-central1")
    monkeypatch.setattr(settings, "vertex_model", "google/gemma-2-9b-it")
    monkeypatch.setattr(settings, "vertex_endpoint_id", None)


def test_vertex_model_name_without_endpoint(vertex_mode):
    assert client.model_name() == "vertex:gemma-2-9b-it"


def test_vertex_model_name_with_endpoint(vertex_mode, monkeypatch):
    monkeypatch.setattr(settings, "vertex_endpoint_id", "projects/290165218571/locations/us-central1/endpoints/12345")
    assert client.model_name() == "vertex:endpoint/projects/290165218571/locations/us-central1/endpoints/12345"


def test_vertex_endpoint_prediction_success(vertex_mode, monkeypatch):
    monkeypatch.setattr(settings, "vertex_endpoint_id", "endpoints/test-ep-01")

    mock_endpoint = MagicMock()
    mock_endpoint.predict.return_value = MagicMock(predictions=[{"content": '{"risks": []}'}])

    with patch("google.cloud.aiplatform.Endpoint", return_value=mock_endpoint):
        res = client.call_model("system prompt", "user document")
        assert res == '{"risks": []}'
        assert mock_endpoint.predict.called
        call_kwargs = mock_endpoint.predict.call_args[1]
        assert "<start_of_turn>user" in call_kwargs["instances"][0]["prompt"]


def test_vertex_endpoint_empty_predictions_raises(vertex_mode, monkeypatch):
    monkeypatch.setattr(settings, "vertex_endpoint_id", "endpoints/test-ep-01")

    mock_endpoint = MagicMock()
    mock_endpoint.predict.return_value = MagicMock(predictions=[])

    with patch("google.cloud.aiplatform.Endpoint", return_value=mock_endpoint):
        with pytest.raises(client.ModelUnavailableError, match="empty predictions"):
            client.call_model("system prompt", "user document")


def test_vertex_genai_success(vertex_mode):
    mock_client = MagicMock()
    mock_response = MagicMock(text='{"risks": []}')
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client):
        res = client.call_model("system prompt", "user document")
        assert res == '{"risks": []}'
        assert mock_client.models.generate_content.called


def test_vertex_genai_failure_raises(vertex_mode):
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = RuntimeError("ResourceExhausted")

    with patch("google.genai.Client", return_value=mock_client):
        with pytest.raises(client.ModelUnavailableError, match="Vertex AI call failed"):
            client.call_model("system prompt", "user document")
