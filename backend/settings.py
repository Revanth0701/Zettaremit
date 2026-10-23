"""Non-mutating environment lookup; no secrets in diagnostics."""
import os
from pathlib import Path
from dotenv import dotenv_values


def setting(name, default=None):
    if name in os.environ:
        return os.environ[name]
    return dotenv_values(Path(__file__).resolve().parent / ".env", interpolate=False).get(name, default)


def production():
    value = setting("APP_ENV", "development")
    if value not in ("development", "test", "production"):
        raise RuntimeError("APP_ENV must be development, test or production")
    return value == "production"
