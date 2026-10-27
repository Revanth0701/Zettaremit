"""Offline Unit Tests for AI Assistant Streaming functionality."""
import unittest
from unittest.mock import MagicMock, patch
import json
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.ai.ollama_client import OllamaClient, OllamaConnectionError
from backend.ai.rag_service import RAGService
from backend.ai.router import ai_router
from backend.auth import issue_access_token


class TestAIStreamingOffline(unittest.TestCase):
    """Test AI streaming backend components in offline isolation."""

    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(ai_router)
        self.client = TestClient(self.app)
        self.valid_token = issue_access_token("usr_test_stream_123")

    def test_ask_stream_requires_bearer_auth(self):
        """Streaming endpoint must reject requests without Bearer token with 401."""
        response = self.client.post("/ai/ask-stream", json={"question": "What is the fee?"})
        self.assertEqual(response.status_code, 401)

    def test_ask_stream_rejects_empty_question(self):
        """Streaming endpoint must reject empty question with 422."""
        headers = {"Authorization": f"Bearer {self.valid_token}"}
        response = self.client.post("/ai/ask-stream", json={"question": "   "}, headers=headers)
        self.assertEqual(response.status_code, 422)

    @patch("backend.ai.router.get_rag_service")
    def test_ask_stream_returns_sse_events(self, mock_get_rag):
        """Streaming endpoint must return text/event-stream with SSE data chunks."""
        mock_service = MagicMock()
        mock_get_rag.return_value = mock_service

        def mock_answer_stream(question, session_id=None):
            yield {"type": "start", "sources": ["about_zettaremit.md"]}
            yield {"type": "chunk", "content": "ZettaRemit "}
            yield {"type": "chunk", "content": "fee is 3%."}
            yield {"type": "done", "latency_seconds": 0.5, "sources": ["about_zettaremit.md"]}

        mock_service.answer_stream = mock_answer_stream

        headers = {"Authorization": f"Bearer {self.valid_token}"}
        response = self.client.post(
            "/ai/ask-stream",
            json={"question": "What is the fee?"},
            headers=headers
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers["content-type"])
        body = response.text
        self.assertIn("data: ", body)
        self.assertIn('"type": "start"', body)
        self.assertIn('"content": "ZettaRemit "', body)
        self.assertIn('"type": "done"', body)

    def test_answer_stream_yields_correct_events_with_mock_client(self):
        """RAGService.answer_stream yields start, chunk, and done events."""
        mock_ollama = MagicMock(spec=OllamaClient)
        mock_ollama.provider = "test_provider"
        mock_ollama.model = "test_model"
        mock_ollama.chat_stream.return_value = iter(["Hello", " world", "!"])

        service = RAGService(ollama_client=mock_ollama)
        events = list(service.answer_stream("What is ZettaRemit?"))

        types = [e["type"] for e in events]
        self.assertEqual(types[0], "start")
        self.assertIn("chunk", types)
        self.assertEqual(types[-1], "done")
        
        chunks = [e["content"] for e in events if e["type"] == "chunk"]
        self.assertEqual("".join(chunks), "Hello world!")


if __name__ == "__main__":
    unittest.main()
