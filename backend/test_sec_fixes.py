import unittest
import sys
from pathlib import Path

_BACKEND_DIR = str(Path(__file__).resolve().parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import uuid
import datetime
from unittest.mock import Mock
from types import SimpleNamespace
from fastapi.testclient import TestClient

import auth
import main


class Query:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, expression):
        try:
            return Query([r for r in self.rows if getattr(r, expression.left.key) == expression.right.value])
        except Exception:
            return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return self.rows


class TestSecurityAuditFixes(unittest.TestCase):
    """Regression tests for SEC-04 (Rate limiting) and SEC-02 (No government ID persistence)."""

    def setUp(self):
        main.limiter.entries.clear()
        self.password = "StrongAuditPassword2026!"
        self.password_hash = main.pwd_context.hash(self.password)

        self.user_a = SimpleNamespace(
            user_id="USR-ALPHA",
            email="alpha@example.com",
            full_name="User Alpha",
            is_active=True,
            password_hash=self.password_hash
        )
        self.user_b = SimpleNamespace(
            user_id="USR-BETA",
            email="beta@example.com",
            full_name="User Beta",
            is_active=True,
            password_hash=self.password_hash
        )

        self.added_objects = []
        self.db = Mock()
        def mock_add(obj):
            self.added_objects.append(obj)
        self.db.add.side_effect = mock_add
        self.db.commit.return_value = None
        self.db.refresh.side_effect = lambda obj: None

        self.db.query.side_effect = lambda model: Query([self.user_a, self.user_b] if model is main.User else [])

        def get_db_override():
            yield self.db

        main.app.dependency_overrides[main.get_db] = get_db_override
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        main.app.dependency_overrides.clear()
        main.limiter.entries.clear()

    def auth_header(self, user_id="USR-ALPHA"):
        token = auth.issue_access_token(user_id)
        return {"Authorization": f"Bearer {token}"}

    # ----------------------------------------------------
    # SEC-04: Exchange Rate Endpoint Rate Limiting Tests
    # ----------------------------------------------------
    def test_rate_endpoint_normal_authenticated_request(self):
        """Authenticated request returns 200 with exchange rate data."""
        resp = self.client.get("/simulation/rate", headers=self.auth_header("USR-ALPHA"))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["source_currency"], "INR")
        self.assertEqual(data["target_currency"], "USD")
        self.assertIn("inr_per_usd", data)
        self.assertIn("observed_at", data)
        self.assertTrue(data.get("indicative"))

    def test_rate_endpoint_unauthenticated_blocked(self):
        """Unauthenticated request must be rejected with 401."""
        resp = self.client.get("/simulation/rate")
        self.assertEqual(resp.status_code, 401)

    def test_rate_endpoint_limit_enforcement(self):
        """User is permitted up to 30 requests/min; 31st request triggers HTTP 429."""
        headers = self.auth_header("USR-ALPHA")
        for i in range(30):
            resp = self.client.get("/simulation/rate", headers=headers)
            self.assertEqual(resp.status_code, 200, f"Request {i+1} should succeed")

        # 31st request exceeds the limit
        resp31 = self.client.get("/simulation/rate", headers=headers)
        self.assertEqual(resp31.status_code, 429)
        self.assertEqual(resp31.headers.get("retry-after"), "60")
        self.assertIn("Too many requests", resp31.json().get("detail", ""))

    def test_rate_endpoint_user_isolation(self):
        """Rate limit on User Alpha does NOT throttle User Beta."""
        headers_a = self.auth_header("USR-ALPHA")
        headers_b = self.auth_header("USR-BETA")

        # Exhaust User Alpha's 30-request quota
        for _ in range(30):
            self.client.get("/simulation/rate", headers=headers_a)

        # Confirm User Alpha is now throttled
        resp_a = self.client.get("/simulation/rate", headers=headers_a)
        self.assertEqual(resp_a.status_code, 429)

        # Confirm User Beta can still query freely (User isolation)
        resp_b = self.client.get("/simulation/rate", headers=headers_b)
        self.assertEqual(resp_b.status_code, 200)
        self.assertIn("inr_per_usd", resp_b.json())

    # ----------------------------------------------------
    # SEC-02: Stop Storing Government ID Numbers in DB
    # ----------------------------------------------------
    def test_registration_without_document_number(self):
        """Registration without document numbers succeeds and persists None."""
        payload = {
            "full_name": "New Simulation User",
            "email": "newsim@example.com",
            "password": self.password
        }
        resp = self.client.post("/users/register", json=payload)
        self.assertEqual(resp.status_code, 201)

        # Inspect persisted UserVerification record
        verifs = [obj for obj in self.added_objects if isinstance(obj, main.UserVerification)]
        self.assertEqual(len(verifs), 1)
        self.assertIsNone(verifs[0].document_number, "document_number must be None")
        self.assertEqual(verifs[0].document_status, "SIMULATED")

    def test_registration_ignores_supplied_document_number(self):
        """Even if an external client supplies a document_number, it is NEVER persisted."""
        sensitive_aadhaar = "999988887777"
        payload = {
            "full_name": "Test PII User",
            "email": "piiuser@example.com",
            "password": self.password,
            "document_type": "Aadhaar",
            "document_number": sensitive_aadhaar
        }
        resp = self.client.post("/users/register", json=payload)
        self.assertEqual(resp.status_code, 201)

        # Confirm UserVerification document_number was set to None, NOT sensitive_aadhaar
        verifs = [obj for obj in self.added_objects if isinstance(obj, main.UserVerification)]
        self.assertEqual(len(verifs), 1)
        self.assertIsNone(verifs[0].document_number, "Raw document number must NEVER be stored")
        self.assertNotEqual(verifs[0].document_number, sensitive_aadhaar)
        self.assertEqual(verifs[0].document_type, "Aadhaar")

        # Confirm User object does not have document_number attribute
        users = [obj for obj in self.added_objects if isinstance(obj, main.User)]
        self.assertEqual(len(users), 1)
        self.assertFalse(hasattr(users[0], "document_number"))


if __name__ == "__main__":
    unittest.main()
