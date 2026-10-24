"""Authenticated stateless Java call; never forwards a user bearer token."""
import json
from decimal import Decimal
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler, ProxyHandler
from settings import setting
from money import amounts, normalize_rate


class ServiceUnavailable(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def calculate_transfer(owner, request, key, *, rate):
    try:
        rate = normalize_rate(rate)
    except ValueError:
        raise ServiceUnavailable() from None
    secret = setting("INTERNAL_SERVICE_TOKEN", "")
    base = setting("INTERNAL_SERVICE_URL", "http://127.0.0.1:8082")
    parsed = urlsplit(base)
    if len(secret.encode()) < 32 or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ServiceUnavailable()
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1", "::1")):
        raise ServiceUnavailable()
    payload = {"ownerId": owner, "requestId": key, "recipientName": request.recipient_name,
               "grossAmount": format(request.gross_amount, ".2f"), "exchangeRate": format(rate, ".8f")}
    req = Request(base.rstrip("/") + "/internal/v2/quote", data=json.dumps(payload).encode(),
                  headers={"Authorization": "Bearer " + secret, "Content-Type": "application/json"}, method="POST")
    try:
        with build_opener(ProxyHandler({}), NoRedirect()).open(req, timeout=8) as response:
            raw = response.read(16385)
            if len(raw) > 16384:
                raise ServiceUnavailable()
            # Java serializes BigDecimal as JSON numbers. Preserve every digit
            # instead of losing precision through Python's binary float parser.
            result = json.loads(raw, parse_float=Decimal)
        fee, net, received = amounts(request.gross_amount, rate)
        expected = {"feeDeducted": fee, "netAmount": net, "recipientAmount": received, "exchangeRate": rate}
        if result.get("status") != "SIMULATED" or result.get("ownerId") != owner or result.get("requestId") != key:
            raise ServiceUnavailable()
        if any(Decimal(str(result[name])) != value for name, value in expected.items()):
            raise ServiceUnavailable()
        return expected
    except Exception:
        # Never render HTTP/driver exceptions, URLs or payloads in API responses.
        raise ServiceUnavailable() from None
