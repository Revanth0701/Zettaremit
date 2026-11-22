"""In-process Decimal quote calculation for simulated transfers.

FastAPI owns authentication, signed quotes, idempotency and persistence.
No external Java service is required.
"""
from decimal import Decimal
from money import amounts, normalize_rate


class ServiceUnavailable(Exception):
    """Sanitized error compatible with existing API callers."""


def calculate_transfer(owner, request, key, *, rate):
    try:
        if not isinstance(owner, str) or not 1 <= len(owner) <= 50:
            raise ValueError("Invalid owner")
        if not isinstance(key, str) or not 16 <= len(key) <= 128 or any(
            not (c.isascii() and (c.isalnum() or c in "_-")) for c in key
        ):
            raise ValueError("Invalid request ID")
        gross = request.gross_amount
        if not isinstance(gross, Decimal) or not gross.is_finite() or not (
            Decimal("0") < gross <= Decimal("1000000.00")
        ):
            raise ValueError("Invalid gross amount")
        normalized = normalize_rate(rate)
        fee, net, received = amounts(gross, normalized)
        return {
            "feeDeducted": fee,
            "netAmount": net,
            "recipientAmount": received,
            "exchangeRate": normalized,
        }
    except (ValueError, ArithmeticError, AttributeError, TypeError):
        raise ServiceUnavailable() from None
