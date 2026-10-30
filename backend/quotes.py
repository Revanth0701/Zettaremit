"""Purpose-separated, stateless simulation quotes; never reads/writes a database.

Tokens are signed, not encrypted: return only to the authenticated owner, never
log them. Validation uses the signed rate snapshot, never a newer provider rate.
Single-use consumption/idempotent recording belongs to a later coordinated phase.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import hmac
import jwt
from pydantic import ValidationError
from api_responses import QuoteDetails, QuoteResponse
from auth import signing_key
from exchange_rates import MAX_AGE, ATTRIBUTION_TEXT, ATTRIBUTION_URL
from money import TransferRequest, amounts, normalize_rate

ALGORITHM = "HS256"
ISSUER = "zettaremit-api"
AUDIENCE = "zettaremit-simulation-quote"
PURPOSE = "zettaremit:simulation-quote:v1"
QUOTE_LIFETIME = timedelta(minutes=5)
_CLAIMS = {"sub", "iat", "nbf", "exp", "iss", "aud", "purpose", "jti", "quote"}


class InvalidQuote(Exception):
    def __init__(self):
        super().__init__("Invalid or expired simulation quote")


def utc_now():
    return datetime.now(timezone.utc)


def _key():
    # Domain-separated HMAC derivation: no new environment secret is required,
    # and possession of a quote token cannot authorize an access token.
    return hmac.new(signing_key().encode("utf-8"), PURPOSE.encode("ascii"), hashlib.sha256).digest()


def _check_details(details, now):
    request = TransferRequest(recipient_name=details.recipient_name, gross_amount=Decimal(details.gross_amount))
    rate = normalize_rate(Decimal(details.exchange_rate))
    fee, net, payout = amounts(request.gross_amount, rate)
    expected = {
        "recipient_name": request.recipient_name, "gross_amount": format(request.gross_amount, ".2f"),
        "fee_deducted": format(fee, ".2f"), "net_amount": format(net, ".2f"),
        "recipient_amount": format(payout, ".2f"), "exchange_rate": format(rate, ".8f"),
    }
    if any(getattr(details, field) != value for field, value in expected.items()):
        raise InvalidQuote()
    dates = (details.issued_at, details.expires_at, details.provider_updated_at,
             details.provider_next_update_at, details.rate_valid_until)
    if any(date.microsecond or date.utcoffset() != timedelta(0) for date in dates):
        raise InvalidQuote()
    if not (details.provider_updated_at <= details.issued_at <= now < details.expires_at):
        raise InvalidQuote()
    if not (details.provider_updated_at < details.provider_next_update_at <= details.provider_updated_at + MAX_AGE):
        raise InvalidQuote()
    if not (details.expires_at <= details.rate_valid_until <= details.provider_updated_at + MAX_AGE):
        raise InvalidQuote()
    if details.expires_at != min(details.issued_at + QUOTE_LIFETIME, details.rate_valid_until):
        raise InvalidQuote()
    if details.rate_schedule_overdue != (details.issued_at >= details.provider_next_update_at):
        raise InvalidQuote()


def issue_quote(owner, request, snapshot, calculation, quote_id, *, now=None):
    """Sign only a mutually consistent Python/Java result and acceptable rate."""
    now = now or utc_now()
    issued = now.astimezone(timezone.utc).replace(microsecond=0)
    if not isinstance(owner, str) or not 1 <= len(owner) <= 50:
        raise InvalidQuote()
    if (snapshot.base_currency != "USD" or snapshot.quote_currency != "INR"
            or snapshot.attribution_text != ATTRIBUTION_TEXT or snapshot.attribution_url != ATTRIBUTION_URL):
        raise InvalidQuote()
    rate = normalize_rate(snapshot.inr_per_usd)
    if rate != snapshot.inr_per_usd:
        raise InvalidQuote()
    fee, net, payout = amounts(request.gross_amount, rate)
    expected = {"feeDeducted": fee, "netAmount": net, "recipientAmount": payout, "exchangeRate": rate}
    if calculation != expected:
        raise InvalidQuote()
    deadline = snapshot.valid_until.astimezone(timezone.utc).replace(microsecond=0)
    details = QuoteDetails(
        quote_id=quote_id, recipient_name=request.recipient_name, gross_amount=format(request.gross_amount, ".2f"),
        fee_deducted=format(fee, ".2f"), net_amount=format(net, ".2f"), recipient_amount=format(payout, ".2f"),
        exchange_rate=format(rate, ".8f"), provider_updated_at=snapshot.observed_at,
        provider_next_update_at=snapshot.next_update_at, rate_valid_until=deadline,
        rate_schedule_overdue=issued >= snapshot.next_update_at,
        issued_at=issued, expires_at=min(issued + QUOTE_LIFETIME, deadline),
    )
    _check_details(details, now)
    token = jwt.encode({"sub": owner, "iat": int(issued.timestamp()), "nbf": int(issued.timestamp()),
                        "exp": int(details.expires_at.timestamp()), "iss": ISSUER, "aud": AUDIENCE,
                        "purpose": PURPOSE, "jti": quote_id, "quote": details.model_dump(mode="json")},
                       _key(), algorithm=ALGORITHM, headers={"typ": "zettaremit-quote+jwt"})
    return QuoteResponse(**details.model_dump(), quote_token=token)


def validate_quote(token, owner, expected_request=None, *, now=None):
    """Return verified details or a sanitized InvalidQuote; no provider/DB calls.

    Caller must authenticate an active user first. This does not consume a quote
    or replace the transaction ownership and idempotency checks.
    """
    try:
        if not isinstance(token, str) or not 1 <= len(token) <= 8192:
            raise InvalidQuote()
        if not isinstance(owner, str) or not 1 <= len(owner) <= 50:
            raise InvalidQuote()
        header = jwt.get_unverified_header(token)
        if header != {"alg": ALGORITHM, "typ": "zettaremit-quote+jwt"}:
            raise InvalidQuote()
        # Signature, issuer and audience are verified by PyJWT. Time claims are
        # checked strictly below using one clock (also supports offline tests).
        claims = jwt.decode(token, _key(), algorithms=[ALGORITHM], issuer=ISSUER, audience=AUDIENCE,
                            options={"require": list(_CLAIMS), "verify_exp": False,
                                     "verify_iat": False, "verify_nbf": False})
        if (set(claims) != _CLAIMS or claims["sub"] != owner or claims["purpose"] != PURPOSE
                or claims["iss"] != ISSUER or claims["aud"] != AUDIENCE):
            raise InvalidQuote()
        if any(type(claims[name]) is not int for name in ("iat", "nbf", "exp")):
            raise InvalidQuote()
        if not isinstance(claims["quote"], dict):
            raise InvalidQuote()
        if any(type(claims["quote"].get(field)) is not bool for field in ("simulation", "rate_schedule_overdue")):
            raise InvalidQuote()
        details = QuoteDetails.model_validate(claims["quote"])
        if details.model_dump(mode="json") != claims["quote"]:
            raise InvalidQuote()
        if (claims["iat"] != int(details.issued_at.timestamp()) or claims["nbf"] != claims["iat"]
                or claims["exp"] != int(details.expires_at.timestamp()) or claims["jti"] != details.quote_id):
            raise InvalidQuote()
        _check_details(details, now or utc_now())
        if expected_request is not None and (details.recipient_name != expected_request.recipient_name
                or details.gross_amount != format(expected_request.gross_amount, ".2f")):
            raise InvalidQuote()
        return details
    except (jwt.InvalidTokenError, ValidationError, ValueError, TypeError, KeyError, OverflowError):
        raise InvalidQuote() from None
