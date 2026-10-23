"""Public API field allowlists. Never serialize user or verification ORM objects."""
import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


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
