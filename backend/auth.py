"""Short-lived access tokens; no database or environment mutation on import."""
import datetime
import os
from pathlib import Path
import jwt
from settings import production
from dotenv import dotenv_values
from fastapi import HTTPException

ALGORITHM = "HS256"
ISSUER = "zettaremit-api"
AUDIENCE = "zettaremit-client"
ACCESS_TOKEN_SECONDS = 900


def signing_key():
    key = os.environ.get("JWT_SECRET_KEY")
    if key is None and not production():
        key = dotenv_values(Path(__file__).resolve().parent / ".env", interpolate=False).get("JWT_SECRET_KEY")
    if not key or len(key.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="Authentication signing configuration unavailable")
    return key


def unauthorized():
    return HTTPException(status_code=401, detail="Invalid or missing access token",
                         headers={"WWW-Authenticate": "Bearer"})


def issue_access_token(user_id):
    now = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode({"sub": user_id, "iat": now, "nbf": now,
                       "exp": now + datetime.timedelta(seconds=ACCESS_TOKEN_SECONDS),
                       "iss": ISSUER, "aud": AUDIENCE}, signing_key(), algorithm=ALGORITHM)


def token_subject(token):
    try:
        claims = jwt.decode(token, signing_key(), algorithms=[ALGORITHM],
                            issuer=ISSUER, audience=AUDIENCE,
                            options={"require": ["sub", "iat", "nbf", "exp", "iss", "aud"]})
        if any(type(claims[name]) not in (int, float) for name in ("iat", "nbf", "exp")):
            raise unauthorized()
        subject = claims["sub"]
        if not isinstance(subject, str) or not subject or len(subject) > 50:
            raise unauthorized()
        return subject
    except (jwt.InvalidTokenError, TypeError, ValueError, OverflowError):
        raise unauthorized() from None
