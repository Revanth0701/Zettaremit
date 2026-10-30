"""Deterministic simulation arithmetic, INR to USD, never settlement."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
import hashlib
import json
from pydantic import BaseModel, ConfigDict, Field, field_validator

RATE = Decimal("83.50000000")  # Temporary legacy API compatibility only; not live.
FEE = Decimal("0.03")


class TransferRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipient_name: str = Field(min_length=1, max_length=255)
    gross_amount: Decimal = Field(gt=0, le=Decimal("1000000.00"), max_digits=12, decimal_places=2, allow_inf_nan=False)

    @field_validator("recipient_name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()
        if not value or any(ord(c) < 32 for c in value):
            raise ValueError("Recipient name is invalid")
        return value


def normalize_rate(rate):
    """Require a Decimal INR-per-USD snapshot fitting DECIMAL(18,8)."""
    if not isinstance(rate, Decimal) or not rate.is_finite() or rate <= 0:
        raise ValueError("Invalid exchange rate")
    try:
        with localcontext() as context:
            context.prec = 50
            normalized = rate.quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
        if normalized <= 0 or normalized >= Decimal("10000000000"):
            raise ValueError("Invalid exchange rate")
        return normalized
    except InvalidOperation:
        raise ValueError("Invalid exchange rate") from None


def amounts(gross, rate):
    rate = normalize_rate(rate)
    with localcontext() as context:
        context.prec = 50
        fee = (gross * FEE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        net = gross - fee
        received = (net / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return fee, net, received


def fingerprint(request):
    value = {"recipient_name": request.recipient_name, "gross_amount": format(request.gross_amount, ".2f"), "source_currency": "INR", "target_currency": "USD"}
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def submission_fingerprint(request):
    """Bind new submissions to the exact accepted token; retain legacy replay."""
    original = fingerprint(request)
    if request.quote_token is None:
        return original
    value = "zettaremit:quote-submission:v1:" + original + ":" + request.quote_token
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
