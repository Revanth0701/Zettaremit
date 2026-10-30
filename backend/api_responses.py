"""Public API field allowlists. Never serialize user or verification ORM objects."""
import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str
    message: str


class RegistrationResponse(BaseModel):
    message: str


class LoginResponse(BaseModel):
    message: str
    user_id: str
    full_name: str
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    transaction_id: str
    sender_id: str
    recipient_name: str
    gross_amount: Decimal
    fee_deducted: Decimal
    net_amount: Decimal
    exchange_rate: Decimal
    recipient_amount: Decimal
    source_currency: str
    target_currency: str
    status: Optional[str] = None
    created_at: Optional[datetime.datetime] = None


class TransactionCreatedResponse(BaseModel):
    message: str
    transaction: TransactionResponse


class QuoteDetails(BaseModel):
    """Signed quote allowlist; amounts are canonical decimal strings."""
    model_config = ConfigDict(extra="forbid", frozen=True)
    quote_id: str = Field(pattern=r"^QUOTE-[a-f0-9]{32}$")
    recipient_name: str = Field(min_length=1, max_length=255)
    gross_amount: str = Field(pattern=r"^[0-9]{1,7}\.[0-9]{2}$")
    fee_deducted: str = Field(pattern=r"^[0-9]{1,7}\.[0-9]{2}$")
    net_amount: str = Field(pattern=r"^[0-9]{1,7}\.[0-9]{2}$")
    recipient_amount: str = Field(pattern=r"^[0-9]{1,16}\.[0-9]{2}$")
    exchange_rate: str = Field(pattern=r"^[0-9]{1,10}\.[0-9]{8}$")
    source_currency: Literal["INR"] = "INR"
    target_currency: Literal["USD"] = "USD"
    fee_percent: Literal["3"] = "3"
    simulation: Literal[True] = True
    provider_updated_at: AwareDatetime
    provider_next_update_at: AwareDatetime
    rate_valid_until: AwareDatetime
    rate_schedule_overdue: bool
    issued_at: AwareDatetime
    expires_at: AwareDatetime
    attribution_text: Literal["Rates By Exchange Rate API"] = "Rates By Exchange Rate API"
    attribution_url: Literal["https://www.exchangerate-api.com"] = "https://www.exchangerate-api.com"


class QuoteResponse(QuoteDetails):
    quote_token: str
