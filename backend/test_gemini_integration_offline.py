"""Offline tests for Gemini provider selection, requests, and safe failures."""

import os
import unittest
from unittest.mock import MagicMock, patch

from google.genai import errors

from backend.ai.gemini_client import (
    GeminiAuthenticationError,
    GeminiClient,
    GeminiModelUnavailableError,
    GeminiQuotaError,
    GeminiServiceError,
)
from backend.ai.rag_service import RAGService


class _FakeAPIError(errors.APIError):
    def __init__(self, status_code, message=None):
        self.code = status_code
        self.message = message
        self.args = ("synthetic credential must not be exposed",)


class TestGeminiClientOffline(unittest.TestCase):
    def setUp(self):
        self.env_patch = patch.dict(
            os.environ,
            {
                "GEMINI_API_KEY": "synthetic-gemini-key",
                "JWT_SECRET_KEY": "synthetic-test-signing-key-with-at-least-32-characters",
            },
            clear=True,
        )
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

        self.sdk = MagicMock()
        self.client_patch = patch("backend.ai.gemini_client.genai.Client", return_value=self.sdk)
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)
        self.client = GeminiClient()

    def test_default_model_and_chat_request_preserve_history_and_grounding(self):
        self.sdk.models.generate_content.return_value.text = "Grounded Gemini answer"

        result = self.client.chat(
            user_message="Question with retrieved context",
            system_prompt="Grounding instructions",
            history=[
                {"role": "user", "content": "Earlier question"},
                {"role": "assistant", "content": "Earlier answer"},
            ],
            temperature=0.0,
            max_tokens=256,
        )

        self.assertEqual(self.client.provider, "gemini")
        self.assertEqual(self.client.model, "gemini-3.1-flash-lite")
        self.assertEqual(result, "Grounded Gemini answer")
        kwargs = self.sdk.models.generate_content.call_args.kwargs
        self.assertEqual(kwargs["model"], "gemini-3.1-flash-lite")
        self.assertEqual(kwargs["config"].system_instruction, "Grounding instructions")
        self.assertEqual(
            [content.role for content in kwargs["contents"]],
            ["user", "model", "user"],
        )
        self.assertEqual(kwargs["contents"][-1].parts[0].text, "Question with retrieved context")

    def test_stream_returns_text_chunks(self):
        self.sdk.models.generate_content_stream.return_value = [
            MagicMock(text="Hello "),
            MagicMock(text="Gemini"),
        ]

        self.assertEqual(
            list(self.client.chat_stream("Question", system_prompt="Grounded")),
            ["Hello ", "Gemini"],
        )

    def test_safe_api_error_mapping_for_sync_and_streaming(self):
        cases = (
            (401, GeminiAuthenticationError),
            (400, GeminiAuthenticationError, "API key not valid"),
            (429, GeminiQuotaError),
            (403, GeminiQuotaError, "Quota exceeded"),
            (404, GeminiModelUnavailableError),
            (503, GeminiServiceError),
        )
        for case in cases:
            status_code, error_type = case[:2]
            message = case[2] if len(case) > 2 else None
            for method in ("chat", "chat_stream"):
                with self.subTest(status_code=status_code, method=method):
                    target = (
                        self.sdk.models.generate_content
                        if method == "chat"
                        else self.sdk.models.generate_content_stream
                    )
                    target.side_effect = _FakeAPIError(status_code, message)
                    with self.assertRaises(error_type) as caught:
                        if method == "chat":
                            self.client.chat("Question")
                        else:
                            list(self.client.chat_stream("Question"))
                    self.assertNotIn("synthetic credential", str(caught.exception))

    def test_streaming_error_after_a_chunk_is_sanitized(self):
        def stream():
            yield MagicMock(text="partial")
            raise _FakeAPIError(429)

        self.sdk.models.generate_content_stream.return_value = stream()
        chunks = self.client.chat_stream("Question")
        self.assertEqual(next(chunks), "partial")
        with self.assertRaises(GeminiQuotaError) as caught:
            next(chunks)
        self.assertNotIn("synthetic credential", str(caught.exception))

    def test_missing_api_key_fails_without_exposing_credentials(self):
        with patch.dict(os.environ, {}, clear=True):
            client = GeminiClient()
            self.assertFalse(client.check_health()["model_ready"])
            with self.assertRaises(GeminiAuthenticationError) as caught:
                client.chat("Question")
            with self.assertRaises(GeminiAuthenticationError):
                list(client.chat_stream("Question"))
        self.assertNotIn("synthetic-gemini-key", str(caught.exception))

    def test_client_initialization_error_is_sanitized(self):
        with patch(
            "backend.ai.gemini_client.genai.Client",
            side_effect=ValueError("synthetic-gemini-key"),
        ):
            client = GeminiClient()
            with self.assertRaises(GeminiServiceError) as caught:
                client.chat("Question")
        self.assertNotIn("synthetic-gemini-key", str(caught.exception))

    def test_rag_service_selects_gemini_and_preserves_safe_stream_error_event(self):
        self.sdk.models.generate_content_stream.side_effect = GeminiQuotaError(
            "Gemini quota or rate limit exceeded. Please retry later."
        )
        with patch(
            "backend.ai.rag_service.query_knowledge_base",
            return_value=[{"source": "about_zettaremit.md", "text": "Verified context"}],
        ):
            service = RAGService(provider="gemini")
            self.assertEqual(service.ollama.provider, "gemini")
            events = list(service.answer_stream("What is ZettaRemit?"))

        self.assertEqual(events[0], {"type": "start", "sources": ["about_zettaremit.md"]})
        self.assertEqual(events[-1]["type"], "error")
        self.assertEqual(
            events[-1]["error"],
            "Gemini quota or rate limit exceeded. Please retry later.",
        )

    def test_rag_answers_what_is_zettaremit_with_retrieved_context(self):
        self.sdk.models.generate_content.return_value.text = (
            "ZettaRemit is an educational remittance simulation."
        )
        retrieved = {
            "source": "about_zettaremit.md",
            "section": "Overview",
            "text": "ZettaRemit is an educational remittance simulation.",
        }

        with patch("backend.ai.rag_service.query_knowledge_base", return_value=[retrieved]):
            response = RAGService(provider="gemini").answer("What is ZettaRemit?")

        self.assertEqual(response.provider, "gemini")
        self.assertEqual(response.model, "gemini-3.1-flash-lite")
        self.assertEqual(response.answer, "ZettaRemit is an educational remittance simulation.")
        self.assertEqual(response.sources, ["about_zettaremit.md"])
        prompt = self.sdk.models.generate_content.call_args.kwargs["contents"][-1]
        self.assertIn(retrieved["text"], prompt.parts[0].text)

    def test_rag_streams_how_zettaremit_works_with_retrieved_context(self):
        self.sdk.models.generate_content_stream.return_value = [
            MagicMock(text="ZettaRemit simulates "),
            MagicMock(text="an INR-to-USD transfer."),
        ]
        retrieved = {
            "source": "about_zettaremit.md",
            "section": "How It Works",
            "text": "Users explore a simulated INR-to-USD transfer workflow.",
        }

        with patch("backend.ai.rag_service.query_knowledge_base", return_value=[retrieved]):
            events = list(
                RAGService(provider="gemini").answer_stream("How does ZettaRemit work?")
            )

        self.assertEqual(events[0], {"type": "start", "sources": ["about_zettaremit.md"]})
        self.assertEqual(
            "".join(event["content"] for event in events if event["type"] == "chunk"),
            "ZettaRemit simulates an INR-to-USD transfer.",
        )
        self.assertEqual(events[-1]["type"], "done")
        prompt = self.sdk.models.generate_content_stream.call_args.kwargs["contents"][-1]
        self.assertIn(retrieved["text"], prompt.parts[0].text)

    def test_ai_provider_environment_selects_gemini(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "gemini"}):
            service = RAGService()
        self.assertEqual(service.ollama.provider, "gemini")

    def test_upstream_auth_error_does_not_invalidate_user_session(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from backend.ai.rag_service import RAGResponse
        from backend.ai.router import ai_router
        from backend.auth import issue_access_token

        app = FastAPI()
        app.include_router(ai_router)
        client = TestClient(app)
        response_data = RAGResponse(
            question="Question",
            answer="",
            sources=[],
            retrieved_chunks=[],
            latency_seconds=0.1,
            provider="gemini",
            model="gemini-3.1-flash-lite",
            error="Gemini authentication failed. Verify GEMINI_API_KEY configuration.",
        )
        with patch("backend.ai.router.get_rag_service") as get_service:
            get_service.return_value.answer.return_value = response_data
            response = client.post(
                "/ai/ask",
                headers={"Authorization": f"Bearer {issue_access_token('usr_gemini_auth_test')}"},
                json={"question": "Question"},
            )

        self.assertEqual(response.status_code, 503)
        self.assertNotIn("synthetic-gemini-key", response.text)


if __name__ == "__main__":
    unittest.main()
