"""Offline Unit Tests for AI Assistant Exchange Rate & Quote Integration."""
from datetime import datetime, timezone
from decimal import Decimal
import json
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

import sys
from pathlib import Path

_BACKEND_DIR = str(Path(__file__).resolve().parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from exchange_rates import ExchangeRateProvider, RateSnapshot, RateUnavailable
from ai.rag_service import (
    RAGService,
    get_exchange_rate_context,
    detect_unsupported_corridor,
    parse_numeric_inr_amount,
    SYSTEM_PROMPT
)
from ai.router import ai_router
from auth import issue_access_token


class TestAIRateIntegration(unittest.TestCase):
    """Test AI assistant rate integration logic and endpoints."""

    def setUp(self):
        self.mock_snapshot = RateSnapshot(
            inr_per_usd=Decimal("95.26905100"),
            observed_at=datetime(2026, 10, 27, 0, 2, 31, tzinfo=timezone.utc),
            next_update_at=datetime(2026, 10, 28, 0, 2, 31, tzinfo=timezone.utc),
            fetched_at=datetime(2026, 10, 27, 0, 2, 31, tzinfo=timezone.utc),
            valid_until=datetime(2026, 10, 31, 0, 2, 31, tzinfo=timezone.utc),
            schedule_overdue=False
        )
        self.mock_provider = MagicMock(spec=ExchangeRateProvider)
        self.mock_provider.get_rate.return_value = self.mock_snapshot

        self.app = FastAPI()
        self.app.include_router(ai_router)
        self.client = TestClient(self.app)
        self.token = issue_access_token("usr_test_rate_123")

    def test_detect_unsupported_corridors(self):
        """Must detect unsupported currencies and inverted transfer directions."""
        self.assertEqual(detect_unsupported_corridor("Can I transfer EUR to GBP?"), "EUR to GBP")
        self.assertIsNotNone(detect_unsupported_corridor("Can I send USD to EUR?"))
        self.assertEqual(detect_unsupported_corridor("Can I transfer USD to INR?"), "USD to INR")
        self.assertIsNotNone(detect_unsupported_corridor("Can I transfer money in crypto?"))
        # Valid transfer corridor or simple valuation inquiries should return None
        self.assertIsNone(detect_unsupported_corridor("What is the exchange rate?"))
        self.assertIsNone(detect_unsupported_corridor("How much is 1 USD in INR?"))
        self.assertIsNone(detect_unsupported_corridor("How much USD will I get for 10,000 INR?"))

    def test_parse_numeric_inr_amount(self):
        """Must parse various formatted INR amounts."""
        self.assertEqual(parse_numeric_inr_amount("How much USD will I get for 10,000 INR?"), Decimal("10000"))
        self.assertEqual(parse_numeric_inr_amount("Convert ₹25,500 to USD"), Decimal("25500"))
        self.assertEqual(parse_numeric_inr_amount("Cost of sending 1234.56 inr?"), Decimal("1234.56"))
        self.assertIsNone(parse_numeric_inr_amount("What is the exchange rate?"))

    def test_general_rate_context_uses_authoritative_rate(self):
        """General rate inquiry must fetch snapshot and provide rate in both directions."""
        ctx = get_exchange_rate_context("What is the exchange rate?", provider=self.mock_provider)
        self.assertIsNotNone(ctx)
        self.assertIn("1 USD = ₹95.2691 INR", ctx)
        self.assertIn("1 INR = $0.0105 USD", ctx)
        self.assertIn("2026-10-27 00:02:31 UTC", ctx)
        self.assertIn("flat 3% transfer fee", ctx)
        self.assertIn("Indian Rupees (INR) to US Dollars (USD)", ctx)

    def test_today_rate_inquiry_context(self):
        """Questions like 'What's today's INR to USD rate?' must retrieve current rate context."""
        ctx = get_exchange_rate_context("What's today's INR to USD rate?", provider=self.mock_provider)
        self.assertIsNotNone(ctx)
        self.assertIn("1 USD = ₹95.2691 INR", ctx)

    def test_usd_in_inr_rate_inquiry_context(self):
        """'How much is 1 USD in INR?' must retrieve authoritative rate context."""
        ctx = get_exchange_rate_context("How much is 1 USD in INR?", provider=self.mock_provider)
        self.assertIsNotNone(ctx)
        self.assertIn("1 USD = ₹95.2691 INR", ctx)

    def test_amount_specific_payout_calculation(self):
        """Inquiry for 10,000 INR must compute 3% fee (300) and payout (101.82 USD)."""
        ctx = get_exchange_rate_context("How much USD will I get for 10,000 INR?", provider=self.mock_provider)
        self.assertIsNotNone(ctx)
        self.assertIn("₹10,000.00 INR", ctx)
        self.assertIn("₹300.00 INR", ctx)
        self.assertIn("₹9,700.00 INR", ctx)
        self.assertIn("$101.82 USD", ctx)
        self.assertIn("Authoritative Exchange Rate & Simulation Quote", ctx)

    def test_amount_exceeding_limit(self):
        """Amounts exceeding 1,000,000 INR must trigger limit notice."""
        ctx = get_exchange_rate_context("How much USD for 5,000,000 INR?", provider=self.mock_provider)
        self.assertIsNotNone(ctx)
        self.assertIn("Maximum Single Transfer Limit: ₹1,000,000.00 INR", ctx)

    def test_rate_unavailable_handling(self):
        """RateUnavailable must return graceful status without inventing rates."""
        unavail_provider = MagicMock(spec=ExchangeRateProvider)
        unavail_provider.get_rate.side_effect = RateUnavailable("provider_network_error")
        ctx = get_exchange_rate_context("What is the exchange rate?", provider=unavail_provider)
        self.assertIsNotNone(ctx)
        self.assertIn("Temporarily Unavailable", ctx)
        self.assertIn("Do NOT invent or speculate", ctx)

    def test_unsupported_corridor_context(self):
        """Unsupported corridor must generate refusal context without inverting direction."""
        ctx = get_exchange_rate_context("Can I transfer EUR to GBP?", provider=self.mock_provider)
        self.assertIsNotNone(ctx)
        self.assertIn("EUR to GBP", ctx)
        self.assertIn("Do not invert the corridor direction", ctx)

    def test_rag_service_answer_with_mock_client(self):
        """RAGService passes rate context into user prompt and returns grounded answer."""
        mock_client = MagicMock()
        mock_client.provider = "test"
        mock_client.model = "test-model"
        mock_client.chat.return_value = "The rate is 1 USD = ₹95.27 INR."

        service = RAGService(ollama_client=mock_client, rate_provider=self.mock_provider)
        res = service.answer("What is the exchange rate?")
        self.assertEqual(res.answer, "The rate is 1 USD = ₹95.27 INR.")
        self.assertIn("fees_and_rates.md", res.sources)

        # Verify context passed to chat includes authoritative rate
        call_kwargs = mock_client.chat.call_args.kwargs
        self.assertIn("1 USD = ₹95.2691 INR", call_kwargs["user_message"])

    def test_rag_service_answer_stream_with_mock_client(self):
        """RAGService.answer_stream yields token chunks and done event."""
        mock_client = MagicMock()
        mock_client.provider = "test"
        mock_client.model = "test-model"
        mock_client.chat_stream.return_value = iter(["1 USD = ", "₹95.27 INR"])

        service = RAGService(ollama_client=mock_client, rate_provider=self.mock_provider)
        events = list(service.answer_stream("What is the exchange rate?"))
        chunks = [e["content"] for e in events if e.get("type") == "chunk"]
        self.assertEqual("".join(chunks), "1 USD = ₹95.27 INR")
        self.assertEqual(events[-1]["type"], "done")


if __name__ == "__main__":
    unittest.main()
