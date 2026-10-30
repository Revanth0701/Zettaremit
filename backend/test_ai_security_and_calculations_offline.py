"""Offline Unit Tests for AI Assistant Security, Sanitization & Deterministic Calculations (Phase 2)."""
import unittest
from decimal import Decimal
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.ai.rag_service import get_deterministic_fee_context
from backend.ai.router import (
    scrub_sensitive_input,
    check_ip_rate_limit,
    check_user_rate_limit,
    _IP_REQUEST_TIMES,
    _USER_MINUTE_REQUEST_TIMES,
    _USER_DAILY_REQUEST_TIMES,
    MAX_USER_REQUESTS_PER_MINUTE,
    RATE_LIMIT_WINDOW,
    MAX_REQUESTS_PER_WINDOW,
    ai_router
)
from fastapi import FastAPI


class TestDeterministicFeeContext(unittest.TestCase):
    """Test mathematical accuracy and deterministic calculation generation."""

    def test_fee_for_10000_inr(self):
        ctx = get_deterministic_fee_context("What is the fee for 10000 INR?")
        self.assertIsNotNone(ctx)
        self.assertIn("INR 10,000.00", ctx)
        self.assertIn("INR 300.00", ctx)
        self.assertIn("INR 9,700.00", ctx)

    def test_fee_for_25000_with_commas(self):
        ctx = get_deterministic_fee_context("Calculate transfer fee for 25,000 rupees")
        self.assertIsNotNone(ctx)
        self.assertIn("INR 25,000.00", ctx)
        self.assertIn("INR 750.00", ctx)
        self.assertIn("INR 24,250.00", ctx)

    def test_fee_for_odd_amount_rounding(self):
        # 1234.56 * 0.03 = 37.0368 -> rounded to 37.04
        ctx = get_deterministic_fee_context("Cost of sending 1234.56 inr?")
        self.assertIsNotNone(ctx)
        self.assertIn("INR 1,234.56", ctx)
        self.assertIn("INR 37.04", ctx)
        self.assertIn("INR 1,197.52", ctx)

    def test_fee_for_rupee_symbol(self):
        ctx = get_deterministic_fee_context("What is the charge on ₹50,000?")
        self.assertIsNotNone(ctx)
        self.assertIn("INR 50,000.00", ctx)
        self.assertIn("INR 1,500.00", ctx)
        self.assertIn("INR 48,500.00", ctx)

    def test_non_fee_question_returns_none(self):
        ctx = get_deterministic_fee_context("How long is a quote valid?")
        self.assertIsNone(ctx)

    def test_general_question_with_numbers_not_fee(self):
        ctx = get_deterministic_fee_context("Is ZettaRemit valid in 2026?")
        self.assertIsNone(ctx)


class TestSensitiveDataScrubbing(unittest.TestCase):
    """Test scrubbing of credentials, JWTs, and PII before inference."""

    def test_scrubs_jwt_token(self):
        raw = "My auth token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c can you check it?"
        scrubbed = scrub_sensitive_input(raw)
        self.assertNotIn("eyJhbGci", scrubbed)
        self.assertIn("[REDACTED_JWT_TOKEN]", scrubbed)

    def test_scrubs_password(self):
        raw = "My login password: SuperSecret123! how do I reset?"
        scrubbed = scrub_sensitive_input(raw)
        self.assertNotIn("SuperSecret123!", scrubbed)
        self.assertIn("password: [REDACTED]", scrubbed)

    def test_scrubs_card_numbers(self):
        raw = "Can I use card 4111 2222 3333 4444 to transfer money?"
        scrubbed = scrub_sensitive_input(raw)
        self.assertNotIn("4111 2222 3333 4444", scrubbed)
        self.assertIn("[REDACTED_CARD_NUMBER]", scrubbed)

    def test_scrubs_aadhaar_number(self):
        raw = "My Aadhaar is 1234 5678 9012 for verification"
        scrubbed = scrub_sensitive_input(raw)
        self.assertNotIn("1234 5678 9012", scrubbed)
        self.assertIn("[REDACTED_AADHAAR_NUMBER]", scrubbed)

    def test_scrubs_pan_number(self):
        raw = "My PAN card is ABCDE1234F is it required?"
        scrubbed = scrub_sensitive_input(raw)
        self.assertNotIn("ABCDE1234F", scrubbed)
        self.assertIn("[REDACTED_PAN_NUMBER]", scrubbed)


class TestIPRateLimiting(unittest.TestCase):
    """Test sliding window rate limiting on AI endpoint."""

    def setUp(self):
        _IP_REQUEST_TIMES.clear()

    def test_allows_up_to_max_requests(self):
        ip = "192.168.1.100"
        for i in range(MAX_REQUESTS_PER_WINDOW):
            self.assertTrue(check_ip_rate_limit(ip), f"Request {i+1} should be allowed")
        # Next request must be rejected
        self.assertFalse(check_ip_rate_limit(ip), "Request exceeding window limit should be rejected")

    def test_isolated_per_ip(self):
        ip1 = "10.0.0.1"
        ip2 = "10.0.0.2"
        for _ in range(MAX_REQUESTS_PER_WINDOW):
            check_ip_rate_limit(ip1)
        self.assertFalse(check_ip_rate_limit(ip1))
        # ip2 is unaffected
        self.assertTrue(check_ip_rate_limit(ip2))


class TestUserRateLimiting(unittest.TestCase):
    """Test per-user minute rate limiting and daily usage budget."""

    def setUp(self):
        _USER_MINUTE_REQUEST_TIMES.clear()
        _USER_DAILY_REQUEST_TIMES.clear()

    def test_allows_up_to_max_user_requests(self):
        user_id = "usr_alice123"
        for i in range(MAX_USER_REQUESTS_PER_MINUTE):
            allowed, _ = check_user_rate_limit(user_id)
            self.assertTrue(allowed, f"Request {i+1} should be allowed")
        # 11th request must be rejected
        allowed, msg = check_user_rate_limit(user_id)
        self.assertFalse(allowed)
        self.assertIn("Maximum 10 questions per minute", msg)

    def test_user_rate_limits_are_isolated(self):
        user1 = "usr_alice"
        user2 = "usr_bob"
        for _ in range(MAX_USER_REQUESTS_PER_MINUTE):
            check_user_rate_limit(user1)
        allowed1, _ = check_user_rate_limit(user1)
        self.assertFalse(allowed1)
        # user2 should still be allowed
        allowed2, _ = check_user_rate_limit(user2)
        self.assertTrue(allowed2)


class TestEndpointAuthenticationEnforcement(unittest.TestCase):
    """Test authentication enforcement on AI endpoints."""

    def setUp(self):
        import os
        os.environ["JWT_SECRET_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        app = FastAPI()
        app.include_router(ai_router)
        self.client = TestClient(app)

    def test_ask_without_token_returns_401(self):
        resp = self.client.post("/ai/ask", json={"question": "What is the fee?"})
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Bearer", resp.headers.get("www-authenticate", ""))

    def test_ask_with_malformed_token_returns_401(self):
        resp = self.client.post(
            "/ai/ask",
            headers={"Authorization": "Bearer not-a-valid-token"},
            json={"question": "What is the fee?"}
        )
        self.assertEqual(resp.status_code, 401)

    def test_user_session_namespaces_are_isolated(self):
        """Verify that user_A and user_B sessions are namespaced and completely isolated."""
        from unittest.mock import patch, MagicMock
        from auth import issue_access_token
        from backend.ai.rag_service import RAGResponse

        token_a = issue_access_token("usr_alice")
        token_b = issue_access_token("usr_bob")

        captured_sessions = []

        def mock_answer(question, session_id):
            captured_sessions.append(session_id)
            return RAGResponse(
                question=question,
                answer="Simulated answer",
                sources=["about_zettaremit.md"],
                retrieved_chunks=[],
                session_id=session_id,
                latency_seconds=0.1,
                provider="mock",
                model="mock"
            )

        with patch("backend.ai.router.get_rag_service") as mock_get_rag:
            mock_svc = MagicMock()
            mock_svc.answer = mock_answer
            mock_get_rag.return_value = mock_svc

            # Alice asks with session "chat-1234567890abcdef"
            resp_a = self.client.post(
                "/ai/ask",
                headers={"Authorization": f"Bearer {token_a}"},
                json={"question": "What is fee?", "session_id": "chat-1234567890abcdef"}
            )
            self.assertEqual(resp_a.status_code, 200)

            # Bob asks with the exact same session "chat-1234567890abcdef"
            resp_b = self.client.post(
                "/ai/ask",
                headers={"Authorization": f"Bearer {token_b}"},
                json={"question": "What is fee?", "session_id": "chat-1234567890abcdef"}
            )
            self.assertEqual(resp_b.status_code, 200)

            # Both responses preserve the original client session_id
            self.assertEqual(resp_a.json()["session_id"], "chat-1234567890abcdef")
            self.assertEqual(resp_b.json()["session_id"], "chat-1234567890abcdef")

            # But server-side internal sessions are strictly namespaced by user_id
            self.assertEqual(captured_sessions[0], "usr_alice::chat-1234567890abcdef")
            self.assertEqual(captured_sessions[1], "usr_bob::chat-1234567890abcdef")
            self.assertNotEqual(captured_sessions[0], captured_sessions[1])

    def test_health_endpoint_is_public_and_safe(self):
        resp = self.client.get("/ai/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("status", data)
        self.assertIn("provider", data)
        self.assertIn("model", data)
        self.assertIn("model_ready", data)
        # Ensure no secrets, keys, or internal details are leaked
        self.assertNotIn("api_key", str(data).lower())
        self.assertNotIn("secret", str(data).lower())


if __name__ == "__main__":
    unittest.main()
