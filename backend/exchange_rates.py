"""Standalone USD/INR reference-rate provider; no application/startup side effects.

Call ExchangeRateProvider.get_rate() explicitly. Nothing is fetched on import.
Open Access updates daily: refresh using its published next-update timestamp,
not a weekday calendar (holidays and weekends differ across markets). An overdue
schedule may use the last validated snapshot for at most 96 hours from the
provider's observation, covering a long weekend without accepting unlimited
staleness. This is an application safety policy, not a provider freshness SLA.
Consumers must display observed_at and attribution, including when overdue.
No background threads, credentials, environment settings or database access.
"""
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
from email.utils import parsedate_to_datetime
import json
import ssl
from threading import Lock
import time
from urllib.error import HTTPError, URLError
from urllib.request import (
    HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener,
)

ENDPOINT = "https://open.er-api.com/v6/latest/USD"
ATTRIBUTION_TEXT = "Rates By Exchange Rate API"
ATTRIBUTION_URL = "https://www.exchangerate-api.com"
MAX_AGE = timedelta(hours=96)
TIMEOUT_SECONDS = 5
MAX_RESPONSE_BYTES = 128 * 1024
MIN_REFRESH_SECONDS = 3600
RATE_QUANTUM = Decimal("0.00000001")


class RateUnavailable(Exception):
    """Safe public error category; never includes raw transport/provider text."""

    def __init__(self, category):
        self.category = category
        super().__init__(category)


@dataclass(frozen=True)
class RateSnapshot:
    inr_per_usd: Decimal
    observed_at: datetime
    next_update_at: datetime
    fetched_at: datetime
    valid_until: datetime
    schedule_overdue: bool = False
    base_currency: str = "USD"
    quote_currency: str = "INR"
    attribution_text: str = ATTRIBUTION_TEXT
    attribution_url: str = ATTRIBUTION_URL


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _reject_constant(value):
    raise ValueError("Nonfinite JSON number")


def _timestamp(value):
    if type(value) is not int or value <= 0:
        raise ValueError("Invalid timestamp")
    return datetime.fromtimestamp(value, timezone.utc)


def _validate(raw, now):
    """Parse decimal JSON directly, without passing rate values through floats."""
    try:
        data = json.loads(raw, parse_float=Decimal, parse_constant=_reject_constant)
        if not isinstance(data, dict) or data.get("result") != "success":
            raise ValueError("Provider result")
        rates = data["rates"]
        if data["base_code"] != "USD" or not isinstance(rates, dict):
            raise ValueError("Currency codes")
        # USD=1 also guards against a mislabeled or inverted base currency.
        if type(rates.get("USD")) not in (int, Decimal) or rates["USD"] != 1:
            raise ValueError("Base rate")
        value = rates["INR"]
        if type(value) not in (int, Decimal):
            raise ValueError("Rate type")
        if isinstance(value, Decimal) and not value.is_finite():
            raise ValueError("Rate type")
        with localcontext() as context:
            context.prec = 32
            rate = Decimal(value).quantize(RATE_QUANTUM, rounding=ROUND_HALF_UP)
        # Fits the application's existing DECIMAL(18,8), without schema changes.
        if not rate.is_finite() or rate <= 0 or rate >= Decimal("10000000000"):
            raise ValueError("Rate range")
        observed = _timestamp(data["time_last_update_unix"])
        scheduled = _timestamp(data["time_next_update_unix"])
        if observed > now or scheduled <= observed or scheduled - observed > MAX_AGE:
            raise ValueError("Update schedule")
        for field, expected in (("time_last_update_utc", observed), ("time_next_update_utc", scheduled)):
            if field in data:
                if not isinstance(data[field], str):
                    raise ValueError("Invalid UTC timestamp")
                parsed = parsedate_to_datetime(data[field])
                if parsed.tzinfo is None or parsed != expected:
                    raise ValueError("Inconsistent timestamp")
        eol = data.get("time_eol_unix", 0)
        if type(eol) is not int or eol < 0:
            raise ValueError("Invalid EOL")
        expires = min(observed + MAX_AGE, _timestamp(eol)) if eol else observed + MAX_AGE
        if now >= expires:
            raise ValueError("Stale observation")
        return RateSnapshot(rate, observed, scheduled, now, expires)
    except (ValueError, TypeError, KeyError, InvalidOperation, OverflowError, OSError):
        raise RateUnavailable("invalid_provider_response") from None


class ExchangeRateProvider:
    """One shared instance per worker; serialized refresh prevents request bursts.

    Successful requests are at least one hour apart and normally once per daily
    provider update. Failures back off 60s exponentially to 1h; HTTP 429 waits at
    least 20 minutes, honoring Retry-After up to 24h. A usable cache survives a
    failed refresh, but never beyond valid_until. Cache is lost on restart.
    urllib's timeout bounds blocking socket operations, not total wall time.
    """

    def __init__(self, *, clock=None, monotonic=None):
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._monotonic = monotonic or time.monotonic
        context = ssl.create_default_context()
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        # No environment proxy or redirects: the destination is fixed HTTPS,
        # with system CA trust and hostname verification always enabled.
        self._opener = build_opener(ProxyHandler({}), _NoRedirect(), HTTPSHandler(context=context))
        self._lock = Lock()
        self._snapshot = None
        self._retry_at = 0.0
        self._failures = 0
        self._last_error = "rate_unavailable"

    def _usable(self, now):
        return self._snapshot is not None and self._snapshot.observed_at <= now < self._snapshot.valid_until

    def _retry_delay(self, error, now):
        delay = min(3600, 60 * 2 ** min(self._failures - 1, 6))
        if error.code == 429:
            delay = max(delay, 1200)
        header = error.headers.get("Retry-After") if error.headers else None
        if header:
            try:
                seconds = int(header)
            except ValueError:
                try:
                    seconds = (parsedate_to_datetime(header) - now).total_seconds()
                except (ValueError, TypeError, OverflowError):
                    seconds = 0
            delay = max(delay, min(86400, max(0, seconds)))
        return delay

    def get_rate(self):
        with self._lock:
            now = self._clock()
            tick = self._monotonic()
            due = self._snapshot is None or now >= self._snapshot.next_update_at
            if tick >= self._retry_at and (due or not self._usable(now)):
                delay = None
                try:
                    request = Request(ENDPOINT, headers={"Accept": "application/json"}, method="GET")
                    with self._opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                        if response.status != 200:
                            raise RateUnavailable("provider_http_error")
                        raw = response.read(MAX_RESPONSE_BYTES + 1)
                        if len(raw) > MAX_RESPONSE_BYTES:
                            raise RateUnavailable("invalid_provider_response")
                        snapshot = _validate(raw, self._clock())
                    if self._snapshot and snapshot.observed_at < self._snapshot.observed_at:
                        raise RateUnavailable("regressed_observation")
                    if (self._snapshot and snapshot.observed_at == self._snapshot.observed_at
                            and snapshot.inr_per_usd != self._snapshot.inr_per_usd):
                        raise RateUnavailable("inconsistent_observation")
                    self._snapshot = snapshot
                    self._failures = 0
                    self._retry_at = self._monotonic() + MIN_REFRESH_SECONDS
                except HTTPError as error:
                    self._failures += 1
                    self._last_error = "rate_limited" if error.code == 429 else "provider_http_error"
                    delay = self._retry_delay(error, self._clock())
                    error.close()
                except (URLError, TimeoutError, OSError):
                    self._failures += 1
                    self._last_error = "provider_network_error"
                except RateUnavailable as error:
                    self._failures += 1
                    self._last_error = error.category
                if self._failures:
                    self._retry_at = self._monotonic() + (delay or min(3600, 60 * 2 ** min(self._failures - 1, 6)))
            now = self._clock()
            if self._usable(now):
                return replace(self._snapshot, schedule_overdue=now >= self._snapshot.next_update_at)
            raise RateUnavailable("stale_rate" if self._snapshot else self._last_error) from None


_SHARED_PROVIDER = None


def get_exchange_rate_provider() -> ExchangeRateProvider:
    """Return the shared process-local ExchangeRateProvider singleton."""
    global _SHARED_PROVIDER
    if _SHARED_PROVIDER is None:
        _SHARED_PROVIDER = ExchangeRateProvider()
    return _SHARED_PROVIDER

