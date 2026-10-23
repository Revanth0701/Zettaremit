"""Database selection and TLS configuration. Importing this module never connects."""
from dataclasses import dataclass, field
from pathlib import Path
import errno
import os
import socket
import ssl

from dotenv import dotenv_values
from dotenv.parser import parse_stream
from pymysql.err import MySQLError
from sqlalchemy import create_engine
from sqlalchemy.engine import URL

BACKEND_DIR = Path(__file__).resolve().parent


class ConfigurationError(RuntimeError):
    """Safe configuration diagnostic containing no connection values."""


@dataclass(repr=False)
class DatabaseConfig:
    mode: str
    url: object = field(repr=False)
    connect_args: dict = field(default_factory=dict, repr=False)


def safe_error_summary(error):
    """Inspect wrapped exceptions; return only fixed labels and a numeric code."""
    pending = [error]
    chain = []
    seen = set()
    while pending:
        current = pending.pop()
        if id(current) in seen:
            continue
        seen.add(id(current))
        chain.append(current)
        for name in ("orig", "__cause__", "__context__", "original_exception"):
            nested = getattr(current, name, None)
            if isinstance(nested, BaseException):
                pending.append(nested)
        pending.extend(arg for arg in current.args if isinstance(arg, BaseException))

    code = next((item.args[0] for item in chain
                 if isinstance(item, MySQLError) and item.args
                 and type(item.args[0]) is int), None)
    if any(isinstance(item, ssl.SSLCertVerificationError) for item in chain):
        category = "TLS certificate or hostname verification failure"
    elif any(isinstance(item, socket.gaierror) for item in chain):
        category = "DNS resolution failure"
    elif any(isinstance(item, TimeoutError) or
             (isinstance(item, OSError) and item.errno in (errno.ETIMEDOUT, 10060))
             for item in chain):
        category = "Network timeout"
    elif any(isinstance(item, ConnectionRefusedError) for item in chain):
        category = "Network connection refused"
    elif any(isinstance(item, ssl.SSLError) for item in chain):
        category = "TLS handshake failure"
    else:
        category = {
            1045: "Authentication failure",
            1698: "Authentication failure",
            1044: "Insufficient database access permissions",
            1049: "Database not found",
            1142: "Insufficient SELECT permissions",
            1143: "Insufficient SELECT permissions",
            1146: "Required table not found",
            1054: "Schema mismatch: required column not found",
            2005: "DNS resolution failure",
            2002: "Network connection failure",
            2003: "Network connection failure",
            2006: "Connection lost or closed",
            2013: "Connection lost during query",
            2026: "TLS connection failure",
            1040: "Server connection limit reached",
            3159: "Server requires a secure connection",
        }.get(code, "Unclassified connection or query failure")
    suffix = f"; MySQL error code: {code}" if code is not None else ""
    return category + suffix


def load_cloud_config(backend_dir=None, environ=None):
    backend_dir = Path(backend_dir) if backend_dir is not None else BACKEND_DIR
    cloud_file = backend_dir / '.env.cloud'
    env = os.environ if environ is None else environ
    try:
        if cloud_file.is_file() and env.get('APP_ENV') != 'production':
            with cloud_file.open(encoding='utf-8-sig') as stream:
                bindings = list(parse_stream(stream))
        else:
            bindings = []
    except (OSError, UnicodeError):
        raise ConfigurationError('Cannot read backend/.env.cloud as UTF-8. Values hidden.') from None
    errors = [binding.original.line for binding in bindings if binding.error]
    if errors:
        raise ConfigurationError('Cannot parse backend/.env.cloud at line(s): ' + ', '.join(map(str, errors)) + '. Values hidden.') from None
    settings = {binding.key: binding.value for binding in bindings if binding.key is not None}
    settings.update({key: value for key, value in env.items() if key.startswith('AIVEN_')})
    required = ('AIVEN_HOST', 'AIVEN_PORT', 'AIVEN_DATABASE', 'AIVEN_USER', 'AIVEN_PASSWORD', 'AIVEN_CA_PATH')
    invalid = [key for key in required if not settings.get(key) or settings[key].startswith('CHANGE_ME')]
    if invalid:
        raise ConfigurationError('Populate these settings in backend/.env.cloud: ' + ', '.join(invalid)) from None
    try:
        port = int(settings['AIVEN_PORT'])
        if not 1 <= port <= 65535:
            raise ValueError
    except ValueError:
        raise ConfigurationError('AIVEN_PORT must be an integer between 1 and 65535.') from None
    ca_path = Path(settings['AIVEN_CA_PATH']).expanduser()
    if not ca_path.is_absolute():
        ca_path = backend_dir / ca_path
    try:
        tls = ssl.create_default_context(cafile=str(ca_path))
        tls.verify_mode = ssl.CERT_REQUIRED
        tls.check_hostname = True
        tls.minimum_version = ssl.TLSVersion.TLSv1_2
    except FileNotFoundError:
        raise ConfigurationError('CA file not found. Check AIVEN_CA_PATH in backend/.env.cloud; relative paths start at the backend directory.') from None
    except PermissionError:
        raise ConfigurationError('CA file cannot be read. Check certificate file permissions.') from None
    except ssl.SSLError:
        raise ConfigurationError('CA file could not be parsed as a trusted PEM certificate. Check that it contains the complete Aiven CA certificate.') from None
    except (OSError, ValueError):
        raise ConfigurationError('Cannot load the CA file. Check the path format in backend/.env.cloud. On Windows, prefer forward slashes or a single-quoted path.') from None
    url = URL.create(drivername='mysql+pymysql', username=settings['AIVEN_USER'], password=settings['AIVEN_PASSWORD'], host=settings['AIVEN_HOST'], port=port, database=settings['AIVEN_DATABASE'], query={'charset': 'utf8mb4'})
    return DatabaseConfig("cloud", url, {"ssl": tls, "connect_timeout": 10, "read_timeout": 15, "write_timeout": 15})


def load_database_config(environ=None, backend_dir=None):
    env = os.environ if environ is None else environ
    directory = Path(backend_dir) if backend_dir is not None else BACKEND_DIR
    # Mode is selected only by the process environment; cloud-file contents cannot select it.
    mode = env.get("DATABASE_MODE", "local")
    if mode not in ("local", "cloud"):
        raise ConfigurationError("DATABASE_MODE must be local or cloud")
    if mode == "cloud":
        return load_cloud_config(directory, environ=env)
    # Preserve existing local dotenv interpolation and process-variable precedence.
    values = dotenv_values(directory / ".env", encoding="utf-8-sig")
    url = env.get("DATABASE_URL", values.get("DATABASE_URL"))
    if not url:
        raise ConfigurationError("DATABASE_URL must be set in the environment or backend/.env")
    return DatabaseConfig("local", url)


def create_database_engine(config, *, poolclass=None):
    options = dict(connect_args=config.connect_args, pool_recycle=3600,
                   pool_pre_ping=True, echo=False, hide_parameters=True)
    if poolclass is not None:
        options["poolclass"] = poolclass
    try:
        return create_engine(config.url, **options)
    except Exception as error:
        raise ConfigurationError("Database engine configuration failed: "
                                 + safe_error_summary(error)) from None
