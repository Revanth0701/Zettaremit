"""Synthetic quote/security tests. No provider, Java or database connections."""
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import importlib
import json
import os
from pathlib import Path
import secrets
import sys
from types import SimpleNamespace
import unittest
import warnings
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import jwt
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import MetaData
import auth
import database_config
import exchange_rates
from exchange_rates import RateSnapshot, RateUnavailable
from internal_service import ServiceUnavailable
from money import amounts, TransferRequest
import quotes


class QuoteTests(unittest.TestCase):
    def setUp(self):
        for guard in (patch.dict(os.environ, {"JWT_SECRET_KEY": secrets.token_hex(32), "APP_ENV": "test"}),
                      patch("socket.socket.connect", side_effect=AssertionError("Network forbidden"))):
            guard.start()
            self.addCleanup(guard.stop)
        self.now = datetime.now(timezone.utc).replace(microsecond=0)
        self.request = TransferRequest(recipient_name="Synthetic recipient", gross_amount="1000.00")
        self.snapshot = RateSnapshot(Decimal("80.00000000"), self.now - timedelta(hours=12),
                                     self.now + timedelta(hours=12), self.now, self.now + timedelta(hours=84))
        self.quote_id = "QUOTE-" + "a" * 32

    def calculation(self, request=None, snapshot=None):
        fee, net, payout = amounts((request or self.request).gross_amount, (snapshot or self.snapshot).inr_per_usd)
        return dict(feeDeducted=fee, netAmount=net, recipientAmount=payout, exchangeRate=(snapshot or self.snapshot).inr_per_usd)

    def issue(self, snapshot=None, request=None):
        snapshot = snapshot or self.snapshot
        request = request or self.request
        return quotes.issue_quote("synthetic-A", request, snapshot, self.calculation(request, snapshot), self.quote_id, now=self.now)

    def claims(self, response):
        return jwt.decode(response.quote_token, quotes._key(), algorithms=[quotes.ALGORITHM],
                          audience=quotes.AUDIENCE, issuer=quotes.ISSUER)

    def signed(self, claims, **kwargs):
        with warnings.catch_warnings():
            # A deliberately wrong algorithm is tested; production is HS256.
            warnings.simplefilter("ignore", jwt.warnings.InsecureKeyLengthWarning)
            return jwt.encode(claims, quotes._key(), algorithm=kwargs.get("algorithm", "HS256"),
                              headers={"typ": "zettaremit-quote+jwt"})

    def test_valid_quote_binds_owner_request_and_all_amounts(self):
        response = self.issue()
        details = quotes.validate_quote(response.quote_token, "synthetic-A", self.request, now=self.now)
        self.assertEqual(details.recipient_amount, "12.13")
        self.assertEqual(details.fee_deducted, "30.00")
        self.assertEqual(details.exchange_rate, "80.00000000")
        self.assertEqual(details.expires_at, self.now + timedelta(minutes=5))
        self.assertEqual(details.provider_updated_at, self.snapshot.observed_at)
        self.assertEqual(details.attribution_url, exchange_rates.ATTRIBUTION_URL)
        self.assertTrue(details.simulation)
        self.assertEqual(details.source_currency, "INR")
        self.assertEqual(details.target_currency, "USD")

    def test_expiry_boundary_and_no_future_acceptance(self):
        response = self.issue()
        quotes.validate_quote(response.quote_token, "synthetic-A", now=self.now + timedelta(seconds=299))
        for moment in (self.now + timedelta(minutes=5), self.now - timedelta(seconds=1)):
            with self.assertRaises(quotes.InvalidQuote):
                quotes.validate_quote(response.quote_token, "synthetic-A", now=moment)

    def test_expiry_capped_by_freshness_and_elapsed_calculation(self):
        snapshot = replace(self.snapshot, valid_until=self.now + timedelta(seconds=31))
        response = self.issue(snapshot)
        self.assertEqual(response.expires_at, snapshot.valid_until)
        with self.assertRaises(quotes.InvalidQuote):
            quotes.issue_quote("synthetic-A", self.request, snapshot, self.calculation(), self.quote_id,
                               now=self.now + timedelta(seconds=31))
        with self.assertRaises(quotes.InvalidQuote):
            self.issue(replace(snapshot, valid_until=self.now))

    def test_wrong_owner_or_changed_recipient_amount_rejected(self):
        token = self.issue().quote_token
        with self.assertRaises(quotes.InvalidQuote):
            quotes.validate_quote(token, "synthetic-B", now=self.now)
        for request in (TransferRequest(recipient_name="Other", gross_amount="1000"),
                        TransferRequest(recipient_name=self.request.recipient_name, gross_amount="1001")):
            with self.assertRaises(quotes.InvalidQuote):
                quotes.validate_quote(token, "synthetic-A", request, now=self.now)

    def test_modified_signature_payload_and_malformed_tokens_rejected(self):
        token = self.issue().quote_token
        header, payload, signature = token.split(".")
        changed = self.claims(self.issue())
        changed["quote"]["gross_amount"] = "1001.00"
        import base64
        modified = base64.urlsafe_b64encode(json.dumps(changed).encode()).rstrip(b"=").decode()
        for candidate in (None, "", "malformed", "a" * 8193, header + "." + modified + "." + signature,
                          header + "." + payload + "." + ("A" if signature[0] != "A" else "B") + signature[1:]):
            with self.assertRaises(quotes.InvalidQuote):
                quotes.validate_quote(candidate, "synthetic-A", now=self.now)

    def test_signed_but_inconsistent_fields_rejected(self):
        response = self.issue()
        changes = {"recipient_name": "  Synthetic recipient", "gross_amount": "1001.00", "fee_deducted": "0.00",
                   "net_amount": "1000.00", "recipient_amount": "12.12", "exchange_rate": "81.00000000",
                   "source_currency": "USD", "target_currency": "INR", "fee_percent": "0", "simulation": False,
                   "attribution_text": "Other", "provider_updated_at": (self.now + timedelta(seconds=1)).isoformat(),
                   "rate_schedule_overdue": True, "expires_at": (self.now + timedelta(minutes=6)).isoformat(),
                   "rate_valid_until": (self.now + timedelta(days=5)).isoformat()}
        for field, value in changes.items():
            with self.subTest(field=field):
                claims = self.claims(response)
                claims["quote"][field] = value
                with self.assertRaises(quotes.InvalidQuote):
                    quotes.validate_quote(self.signed(claims), "synthetic-A", now=self.now)

    def test_claim_purpose_algorithm_and_schema_are_strict(self):
        response = self.issue()
        for field, value in (("purpose", "access"), ("aud", auth.AUDIENCE), ("aud", [quotes.AUDIENCE]), ("iss", "other"),
                             ("iat", True), ("nbf", 0), ("exp", 9999999999), ("jti", "other")):
            claims = self.claims(response)
            claims[field] = value
            with self.assertRaises(quotes.InvalidQuote):
                quotes.validate_quote(self.signed(claims), "synthetic-A", now=self.now)
        with self.assertRaises(quotes.InvalidQuote):
            quotes.validate_quote(self.signed(self.claims(response), algorithm="HS384"), "synthetic-A", now=self.now)
        claims = self.claims(response)
        del claims["quote"]["fee_percent"]
        with self.assertRaises(quotes.InvalidQuote):
            quotes.validate_quote(self.signed(claims), "synthetic-A", now=self.now)
        claims = self.claims(response)
        claims["quote"]["simulation"] = 1
        with self.assertRaises(quotes.InvalidQuote):
            quotes.validate_quote(self.signed(claims), "synthetic-A", now=self.now)

    def test_access_and_quote_tokens_are_not_interchangeable(self):
        response = self.issue()
        with self.assertRaises(HTTPException) as error:
            auth.token_subject(response.quote_token)
        self.assertEqual(error.exception.status_code, 401)
        with self.assertRaises(quotes.InvalidQuote):
            quotes.validate_quote(auth.issue_access_token("synthetic-A"), "synthetic-A", now=self.now)
        # Even an access-key-signed token with quote claims must fail.
        counterfeit = jwt.encode(self.claims(response), auth.signing_key(), algorithm="HS256",
                                 headers={"typ": "zettaremit-quote+jwt"})
        with self.assertRaises(quotes.InvalidQuote):
            quotes.validate_quote(counterfeit, "synthetic-A", now=self.now)

    def test_rounding_matches_shared_python_java_vectors(self):
        path = Path(__file__).resolve().parent.parent / "services/transaction-service/src/test/resources/exchange_rate_vectors.json"
        for vector in json.loads(path.read_text()):
            snapshot = replace(self.snapshot, inr_per_usd=Decimal(vector["rate"]))
            request = TransferRequest(recipient_name="Synthetic recipient", gross_amount=vector["gross"])
            quote = self.issue(snapshot, request)
            self.assertEqual(quote.recipient_amount, vector["payout"])
            self.assertEqual(quote.fee_deducted, vector["fee"])
            quotes.validate_quote(quote.quote_token, "synthetic-A", request, now=self.now)

    def test_java_disagreement_or_noncanonical_snapshot_cannot_be_signed(self):
        calculation = self.calculation()
        calculation["recipientAmount"] += Decimal("0.01")
        with self.assertRaises(quotes.InvalidQuote):
            quotes.issue_quote("synthetic-A", self.request, self.snapshot, calculation, self.quote_id, now=self.now)
        with self.assertRaises(quotes.InvalidQuote):
            self.issue(replace(self.snapshot, inr_per_usd=Decimal("80.000000001")))

    def test_provider_refresh_does_not_reprice_an_issued_quote(self):
        provider = exchange_rates.ExchangeRateProvider(clock=lambda: self.now, monotonic=lambda: 10000)
        provider._snapshot = replace(self.snapshot, next_update_at=self.now - timedelta(seconds=1))
        provider._retry_at = 20000
        old = provider.get_rate()
        response = self.issue(old)
        provider._retry_at = 0
        raw = json.dumps({"result": "success", "base_code": "USD", "rates": {"USD": 1, "INR": 90},
                          "time_last_update_unix": int(self.now.timestamp()),
                          "time_next_update_unix": int((self.now + timedelta(days=1)).timestamp())}).encode()
        reply = Mock()
        reply.status = 200
        reply.read.return_value = raw
        reply.__enter__ = Mock(return_value=reply)
        reply.__exit__ = Mock(return_value=False)
        provider._opener = Mock()
        provider._opener.open.return_value = reply
        self.assertEqual(provider.get_rate().inr_per_usd, Decimal("90.00000000"))
        provider._opener.open.reset_mock()
        details = quotes.validate_quote(response.quote_token, "synthetic-A", now=self.now + timedelta(seconds=10))
        self.assertEqual(details.exchange_rate, "80.00000000")
        self.assertEqual(details.recipient_amount, "12.13")
        provider._opener.open.assert_not_called()


class QuoteEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guards = [patch.dict(os.environ, {"JWT_SECRET_KEY": secrets.token_hex(32), "APP_ENV": "test", "LOCAL_CREATE_TABLES": "false"}),
                      # Windows asyncio needs socketpair() internally. Block
                      # outbound HTTP at the transport and connection helpers.
                      patch("urllib.request.OpenerDirector.open", side_effect=AssertionError("HTTP forbidden")),
                      patch("socket.create_connection", side_effect=AssertionError("Network forbidden")),
                      patch("pymysql.connections.Connection.connect", side_effect=AssertionError("MySQL forbidden")),
                      patch("sqlalchemy.engine.Engine.connect", side_effect=AssertionError("Database forbidden")),
                      patch.object(database_config, "load_database_config", return_value=database_config.DatabaseConfig("local", "synthetic")),
                      patch.object(database_config, "create_database_engine", return_value=Mock()),
                      patch.object(MetaData, "create_all")]
        for guard in cls.guards:
            guard.start()
        cls.api = importlib.import_module("main")

    @classmethod
    def tearDownClass(cls):
        cls.api.app.dependency_overrides.clear()
        for guard in reversed(cls.guards):
            guard.stop()

    def setUp(self):
        self.api.limiter.entries.clear()
        self.now = datetime.now(timezone.utc).replace(microsecond=0)
        self.db = Mock()
        self.user = SimpleNamespace(user_id="synthetic-A", is_active=True)
        self.db.query.return_value.filter.return_value.first.return_value = self.user
        def session():
            yield self.db
        self.api.app.dependency_overrides[self.api.get_db] = session
        self.provider = Mock()
        self.provider.get_rate.return_value = RateSnapshot(Decimal("80.00000000"), self.now - timedelta(hours=12),
            self.now + timedelta(hours=12), self.now, self.now + timedelta(hours=84))
        self.api.app.dependency_overrides[self.api.get_exchange_rate_provider] = lambda: self.provider
        self.client = TestClient(self.api.app)
        self.addCleanup(self.client.close)
        self.addCleanup(self.api.app.dependency_overrides.clear)
        self.calculator = patch.object(self.api, "calculate_transfer", return_value={"feeDeducted": Decimal("30.00"),
            "netAmount": Decimal("970.00"), "recipientAmount": Decimal("12.13"), "exchangeRate": Decimal("80.00000000")})
        self.calculate = self.calculator.start()
        self.addCleanup(self.calculator.stop)
        self.body = {"recipient_name": "Synthetic recipient", "gross_amount": "1000.00"}
        self.headers = {"Authorization": "Bearer " + auth.issue_access_token(self.user.user_id)}

    def post(self):
        return self.client.post("/simulation/quote", json=self.body, headers=self.headers)

    def test_authenticated_quote_uses_explicit_java_rate_and_performs_no_writes(self):
        result = self.post()
        self.assertEqual(result.status_code, 200)
        body = result.json()
        for field in ("gross_amount", "fee_deducted", "net_amount", "recipient_amount", "exchange_rate"):
            self.assertIsInstance(body[field], str)
        self.assertEqual(body["recipient_amount"], "12.13")
        self.assertEqual(self.calculate.call_args.kwargs["rate"], Decimal("80.00000000"))
        self.assertEqual(self.calculate.call_args.args[2], body["quote_id"])
        self.assertEqual(result.headers["cache-control"], "no-store")
        quotes.validate_quote(body["quote_token"], self.user.user_id)
        for operation in (self.db.add, self.db.commit, self.db.flush, self.db.execute):
            operation.assert_not_called()

    def test_missing_invalid_or_inactive_authentication_rejected(self):
        for headers in ({}, {"Authorization": "Bearer invalid"}):
            result = self.client.post("/simulation/quote", json=self.body, headers=headers)
            self.assertEqual(result.status_code, 401)
        self.user.is_active = False
        self.assertEqual(self.post().status_code, 401)
        self.provider.get_rate.assert_not_called()
        self.calculate.assert_not_called()

    def test_unavailable_provider_or_java_errors_are_sanitized(self):
        self.provider.get_rate.side_effect = RateUnavailable("provider_network_error")
        result = self.post()
        self.assertEqual(result.status_code, 503)
        self.assertNotIn("provider_network_error", result.text)
        self.calculate.assert_not_called()
        self.provider.get_rate.side_effect = None
        self.calculate.side_effect = ServiceUnavailable()
        self.assertEqual(self.post().status_code, 503)

    def test_snapshot_expiring_during_calculation_is_not_issued(self):
        snapshot = self.provider.get_rate.return_value
        self.provider.get_rate.return_value = replace(snapshot, valid_until=self.now - timedelta(seconds=1))
        self.assertEqual(self.post().status_code, 503)

    def test_invalid_request_and_currencies_rejected(self):
        for changes in ({"gross_amount": "NaN"}, {"gross_amount": "0"}, {"gross_amount": "1.001"},
                        {"recipient_name": " "}, {"source_currency": "USD"}, {"sender_id": "synthetic-B"}):
            self.body.update(changes)
            self.assertEqual(self.post().status_code, 422)
            self.body = {"recipient_name": "Synthetic recipient", "gross_amount": "1000.00"}
        self.calculate.assert_not_called()

    def test_quote_endpoint_is_throttled(self):
        for _ in range(10):
            self.assertEqual(self.post().status_code, 200)
        self.assertEqual(self.post().status_code, 429)

    def test_quote_token_cannot_authenticate_api_requests(self):
        token = self.post().json()["quote_token"]
        self.assertEqual(self.client.get("/transactions/", headers={"Authorization": "Bearer " + token}).status_code, 401)


if __name__ == "__main__":
    unittest.main()
