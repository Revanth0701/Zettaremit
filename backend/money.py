"""Deterministic simulation arithmetic, INR to USD, never settlement."""
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pydantic import BaseModel, ConfigDict, Field, field_validator

RATE = Decimal("83.50000000")  # Illustrative INR per USD, not a live quote.
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


def amounts(gross):
    fee = (gross * FEE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net = gross - fee
    received = (net / RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return fee, net, received


def fingerprint(request):
    value = {"recipient_name": request.recipient_name, "gross_amount": format(request.gross_amount, ".2f"), "source_currency": "INR", "target_currency": "USD"}
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
