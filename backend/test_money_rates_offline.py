"""Offline regression vectors for Python replacement of Java quote calculator."""
from decimal import Decimal, localcontext
import json
from pathlib import Path
import socket
import unittest
from unittest.mock import patch

from money import amounts, normalize_rate, TransferRequest
from internal_service import calculate_transfer, ServiceUnavailable

VECTORS = Path(__file__).resolve().parent.parent / "services/transaction-service/src/test/resources/exchange_rate_vectors.json"
KEY = "synthetic-request-0001"

class MoneyRateTests(unittest.TestCase):
    def test_shared_calculation_vectors_without_network(self):
        with patch.object(socket.socket, "connect", side_effect=AssertionError("Network forbidden")):
            for vector in json.loads(VECTORS.read_text()):
                with self.subTest(vector=vector):
                    gross = Decimal(vector["gross"])
                    rate = Decimal(vector["rate"])
                    request = TransferRequest(recipient_name="Synthetic", gross_amount=gross)
                    result = calculate_transfer("synthetic", request, KEY, rate=rate)
                    self.assertEqual(result["feeDeducted"], Decimal(vector["fee"]))
                    self.assertEqual(result["netAmount"], Decimal(vector["net"]))
                    self.assertEqual(result["recipientAmount"], Decimal(vector["payout"]))
                    self.assertEqual(result["exchangeRate"], rate)
                    self.assertEqual(amounts(gross, rate), tuple(Decimal(vector[k]) for k in ("fee", "net", "payout")))

    def test_rounding_and_decimal_context(self):
        with localcontext() as context:
            context.prec = 6
            self.assertEqual(normalize_rate(Decimal("87.123456785")), Decimal("87.12345679"))
            self.assertEqual(amounts(Decimal("1000"), Decimal("80")), (Decimal("30"), Decimal("970"), Decimal("12.13")))

    def test_invalid_rates(self):
        request = TransferRequest(recipient_name="Synthetic", gross_amount="1000.00")
        for rate in (None, "87.12", 87.12, 87, True, Decimal("0"), Decimal("-1"),
                     Decimal("NaN"), Decimal("sNaN"), Decimal("Infinity"), Decimal("0.000000001"),
                     Decimal("10000000000"), Decimal("1e100")):
            with self.subTest(rate=str(rate)), self.assertRaises(ServiceUnavailable):
                calculate_transfer("synthetic", request, KEY, rate=rate)

    def test_invalid_identity_or_request_id(self):
        request = TransferRequest(recipient_name="Synthetic", gross_amount="1000.00")
        for owner, key in (("", KEY), ("x" * 51, KEY), ("synthetic", "bad"),
                           ("synthetic", "bad key with spaces")):
            with self.assertRaises(ServiceUnavailable):
                calculate_transfer(owner, request, key, rate=Decimal("80"))

    def test_missing_rate_is_not_defaulted(self):
        request = TransferRequest(recipient_name="Synthetic", gross_amount="1000.00")
        with self.assertRaises(TypeError):
            calculate_transfer("synthetic", request, KEY)

if __name__ == "__main__":
    unittest.main()
