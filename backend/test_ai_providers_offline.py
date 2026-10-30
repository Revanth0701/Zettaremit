"""Offline Unit Tests for ZettaRemit AI Providers (Phase 2, Step 6A).

Tests provider configuration, Ollama Cloud integration, API key masking,
HTTP status code mappings, error handling, and RAGService propagation without
relying on external network access or live cloud credits.
"""

import os
import unittest
from unittest.mock import patch, MagicMock
import httpx

from backend.ai.ollama_client import (
    OllamaClient,
    OllamaError,
    OllamaAuthenticationError,
    OllamaPaymentRequiredError,
    OllamaModelNotFoundError,
    OllamaRateLimitError,
    OllamaTimeoutError,
    OllamaConnectionError,
    OllamaAPIError,
    DEFAULT_LOCAL_URL,
    DEFAULT_LOCAL_MODEL,
    DEFAULT_CLOUD_URL,
    DEFAULT_CLOUD_MODEL,
)
from backend.ai.rag_service import RAGService, RAGResponse


class TestAIProvidersOffline(unittest.TestCase):
    """Test suite for local vs. cloud inference provider configurations and safety."""

    def setUp(self):
        # Clean environment variables before each test
        self.orig_env = dict(os.environ)
        for key in list(os.environ.keys()):
            if key.startswith("OLLAMA_") or key == "AI_PROVIDER":
                del os.environ[key]

    def tearDown(self):
        # Restore environment
        os.environ.clear()
        os.environ.update(self.orig_env)

    def test_local_provider_defaults(self):
        """Verify default provider is local with correct URL, model, and no auth header."""
        client = OllamaClient()
        self.assertEqual(client.provider, "local")
        self.assertEqual(client.base_url, DEFAULT_LOCAL_URL)
        self.assertEqual(client.model, DEFAULT_LOCAL_MODEL)
        self.assertFalse(client.has_api_key)
        self.assertFalse(client.fallback_to_local)

        headers = client._get_headers()
        self.assertEqual(headers, {"Content-Type": "application/json"})
        self.assertNotIn("Authorization", headers)

    def test_cloud_provider_defaults_and_auth_header(self):
        """Verify cloud provider defaults to gemma4:31b and attaches Bearer token."""
        secret_key = "sk_test_synthetic_cloud_key_98765"
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_API_KEY"] = secret_key

        client = OllamaClient()
        self.assertEqual(client.provider, "ollama_cloud")
        self.assertEqual(client.base_url, DEFAULT_CLOUD_URL)
        self.assertEqual(client.model, DEFAULT_CLOUD_MODEL)
        self.assertTrue(client.has_api_key)

        headers = client._get_headers()
        self.assertEqual(headers.get("Authorization"), f"Bearer {secret_key}")

        # Security check: secret key must never appear in repr or string representation
        repr_str = repr(client)
        self.assertNotIn(secret_key, repr_str)
        self.assertIn("provider=ollama_cloud", repr_str)
        self.assertIn("api_key=set", repr_str)

    def test_cloud_custom_model_and_url(self):
        """Verify OLLAMA_CLOUD_MODEL and custom cloud base URL from environment."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_CLOUD_MODEL"] = "gemma4:cloud"
        os.environ["OLLAMA_CLOUD_BASE_URL"] = "https://custom.ollama.example.com"
        os.environ["OLLAMA_API_KEY"] = "sk_key"

        client = OllamaClient()
        self.assertEqual(client.model, "gemma4:cloud")
        self.assertEqual(client.base_url, "https://custom.ollama.example.com")

    def test_cloud_missing_api_key_raises_auth_error(self):
        """Verify cloud provider without API key raises OllamaAuthenticationError immediately."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        # OLLAMA_API_KEY not set

        client = OllamaClient()
        self.assertEqual(client.provider, "ollama_cloud")
        self.assertFalse(client.has_api_key)

        with self.assertRaises(OllamaAuthenticationError) as ctx:
            client.chat("Hello")
        self.assertIn("OLLAMA_API_KEY environment variable", str(ctx.exception))

        # Health check reports degraded state without throwing
        health = client.check_health()
        self.assertEqual(health["status"], "degraded")
        self.assertFalse(health["model_ready"])
        self.assertIn("OLLAMA_API_KEY", health["error"])

    def test_http_401_maps_to_auth_error(self):
        """Verify HTTP 401 from cloud maps to OllamaAuthenticationError."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_API_KEY"] = "invalid_key"
        client = OllamaClient()

        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 401
        mock_resp.json.return_value = {"error": "Unauthorized"}
        mock_resp.text = '{"error":"Unauthorized"}'

        with patch("httpx.Client.post", side_effect=httpx.HTTPStatusError("401", request=MagicMock(), response=mock_resp)):
            with self.assertRaises(OllamaAuthenticationError) as ctx:
                client.chat("test")
            self.assertIn("401 Unauthorized", str(ctx.exception))

    def test_http_402_403_maps_to_payment_required_error(self):
        """Verify HTTP 402/403 maps to OllamaPaymentRequiredError (credits / tier)."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_API_KEY"] = "key"
        client = OllamaClient()

        for code in (402, 403):
            mock_resp = MagicMock(spec=httpx.Response)
            mock_resp.status_code = code
            mock_resp.json.return_value = {"error": "Credits exhausted"}
            mock_resp.text = '{"error":"Credits exhausted"}'

            with patch("httpx.Client.post", side_effect=httpx.HTTPStatusError(str(code), request=MagicMock(), response=mock_resp)):
                with self.assertRaises(OllamaPaymentRequiredError) as ctx:
                    client.chat("test")
                self.assertIn("Credits exhausted", str(ctx.exception))

    def test_http_404_maps_to_model_not_found(self):
        """Verify HTTP 404 maps to OllamaModelNotFoundError."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_API_KEY"] = "key"
        client = OllamaClient(model="nonexistent_model")

        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 404
        mock_resp.json.return_value = {"error": "model not found"}
        mock_resp.text = '{"error":"model not found"}'

        with patch("httpx.Client.post", side_effect=httpx.HTTPStatusError("404", request=MagicMock(), response=mock_resp)):
            with self.assertRaises(OllamaModelNotFoundError) as ctx:
                client.chat("test")
            self.assertIn("nonexistent_model", str(ctx.exception))

    def test_http_429_maps_to_rate_limit_error(self):
        """Verify HTTP 429 maps to OllamaRateLimitError."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_API_KEY"] = "key"
        client = OllamaClient()

        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 429
        mock_resp.json.return_value = {"error": "Rate limit exceeded"}
        mock_resp.text = '{"error":"Rate limit exceeded"}'

        with patch("httpx.Client.post", side_effect=httpx.HTTPStatusError("429", request=MagicMock(), response=mock_resp)):
            with self.assertRaises(OllamaRateLimitError) as ctx:
                client.chat("test")
            self.assertIn("rate limit exceeded", str(ctx.exception).lower())

    def test_no_automatic_fallback_by_default(self):
        """Requirement: Do not automatically fall back from cloud to local on errors unless configured."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_API_KEY"] = "key"
        # OLLAMA_CLOUD_FALLBACK_TO_LOCAL is not set (default False)

        client = OllamaClient()
        self.assertFalse(client.fallback_to_local)

        with patch("httpx.Client.post", side_effect=httpx.ConnectError("Network down")):
            with self.assertRaises(OllamaConnectionError):
                client.chat("test")

    def test_explicit_fallback_when_configured(self):
        """Verify fallback to local occurs ONLY when explicitly enabled."""
        os.environ["AI_PROVIDER"] = "ollama_cloud"
        os.environ["OLLAMA_API_KEY"] = "key"
        os.environ["OLLAMA_CLOUD_FALLBACK_TO_LOCAL"] = "true"

        client = OllamaClient()
        self.assertTrue(client.fallback_to_local)

        # Mock cloud failure followed by local success
        call_count = 0
        def mock_post(url, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if "ollama.com" in url:
                raise httpx.ConnectError("Cloud unreachable")
            # Local mock response
            resp = MagicMock(spec=httpx.Response)
            resp.status_code = 200
            resp.json.return_value = {"message": {"content": "Local fallback answer"}}
            return resp

        with patch("httpx.Client.post", side_effect=mock_post):
            answer = client.chat("test")
            self.assertEqual(answer, "Local fallback answer")
            self.assertEqual(call_count, 2)

    def test_rag_service_provider_propagation(self):
        """Verify RAGService reports the active provider and model in RAGResponse."""
        mock_client = MagicMock(spec=OllamaClient)
        mock_client.provider = "ollama_cloud"
        mock_client.model = "gemma4:31b"
        mock_client.chat.return_value = "Grounded cloud answer"

        with patch("backend.ai.rag_service.query_knowledge_base", return_value=[{"source": "about_zettaremit.md", "text": "info"}]):
            service = RAGService(ollama_client=mock_client)
            resp = service.answer("What is ZettaRemit?")

            self.assertEqual(resp.provider, "ollama_cloud")
            self.assertEqual(resp.model, "gemma4:31b")
            self.assertEqual(resp.answer, "Grounded cloud answer")
            self.assertIn("about_zettaremit.md", resp.sources)


if __name__ == "__main__":
    unittest.main()
