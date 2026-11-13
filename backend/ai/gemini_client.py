
"""Google Gemini client implementing the chat interface used by RAGService."""

import os
from pathlib import Path
from typing import Dict, Generator, List, Optional

import httpx
from google import genai
from google.genai import errors, types


_BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
try:
    from dotenv import load_dotenv

    _ENV_PATH = _BACKEND_DIR / ".env"
    if _ENV_PATH.exists():
        load_dotenv(dotenv_path=_ENV_PATH, override=False)
except ImportError:
    pass


class GeminiError(Exception):
    """Base exception for safe, user-facing Gemini failures."""


class GeminiAuthenticationError(GeminiError):
    """Gemini rejected credentials or the key is not configured."""


class GeminiQuotaError(GeminiError):
    """Gemini quota or request rate limit was exceeded."""


class GeminiModelUnavailableError(GeminiError):
    """The configured Gemini model is unavailable."""


class GeminiTimeoutError(GeminiError):
    """A Gemini request timed out."""


class GeminiServiceError(GeminiError):
    """Gemini is temporarily unavailable or returned an unexpected error."""


class GeminiClient:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self._api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.client: Optional[genai.Client] = None
        self.provider = "gemini"
        self.model = model or os.getenv("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL

    def _get_client(self) -> genai.Client:
        if not self._api_key:
            raise GeminiAuthenticationError(
                "Gemini API key is not configured. Set GEMINI_API_KEY."
            )
        if self.client is None:
            try:
                self.client = genai.Client(api_key=self._api_key)
            except Exception:
                raise GeminiServiceError(
                    "Gemini service is temporarily unavailable. Please retry shortly."
                ) from None
        return self.client

    @staticmethod
    def _api_error_status(error: errors.APIError) -> Optional[int]:
        status = getattr(error, "code", None)
        if not isinstance(status, int):
            status = getattr(error, "status_code", None)
        return status if isinstance(status, int) else None

    def _raise_safe_error(self, error: Exception) -> None:
        if isinstance(error, GeminiError):
            raise error

        if isinstance(error, errors.APIError):
            status = self._api_error_status(error)
            reason = " ".join(
                str(value or "")
                for value in (getattr(error, "status", None), getattr(error, "message", None))
            ).lower()
            if status == 429 or "quota" in reason or "rate limit" in reason:
                raise GeminiQuotaError(
                    "Gemini quota or rate limit exceeded. Please retry later."
                ) from None
            if status in (401, 403) or (
                status == 400
                and "api key" in reason
                and ("invalid" in reason or "not valid" in reason)
            ):
                raise GeminiAuthenticationError(
                    "Gemini authentication failed. Verify GEMINI_API_KEY configuration."
                ) from None
            if status == 404:
                raise GeminiModelUnavailableError(
                    f"Configured Gemini model '{self.model}' is unavailable."
                ) from None
            if status in (408, 500, 502, 503, 504):
                raise GeminiServiceError(
                    "Gemini service is temporarily unavailable. Please retry shortly."
                ) from None
            raise GeminiServiceError(
                "Gemini could not complete the request. Please retry shortly."
            ) from None

        if isinstance(error, (httpx.TimeoutException, TimeoutError)):
            raise GeminiTimeoutError(
                "Gemini request timed out. Please retry."
            ) from None
        if isinstance(error, (httpx.TransportError, ConnectionError)):
            raise GeminiServiceError(
                "Gemini service is temporarily unavailable. Please retry shortly."
            ) from None
        raise GeminiServiceError(
            "Gemini request failed. Please retry shortly."
        ) from None

    def _build_contents(
        self, user_message: str, history: Optional[List[Dict[str, str]]] = None
    ) -> List[types.Content]:
        contents = []

        for turn in history or []:
            role = turn.get("role", "user")
            if role == "assistant":
                role = "model"

            if role in ("user", "model"):
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(
                            text=str(turn.get("content", ""))
                        )]
                    )
                )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)]
            )
        )

        return contents

    def chat(
        self,
        user_message: str,
        system_prompt: str = "",
        history: Optional[list] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = 256,
    ) -> str:
        try:
            client = self._get_client()
            response = client.models.generate_content(
                model=self.model,
                contents=self._build_contents(user_message, history),
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt or None,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                ),
            )
        except Exception as error:
            self._raise_safe_error(error)

        return response.text or ""

    def chat_stream(
        self,
        user_message: str,
        system_prompt: str = "",
        history: Optional[list] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = 256,
    ) -> Generator[str, None, None]:
        try:
            client = self._get_client()
            stream = client.models.generate_content_stream(
                model=self.model,
                contents=self._build_contents(user_message, history),
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt or None,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                ),
            )

            for chunk in stream:
                if chunk.text:
                    yield chunk.text
        except Exception as error:
            self._raise_safe_error(error)

    def check_health(self) -> Dict[str, object]:
        """Report local configuration without making a billable API request."""
        configured = bool(self._api_key)
        return {
            "status": "ok" if configured else "degraded",
            "provider": self.provider,
            "target_model": self.model,
            "model_ready": configured,
            "configured": configured,
            **({"error": "GEMINI_API_KEY environment variable is not configured."} if not configured else {}),
        }
