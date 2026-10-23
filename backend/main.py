import uuid
import datetime
import urllib.request
import json
from typing import Generator, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, String, Numeric, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.mysql import VARCHAR as MySQLVarchar
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from database_config import load_database_config, create_database_engine, safe_error_summary
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.exceptions import RequestValidationError
from auth import issue_access_token, token_subject, unauthorized, ACCESS_TOKEN_SECONDS
from money import TransferRequest, fingerprint, RATE
from internal_service import calculate_transfer, ServiceUnavailable
from settings import setting, production
from rate_limit import limiter
from api_responses import (HealthResponse, RegistrationResponse, LoginResponse,
                           TransactionResponse, TransactionCreatedResponse)

# ==========================================
# 1. PYDANTIC SCHEMAS (Data Validation)
# ==========================================
class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=150)
    password: str = Field(min_length=12)

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value):
        value = value.strip()
        if not value or any(ord(c) < 32 for c in value):
            raise ValueError("Invalid name")
        return value

    @field_validator("password")
    @classmethod
    def password_length(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password exceeds bcrypt byte limit")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.lower()
    phone_number: Optional[str] = Field(default=None, max_length=20)
    document_type: Optional[str] = Field(default=None, max_length=50)
    document_number: Optional[str] = Field(default=None, max_length=100)

class UserLogin(BaseModel):
    email: EmailStr = Field(max_length=150)
    password: str = Field(max_length=1024)

TransactionCreate = TransferRequest

# ==========================================
# 2. DATABASE CONNECTION
# ==========================================
database_config = load_database_config()
engine = create_database_engine(database_config)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 3. DATABASE MODELS (MySQL Tables)
# ==========================================
class User(Base):
    __tablename__ = "users"
    user_id = Column(String(50), primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    phone_number = Column(String(20), unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

class UserVerification(Base):
    __tablename__ = "user_verifications"
    verification_id = Column(String(50), primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(50), default="NONE")
    document_number = Column(String(100)) # Stores the PAN, Aadhar, or Passport number
    document_status = Column(String(50), default="UNVERIFIED")
    otp_code = Column(String(10))
    is_phone_verified = Column(Boolean, default=False)

class TransactionRecord(Base):
    __tablename__ = "transactions"
    transaction_id = Column(String(255), primary_key=True, index=True)
    sender_id = Column(String(50), ForeignKey("users.user_id"), nullable=False)
    recipient_name = Column(String(255), nullable=False)
    gross_amount = Column(Numeric(18, 2), nullable=False)
    fee_deducted = Column(Numeric(18, 2), nullable=False)
    net_amount = Column(Numeric(18, 2), nullable=False)
    exchange_rate = Column(Numeric(18, 8), nullable=False)
    recipient_amount = Column(Numeric(18, 2), nullable=False)
    source_currency = Column(String(3), nullable=False)
    target_currency = Column(String(3), nullable=False)
    idempotency_key = Column(String(128).with_variant(MySQLVarchar(128, charset="ascii", collation="ascii_bin"), "mysql"), nullable=True)
    request_hash = Column(String(64), nullable=True)
    __table_args__ = (UniqueConstraint("sender_id", "idempotency_key", name="uq_transactions_owner_key"),)
    status = Column(String(255), default="Processing")
    created_at = Column(DateTime, default=datetime.datetime.now, index=True)

bearer = HTTPBearer(auto_error=False)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
                     db: Session = Depends(get_db)):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    subject = token_subject(credentials.credentials)
    user = db.query(User).filter(User.user_id == subject).first()
    if user is None or not user.is_active:
        raise unauthorized()
    return user


def check_requested_sender(sender_id, user):
    # Retain the old optional parameter only as a consistency check, never identity.
    if sender_id is not None and sender_id != user.user_id:
        raise HTTPException(status_code=403, detail="Transaction ownership mismatch")


# Preserve local bootstrap behavior. Never create or change cloud tables.
if database_config.mode == "local" and not production() and setting("LOCAL_CREATE_TABLES", "false") == "true":
    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError as error:
        raise RuntimeError("Local database initialization failed: "
                           + safe_error_summary(error)) from None

# ==========================================
# 4. FASTAPI SETUP & UTILITIES
# ==========================================
if production():
    from auth import signing_key
    signing_key()
    if database_config.mode != "cloud":
        raise RuntimeError("Production requires explicit cloud database mode")
    if setting("SCHEMA_REVISION") != "20261023_01":
        raise RuntimeError("Reviewed schema migration must be acknowledged before production startup")
    if setting("JWT_SECRET_KEY", "") == setting("INTERNAL_SERVICE_TOKEN", "different"):
        raise RuntimeError("JWT and internal service signing credentials must differ")
    if len(setting("INTERNAL_SERVICE_TOKEN", "").encode()) < 32:
        raise RuntimeError("Internal service authentication is not configured")

app = FastAPI(title="ZettaRemit Simulation API", docs_url=None if production() else "/docs", redoc_url=None if production() else "/redoc")

@app.middleware("http")
async def secure_response_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    if production():
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request, error):
    # Default validation responses can echo request inputs, including passwords.
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": list(item["loc"]), "type": item["type"]}
        for item in error.errors()
    ]})


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request, error):
    # Handled here so ASGI does not log raw driver messages or credentials.
    return JSONResponse(status_code=500, content={"detail": safe_error_summary(error)})


origins = [value.strip() for value in setting("CORS_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081").split(",") if value.strip()]
if "*" in origins or (production() and (not origins or any(not origin.startswith("https://") for origin in origins))):
    raise RuntimeError("Configure explicit frontend CORS origins; production requires HTTPS")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type", "Idempotency-Key"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DUMMY_HASH = pwd_context.hash("synthetic-timing-equalizer")

@app.get("/health")
def health():
    return {"status": "ok", "simulation": True}

@app.get("/simulation/config")
def simulation_config():
    return {"source_currency": "INR", "target_currency": "USD", "inr_per_usd": str(RATE), "fee_percent": "3", "simulation": True}

# ==========================================
# 5. API ROUTES
# ==========================================
@app.get("/", response_model=HealthResponse)
def health_check():
    return {"status": "success", "message": "ZettaRemit simulation API"}

# --- REGISTER ---
@app.post("/users/register", status_code=status.HTTP_201_CREATED, response_model=RegistrationResponse)
def register_user(user: UserCreate, request: Request, db: Session = Depends(get_db)):
    limiter.check(("register", request.client.host if request.client else "unknown"), limit=5)
    hashed_password = pwd_context.hash(user.password)
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        return {"message": "If the supplied details are eligible, a demo account is available. Please sign in."}
    new_user_id = "USR-" + uuid.uuid4().hex.upper()

    # 1. Save the basic user
    new_user = User(
        user_id=new_user_id,
        full_name=user.full_name,
        email=user.email,
        password_hash=hashed_password,
        phone_number=user.phone_number
    )
    db.add(new_user)

    # 2. Save the KYC verification record linked to this user
    new_verification = UserVerification(
        verification_id="KYC-" + uuid.uuid4().hex.upper(),
        user_id=new_user_id,
        document_type=user.document_type or "NONE",
        document_number=user.document_number,
        document_status="PENDING"
    )
    db.add(new_verification)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"message": "If the supplied details are eligible, a demo account is available. Please sign in."}
    db.refresh(new_user)
    return {"message": "If the supplied details are eligible, a demo account is available. Please sign in."}

# --- LOGIN ---
@app.post("/users/login", response_model=LoginResponse)
def login_user(user_credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    limiter.check(("login", request.client.host if request.client else "unknown"))
    import hashlib
    limiter.check(("account", hashlib.sha256(user_credentials.email.lower().encode()).digest()))
    user = db.query(User).filter(User.email == user_credentials.email.lower()).first()
    password_ok = False
    try:
        password_ok = pwd_context.verify(user_credentials.password, user.password_hash if user else DUMMY_HASH)
    except (ValueError, TypeError):
        pass
    if not user or not user.is_active or not password_ok or len(user_credentials.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=401, detail="Invalid email or password", headers={"WWW-Authenticate": "Bearer"})

    return {"message": "Login successful", "user_id": user.user_id, "full_name": user.full_name,
            "access_token": issue_access_token(user.user_id), "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_SECONDS}

# --- CREATE TRANSACTION ---
@app.post("/transactions/create", status_code=status.HTTP_201_CREATED, response_model=TransactionCreatedResponse)
def create_transaction(txn: TransactionCreate, sender_id: Optional[str] = None,
                       idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=16, max_length=128, pattern=r"^[A-Za-z0-9_-]+$"),
                       current_user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    check_requested_sender(sender_id, current_user)
    request_hash = fingerprint(txn)

    def prior():
        record = db.query(TransactionRecord).filter(TransactionRecord.sender_id == current_user.user_id).filter(TransactionRecord.idempotency_key == idempotency_key).first()
        if record and record.request_hash != request_hash:
            raise HTTPException(status_code=409, detail="Idempotency key was already used for a different request")
        return record

    existing = prior()
    if existing:
        return {"message": "Simulated transfer already recorded", "transaction": existing}
    try:
        quote = calculate_transfer(current_user.user_id, txn, idempotency_key)
    except ServiceUnavailable:
        raise HTTPException(status_code=503, detail="Simulation service unavailable; retry with the same idempotency key") from None
    record = TransactionRecord(transaction_id="TXN-" + uuid.uuid4().hex.upper(), sender_id=current_user.user_id,
        recipient_name=txn.recipient_name, gross_amount=txn.gross_amount,
        fee_deducted=quote["feeDeducted"], net_amount=quote["netAmount"], exchange_rate=quote["exchangeRate"],
        recipient_amount=quote["recipientAmount"], source_currency="INR", target_currency="USD",
        status="SIMULATED", idempotency_key=idempotency_key, request_hash=request_hash)
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = prior()
        if existing:
            return {"message": "Simulated transfer already recorded", "transaction": existing}
        raise HTTPException(status_code=409, detail="Unable to record simulated transfer") from None
    db.refresh(record)
    return {"message": "Simulated transfer recorded; no funds moved", "transaction": record}

# --- GET TRANSACTION HISTORY ---
@app.get("/transactions/", response_model=list[TransactionResponse])
def get_transactions(sender_id: Optional[str] = None,
                     current_user: User = Depends(get_current_user),
                     db: Session = Depends(get_db), limit: int = 50):
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=422, detail="Limit must be between 1 and 100")
    check_requested_sender(sender_id, current_user)
    sender_id = current_user.user_id
    transactions = db.query(TransactionRecord)\
                     .filter(TransactionRecord.sender_id == sender_id)\
                     .order_by(TransactionRecord.created_at.desc())\
                     .limit(limit).all()
    return transactions
