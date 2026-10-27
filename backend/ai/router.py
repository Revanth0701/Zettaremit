from fastapi.responses import StreamingResponse
import json
"""FastAPI Router for ZettaRemit AI Assistant (Phase 1, Step 5A).

Provides POST /ai/ask for grounded question answering against the local RAG knowledge base.
Includes question validation, session management, concurrency limiting, and clear error responses.
"""

import asyncio
from collections import defaultdict
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Ensure backend root is in sys.path for internal imports
_BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from auth import token_subject, unauthorized

from .rag_service import get_rag_service, RAGResponse

ai_router = APIRouter(prefix="/ai", tags=["AI Assistant"])

bearer_scheme = HTTPBearer(auto_error=False)

# Maximum 1 concurrent generation to protect local CPU / Ollama daemon from starvation
AI_SEMAPHORE = asyncio.Semaphore(1)

# Abuse protection: Maximum 15 requests per minute per client IP
RATE_LIMIT_WINDOW = 60.0
MAX_REQUESTS_PER_WINDOW = 15
_IP_REQUEST_TIMES: Dict[str, List[float]] = defaultdict(list)

# Per-User rate limiting and conservative usage budget
MAX_USER_REQUESTS_PER_MINUTE = 10
MAX_USER_DAILY_BUDGET = 50
_USER_MINUTE_REQUEST_TIMES: Dict[str, List[float]] = defaultdict(list)
_USER_DAILY_REQUEST_TIMES: Dict[str, List[float]] = defaultdict(list)


def check_ip_rate_limit(client_ip: str) -> bool:
    """Check if the client IP is within the rate limit window."""
    now = time.time()
    times = _IP_REQUEST_TIMES[client_ip]
    _IP_REQUEST_TIMES[client_ip] = [t for t in times if now - t < RATE_LIMIT_WINDOW]
    if len(_IP_REQUEST_TIMES[client_ip]) >= MAX_REQUESTS_PER_WINDOW:
        return False
    _IP_REQUEST_TIMES[client_ip].append(now)
    return True


def check_user_rate_limit(user_id: str) -> Tuple[bool, str]:
    """Enforce per-user minute rate limit and daily usage budget."""
    now = time.time()
    
    # Check 60-second window
    m_times = _USER_MINUTE_REQUEST_TIMES[user_id]
    _USER_MINUTE_REQUEST_TIMES[user_id] = [t for t in m_times if now - t < 60.0]
    if len(_USER_MINUTE_REQUEST_TIMES[user_id]) >= MAX_USER_REQUESTS_PER_MINUTE:
        return False, "Rate limit exceeded. Maximum 10 questions per minute per user. Please wait a moment."
        
    # Check 24-hour daily budget (86400s)
    d_times = _USER_DAILY_REQUEST_TIMES[user_id]
    _USER_DAILY_REQUEST_TIMES[user_id] = [t for t in d_times if now - t < 86400.0]
    if len(_USER_DAILY_REQUEST_TIMES[user_id]) >= MAX_USER_DAILY_BUDGET:
        return False, "Daily AI question budget reached (maximum 50 questions per day). Please try again tomorrow."
        
    _USER_MINUTE_REQUEST_TIMES[user_id].append(now)
    _USER_DAILY_REQUEST_TIMES[user_id].append(now)
    return True, ""


# Privacy Guardrail: Scrub credentials, JWT tokens, and sensitive financial/ID numbers
SENSITIVE_PATTERNS = [
    (re.compile(r'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}'), '[REDACTED_JWT_TOKEN]'),
    (re.compile(r'\b(?:\d{4}[ -]?){3}\d{4}\b'), '[REDACTED_CARD_NUMBER]'),
    (re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b'), '[REDACTED_AADHAAR_NUMBER]'),
    (re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b'), '[REDACTED_PAN_NUMBER]'),
    (re.compile(r'(?:password|pwd|secret)\s*[:=]\s*\S+', re.I), 'password: [REDACTED]'),
]


def scrub_sensitive_input(text: str) -> str:
    """Scrub sensitive credentials, tokens, and PII before forwarding to LLM inference."""
    sanitized = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


class AskRequest(BaseModel):
    """Schema for AI assistant query request."""
    model_config = ConfigDict(extra="forbid")
    question: str = Field(..., min_length=1, max_length=1000, description="User question about ZettaRemit")
    session_id: Optional[str] = Field(
        default=None,
        min_length=16,
        max_length=100,
        pattern=r"^[A-Za-z0-9_-]+$",
        description="Optional high-entropy session identifier for multi-turn conversation continuity (min 16 chars, e.g. UUIDv4)"
    )

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Question cannot be empty or whitespace only")
        return cleaned


class AskResponse(BaseModel):
    """Schema for AI assistant query response."""
    question: str
    answer: str
    sources: List[str]
    session_id: Optional[str] = None
    latency_seconds: float
    provider: Optional[str] = None
    model: Optional[str] = None


@ai_router.post("/ask", response_model=AskResponse)
async def ask_assistant_endpoint(
    payload: AskRequest,
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
):
    """Submit a question to the ZettaRemit RAG assistant.
    
    Requires Bearer token authentication. Strictly read-only and simulation-only.
    Does not move funds, modify accounts, or interact with production systems.
    """
    # 1. Enforce authentication
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    user_id = token_subject(credentials.credentials)

    # 2. Enforce IP-based rate limiting (outer defense)
    client_ip = request.client.host if request.client else "unknown"
    if not check_ip_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 15 questions per minute. Please retry shortly.",
            headers={"Retry-After": "60"}
        )

    # 3. Enforce Per-User rate limiting and conservative daily budget
    allowed, rate_error = check_user_rate_limit(user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_error,
            headers={"Retry-After": "60"}
        )

    # 4. Privacy Guardrail: Scrub credentials, JWT tokens, and PII before inference
    sanitized_question = scrub_sensitive_input(payload.question)

    # 5. Bind conversation session strictly to authenticated user_id
    scoped_session_id = f"{user_id}::{payload.session_id}" if payload.session_id else f"{user_id}::default"

    acquired = False
    try:
        # 6. Concurrency guard: wait up to 3.0s for the AI lock
        try:
            await asyncio.wait_for(AI_SEMAPHORE.acquire(), timeout=3.0)
            acquired = True
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI assistant is currently busy processing another request. Please retry shortly.",
                headers={"Retry-After": "5"}
            )

        # 7. Execute RAG pipeline in thread pool to avoid blocking the ASGI event loop
        service = get_rag_service()
        rag_response: RAGResponse = await asyncio.to_thread(
            service.answer,
            question=sanitized_question,
            session_id=scoped_session_id
        )

        # 8. Check for service or retrieval errors
        if rag_response.error:
            err_msg = rag_response.error
            if "401" in err_msg or "Unauthorized" in err_msg or "API key" in err_msg:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Ollama Cloud authentication failed. Check OLLAMA_API_KEY."
                )
            elif "402" in err_msg or "403" in err_msg or "credits" in err_msg.lower() or "subscription" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Ollama Cloud credits exhausted or model requires a paid plan."
                )
            elif "404" in err_msg or "not found" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Requested model '{rag_response.model}' was not found on {rag_response.provider}."
                )
            elif "429" in err_msg or "rate limit" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Ollama rate limit exceeded. Please wait a moment and retry."
                )
            elif "Cannot connect" in err_msg or "ConnectionError" in err_msg or "unreachable" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"AI assistant service is currently unavailable on {rag_response.provider}."
                )
            elif "timed out" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="AI assistant request timed out while generating response."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"AI assistant error: {err_msg}"
                )

        return AskResponse(
            question=rag_response.question,
            answer=rag_response.answer,
            sources=rag_response.sources,
            session_id=payload.session_id,
            latency_seconds=rag_response.latency_seconds,
            provider=rag_response.provider,
            model=rag_response.model
        )

    finally:
        if acquired:
            AI_SEMAPHORE.release()



@ai_router.post("/ask-stream")
async def ask_assistant_stream_endpoint(
    payload: AskRequest,
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
):
    """Stream AI assistant response using Server-Sent Events (SSE).
    
    Enforces Bearer authentication, per-IP rate limiting, per-user rate limiting,
    PII sanitization, scoped session isolation, and concurrency semaphore.
    """
    # 1. Enforce authentication
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    user_id = token_subject(credentials.credentials)

    # 2. Enforce IP-based rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_ip_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 15 questions per minute. Please retry shortly.",
            headers={"Retry-After": "60"}
        )

    # 3. Enforce Per-User rate limiting and conservative daily budget
    allowed, rate_error = check_user_rate_limit(user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_error,
            headers={"Retry-After": "60"}
        )

    # 4. Privacy Guardrail: Scrub credentials, JWT tokens, and PII
    sanitized_question = scrub_sensitive_input(payload.question)

    # 5. Bind session strictly to authenticated user_id
    scoped_session_id = f"{user_id}::{payload.session_id}" if payload.session_id else f"{user_id}::default"

    # 6. Concurrency guard: wait up to 3.0s for the AI lock
    try:
        await asyncio.wait_for(AI_SEMAPHORE.acquire(), timeout=3.0)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI assistant is currently busy processing another request. Please retry shortly.",
            headers={"Retry-After": "5"}
        )

    service = get_rag_service()

    async def event_generator():
        try:
            loop = asyncio.get_running_loop()
            queue = asyncio.Queue(maxsize=100)
            sentinel = object()

            def sync_worker():
                try:
                    for event in service.answer_stream(sanitized_question, session_id=scoped_session_id):
                        asyncio.run_coroutine_threadsafe(queue.put(event), loop).result()
                except Exception as ex:
                    asyncio.run_coroutine_threadsafe(queue.put({"type": "error", "error": str(ex)}), loop).result()
                finally:
                    asyncio.run_coroutine_threadsafe(queue.put(sentinel), loop).result()

            loop.run_in_executor(None, sync_worker)

            while True:
                item = await queue.get()
                if item is sentinel:
                    break
                yield f"data: {json.dumps(item)}\n\n"
        finally:
            AI_SEMAPHORE.release()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@ai_router.get("/health")
async def ai_health():
    """Lightweight health check for AI service.
    
    Safe for unauthenticated polling: never leaks server paths, IPs, or secrets.
    """
    try:
        service = get_rag_service()
        health_info = service.ollama.check_health()
        return {
            "status": "ok" if health_info.get("model_ready", False) else "degraded",
            "provider": service.ollama.provider,
            "model": service.ollama.model,
            "model_ready": bool(health_info.get("model_ready", False)),
            "enabled": True
        }
    except Exception:
        return {
            "status": "degraded",
            "provider": "unknown",
            "model": "unknown",
            "model_ready": False,
            "enabled": True
        }
