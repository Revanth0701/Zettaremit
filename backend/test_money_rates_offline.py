"""Explicit-rate arithmetic and mocked private Java protocol; no app/DB imports."""
from decimal import Decimal, localcontext
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from money import amounts, normalize_rate, TransferRequest
import internal_service

VECTORS = Path(__file__).resolve().parent.parent / "services/transaction-service/src/test/resources/exchange_rate_vectors.json"


class MoneyRateTests(unittest.TestCase):
    def setUp(self):
        guard = patch("socket.socket.connect", side_effect=AssertionError("Network forbidden"))
        guard.start()
        self.addCleanup(guard.stop)
        self.settings = {"INTERNAL_SERVICE_TOKEN": "synthetic-service-token-at-least-32-characters",
                         "INTERNAL_SERVICE_URL": "https://internal.example.com"}
        self.opener = Mock()
        self.response = Mock()
        self.response.__enter__ = Mock(return_value=self.response)
        self.response.__exit__ = Mock(return_value=False)
        self.opener.open.return_value = self.response
        for guard in (patch.object(internal_service, "setting", side_effect=lambda k, d=None: self.settings.get(k, d)),
                      patch.object(internal_service, "build_opener", return_value=self.opener)):
            guard.start()
            self.addCleanup(guard.stop)

    def reply(self, vector):
        reply = {
            "ownerId": "synthetic", "requestId": "synthetic-request-0001", "status": "SIMULATED",
            "feeDeducted": vector["fee"], "netAmount": vector["net"],
            "recipientAmount": vector["payout"], "exchangeRate": vector["rate"],
        }
        raw = json.dumps(reply)
        # Match Java's numeric BigDecimal JSON without constructing any floats.
        for field in ("feeDeducted", "netAmount", "recipientAmount", "exchangeRate"):
            raw = raw.replace(json.dumps(field) + ": " + json.dumps(reply[field]), json.dumps(field) + ": " + reply[field])
        self.response.read.return_value = raw.encode()

    def request(self, rate):
        return internal_service.calculate_transfer("synthetic", TransferRequest(recipient_name="Synthetic", gross_amount="1000.00"),
                                                   "synthetic-request-0001", rate=rate)

    def test_shared_java_vectors_and_private_request(self):
        for vector in json.loads(VECTORS.read_text()):
            with self.subTest(vector=vector):
                rate = Decimal(vector["rate"])
                self.assertEqual(amounts(Decimal(vector["gross"]), rate),
                                 tuple(Decimal(vector[k]) for k in ("fee", "net", "payout")))
                self.reply(vector)
                result = internal_service.calculate_transfer("synthetic", TransferRequest(recipient_name="Synthetic", gross_amount=vector["gross"]),
                                                             "synthetic-request-0001", rate=rate)
                request = self.opener.open.call_args.args[0]
                self.assertEqual(request.full_url, "https://internal.example.com/internal/v2/quote")
                payload = json.loads(request.data)
                self.assertEqual(payload["exchangeRate"], vector["rate"])
                self.assertIsInstance(payload["exchangeRate"], str)
                self.assertEqual(result["recipientAmount"], Decimal(vector["payout"]))
                self.assertEqual(result["exchangeRate"], rate)

    def test_normalize_once_before_sending_and_checking_response(self):
        self.reply(dict(gross="1000", fee="30", net="970", payout="11.13", rate="87.12345679"))
        self.assertEqual(self.request(Decimal("87.123456785"))["exchangeRate"], Decimal("87.12345679"))
        self.assertEqual(json.loads(self.opener.open.call_args.args[0].data)["exchangeRate"], "87.12345679")

    def test_reject_invalid_rates_before_any_transport(self):
        for rate in (None, "87.12", 87.12, 87, True, Decimal("0"), Decimal("-1"), Decimal("NaN"),
                     Decimal("sNaN"), Decimal("Infinity"), Decimal("-Infinity"), Decimal("0.000000001"),
                     Decimal("10000000000"), Decimal("1e100")):
            with self.subTest(rate=rate):
                with self.assertRaises(ValueError):
                    amounts(Decimal("1000"), rate)
                with self.assertRaises(internal_service.ServiceUnavailable):
                    self.request(rate)
        self.opener.open.assert_not_called()
        with self.assertRaises(TypeError):
            amounts(Decimal("1000"))

    def test_reject_a_different_java_rate_even_if_payout_rounds_identically(self):
        self.reply(dict(fee="30", net="970", payout="12.13", rate="80.00000001"))
        with self.assertRaises(internal_service.ServiceUnavailable):
            self.request(Decimal("80"))

    def test_reject_wrong_java_calculations_and_nonfinite_values(self):
        for field in ("feeDeducted", "netAmount", "recipientAmount", "exchangeRate"):
            for value in ("NaN", "Infinity", "-1", "0.01"):
                self.reply(dict(fee="30", net="970", payout="12.13", rate="80.00000000"))
                reply = json.loads(self.response.read.return_value)
                reply[field] = value
                self.response.read.return_value = json.dumps(reply).encode()
                with self.assertRaises(internal_service.ServiceUnavailable):
                    self.request(Decimal("80"))

    def test_missing_rate_cannot_select_a_legacy_fallback(self):
        request = TransferRequest(recipient_name="Synthetic", gross_amount="1000.00")
        with self.assertRaises(TypeError):
            internal_service.calculate_transfer("synthetic", request, "synthetic-request-0001")
        self.opener.open.assert_not_called()

    def test_calculation_independent_of_callers_decimal_precision(self):
        with localcontext() as context:
            context.prec = 6
            self.assertEqual(normalize_rate(Decimal("87.123456785")), Decimal("87.12345679"))
            self.assertEqual(amounts(Decimal("1000"), Decimal("80")), (Decimal("30"), Decimal("970"), Decimal("12.13")))


if __name__ == "__main__":
    unittest.main()
