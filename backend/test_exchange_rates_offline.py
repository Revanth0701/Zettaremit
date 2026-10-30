"""Mocked provider only; blocks sockets and never imports the application."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from email.utils import format_datetime
import json
from pathlib import Path
import ssl
import sys
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parent))
import exchange_rates as fx


class ExchangeRateTests(unittest.TestCase):
    def setUp(self):
        self.socket_guard = patch("socket.socket.connect", side_effect=AssertionError("Network forbidden"))
        self.socket_guard.start()
        self.addCleanup(self.socket_guard.stop)
        self.now = datetime(2026, 10, 23, 12, tzinfo=timezone.utc)
        self.tick = 0.0
        self.opener = Mock()
        with patch.object(fx, "build_opener", return_value=self.opener):
            self.provider = fx.ExchangeRateProvider(clock=lambda: self.now, monotonic=lambda: self.tick)
        self.respond(self.payload())

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)
        self.tick += seconds

    def payload(self, **changes):
        result = {
            "result": "success", "base_code": "USD", "rates": {"USD": 1, "INR": 87.123456785},
            "time_last_update_unix": int((self.now - timedelta(hours=12)).timestamp()),
            "time_next_update_unix": int((self.now + timedelta(hours=12)).timestamp()),
            "time_eol_unix": 0,
        }
        result.update(changes)
        return result

    def respond(self, payload=None, raw=None, status=200):
        response = Mock()
        response.status = status
        response.read.return_value = raw if raw is not None else json.dumps(payload).encode()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        self.opener.open.side_effect = None
        self.opener.open.return_value = response
        return response

    def test_decimal_normalization_metadata_and_attribution(self):
        # Preserve all JSON decimal digits; no binary float parsing in module.
        raw = json.dumps(self.payload()).replace('87.123456785', '87.12345678500000001').encode()
        self.respond(raw=raw)
        rate = self.provider.get_rate()
        self.assertEqual(rate.inr_per_usd, Decimal("87.12345679"))
        self.assertEqual(rate.inr_per_usd.as_tuple().exponent, -8)
        self.assertEqual((rate.base_currency, rate.quote_currency), ("USD", "INR"))
        self.assertEqual(rate.observed_at, self.now - timedelta(hours=12))
        self.assertEqual(rate.valid_until, rate.observed_at + timedelta(hours=96))
        self.assertEqual(rate.attribution_text, "Rates By Exchange Rate API")
        self.assertEqual(rate.attribution_url, "https://www.exchangerate-api.com")
        self.assertFalse(rate.schedule_overdue)

    def test_fixed_https_transport_timeout_and_no_key(self):
        self.provider.get_rate()
        args, kwargs = self.opener.open.call_args
        self.assertEqual(args[0].full_url, fx.ENDPOINT)
        self.assertEqual(args[0].get_method(), "GET")
        self.assertEqual(args[0].headers, {"Accept": "application/json"})
        self.assertEqual(kwargs, {"timeout": 5})
        with patch.object(fx, "build_opener") as build:
            fx.ExchangeRateProvider()
        handlers = build.call_args.args
        self.assertEqual(handlers[0].proxies, {})
        self.assertIsNone(handlers[1].redirect_request(None, None, 302, "", {}, "http://example.com"))
        context = handlers[2]._context
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.minimum_version, ssl.TLSVersion.TLSv1_2)

    def test_cache_refreshes_at_provider_schedule_not_each_call(self):
        first = self.provider.get_rate()
        self.advance(11 * 3600)
        self.assertEqual(self.provider.get_rate(), first)
        self.assertEqual(self.opener.open.call_count, 1)
        self.advance(3600)
        self.respond(self.payload())
        updated = self.provider.get_rate()
        self.assertGreater(updated.observed_at, first.observed_at)
        self.assertEqual(self.opener.open.call_count, 2)

    def test_overdue_success_is_requested_at_most_hourly(self):
        self.respond(self.payload(time_next_update_unix=int((self.now - timedelta(hours=1)).timestamp())))
        self.assertTrue(self.provider.get_rate().schedule_overdue)
        self.advance(3599)
        self.provider.get_rate()
        self.assertEqual(self.opener.open.call_count, 1)
        self.advance(1)
        self.provider.get_rate()
        self.assertEqual(self.opener.open.call_count, 2)

    def test_weekend_holiday_cache_and_hard_expiry(self):
        first = self.provider.get_rate()  # Friday observation, not a business-day calculation.
        self.opener.open.side_effect = TimeoutError("private transport details")
        self.advance(72 * 3600)
        cached = self.provider.get_rate()  # Monday, observation age 84h.
        self.assertEqual(cached.inr_per_usd, first.inr_per_usd)
        self.assertEqual(cached.observed_at, first.observed_at)
        self.assertTrue(cached.schedule_overdue)
        self.advance(12 * 3600)
        with self.assertRaisesRegex(fx.RateUnavailable, "^stale_rate$"):
            self.provider.get_rate()

    def test_network_failure_backoff_does_not_return_fallback(self):
        self.opener.open.side_effect = URLError("sensitive upstream details")
        for _ in range(5):
            with self.assertRaisesRegex(fx.RateUnavailable, "^provider_network_error$"):
                self.provider.get_rate()
        self.assertEqual(self.opener.open.call_count, 1)
        self.advance(60)
        with self.assertRaises(fx.RateUnavailable):
            self.provider.get_rate()
        self.advance(119)
        with self.assertRaises(fx.RateUnavailable):
            self.provider.get_rate()
        self.assertEqual(self.opener.open.call_count, 2)
        self.advance(1)
        self.respond(self.payload())
        self.assertEqual(self.provider.get_rate().inr_per_usd, Decimal("87.12345679"))

    def test_backoff_caps_at_one_hour(self):
        self.opener.open.side_effect = TimeoutError()
        for _ in range(10):
            with self.assertRaises(fx.RateUnavailable):
                self.provider.get_rate()
            self.assertLessEqual(self.provider._retry_at - self.tick, 3600)
            self.advance(3600)

    def test_429_backoff_and_retry_after(self):
        for header, expected in ((None, 1200), ("1800", 1800), ("9999999", 86400),
                                 ("not-a-date", 1200),
                                 (format_datetime(self.now + timedelta(hours=2)), 7200)):
            with self.subTest(header=header):
                self.provider._retry_at = 0
                self.provider._failures = 0
                self.opener.open.side_effect = HTTPError(fx.ENDPOINT, 429, "hidden", {"Retry-After": header} if header else {}, None)
                with self.assertRaisesRegex(fx.RateUnavailable, "^rate_limited$"):
                    self.provider.get_rate()
                self.assertEqual(self.provider._retry_at - self.tick, expected)

    def test_cached_snapshot_survives_rate_limit_without_extending_age(self):
        first = self.provider.get_rate()
        self.advance(12 * 3600)
        self.opener.open.side_effect = HTTPError(fx.ENDPOINT, 429, "hidden", {}, None)
        cached = self.provider.get_rate()
        self.assertEqual(cached.valid_until, first.valid_until)
        self.assertTrue(cached.schedule_overdue)
        self.provider.get_rate()
        self.assertEqual(self.opener.open.call_count, 2)

    def test_invalid_responses(self):
        cases = [b"not json", b"[]", b"{\"rates\":NaN}",
                 json.dumps(self.payload(result="error")).encode(),
                 json.dumps(self.payload(base_code="INR")).encode()]
        for rate in (0, -1, True, "87.12", None, 0.000000001, 10000000000, 1e100):
            cases.append(json.dumps(self.payload(rates={"USD": 1, "INR": rate})).encode())
        for rates in ({"USD": 2, "INR": 87}, {"USD": True, "INR": 87}, {"INR": 87}, {"USD": 1}, []):
            cases.append(json.dumps(self.payload(rates=rates)).encode())
        for raw in cases:
            with self.subTest(raw=raw):
                with self.assertRaisesRegex(fx.RateUnavailable, "^invalid_provider_response$"):
                    fx._validate(raw, self.now)

    def test_update_timestamp_validation(self):
        epoch = int(self.now.timestamp())
        for changes in (
            {"time_last_update_unix": True}, {"time_last_update_unix": "123"},
            {"time_last_update_unix": epoch + 1}, {"time_last_update_unix": 10**100},
            {"time_next_update_unix": epoch - 86400},
            {"time_next_update_unix": epoch + 96 * 3600},
            {"time_last_update_unix": epoch - 96 * 3600, "time_next_update_unix": epoch - 72 * 3600},
            {"time_last_update_utc": "not a date"}, {"time_last_update_utc": format_datetime(self.now)},
            {"time_last_update_utc": None}, {"time_next_update_utc": []},
            {"time_eol_unix": -1}, {"time_eol_unix": True}, {"time_eol_unix": epoch},
        ):
            with self.subTest(changes=changes):
                with self.assertRaises(fx.RateUnavailable):
                    fx._validate(json.dumps(self.payload(**changes)), self.now)

    def test_matching_utc_fields_and_eol_deadline(self):
        payload = self.payload(time_eol_unix=int((self.now + timedelta(hours=1)).timestamp()))
        for name in ("last", "next"):
            payload[f"time_{name}_update_utc"] = format_datetime(datetime.fromtimestamp(payload[f"time_{name}_update_unix"], timezone.utc))
        snapshot = fx._validate(json.dumps(payload), self.now)
        self.assertEqual(snapshot.valid_until, self.now + timedelta(hours=1))

    def test_regressed_or_inconsistent_observation_preserves_cache(self):
        first = self.provider.get_rate()
        self.advance(12 * 3600)
        self.respond(self.payload(time_last_update_unix=int(first.observed_at.timestamp()) - 1))
        self.assertEqual(self.provider.get_rate().observed_at, first.observed_at)
        self.assertEqual(self.provider._last_error, "regressed_observation")
        self.advance(60)
        self.respond(self.payload(time_last_update_unix=int(first.observed_at.timestamp()), rates={"USD": 1, "INR": 88}))
        self.assertEqual(self.provider.get_rate().inr_per_usd, first.inr_per_usd)
        self.assertEqual(self.provider._last_error, "inconsistent_observation")

    def test_response_size_and_status_limits(self):
        for raw, status in ((b"x" * (fx.MAX_RESPONSE_BYTES + 1), 200), (b"{}", 503)):
            self.provider._retry_at = 0
            response = self.respond(raw=raw, status=status)
            with self.assertRaises(fx.RateUnavailable):
                self.provider.get_rate()
            if status == 200:
                response.read.assert_called_once_with(fx.MAX_RESPONSE_BYTES + 1)

    def test_concurrent_calls_fetch_once(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            snapshots = list(pool.map(lambda _: self.provider.get_rate(), range(20)))
        self.assertEqual(self.opener.open.call_count, 1)
        self.assertTrue(all(item == snapshots[0] for item in snapshots))

    def test_constructor_has_no_network_side_effect(self):
        self.opener.open.assert_not_called()

    def test_tls_failure_is_sanitized_and_never_bypassed(self):
        self.opener.open.side_effect = URLError(ssl.SSLCertVerificationError("private certificate details"))
        with self.assertRaisesRegex(fx.RateUnavailable, "^provider_network_error$"):
            self.provider.get_rate()
        self.assertIsNone(self.provider._snapshot)
        self.assertEqual(self.opener.open.call_count, 1)

    def test_expiry_applies_even_during_retry_after(self):
        self.provider.get_rate()
        self.advance(83 * 3600)  # Observation is now 95 hours old.
        self.opener.open.side_effect = HTTPError(fx.ENDPOINT, 429, "hidden", {"Retry-After": "86400"}, None)
        self.provider.get_rate()
        self.advance(3600)
        with self.assertRaisesRegex(fx.RateUnavailable, "^stale_rate$"):
            self.provider.get_rate()
        self.assertEqual(self.opener.open.call_count, 2)


if __name__ == "__main__":
    unittest.main()
