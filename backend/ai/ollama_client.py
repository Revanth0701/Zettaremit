"""Ollama HTTP Client for ZettaRemit AI Assistant (Phase 2, Step 6A).

Supports both local Ollama and Ollama Cloud inference with configurable
providers, API key management, model validation, and structured error handling.
"""

import os
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
import json
import httpx

try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.exists():
        load_dotenv(dotenv_path=_env_path, override=False)
except ImportError:
    pass

# Local Ollama Defaults
DEFAULT_LOCAL_URL = "http://127.0.0.1:11434"
DEFAULT_LOCAL_MODEL = "llama3.2:3b"

# Ollama Cloud Defaults
DEFAULT_CLOUD_URL = "https://ollama.com"
DEFAULT_CLOUD_MODEL = "gemma4:31b"

DEFAULT_TIMEOUT_SECONDS = 120.0


class OllamaError(Exception):
    """Base exception for all Ollama client errors."""
    pass


class OllamaConnectionError(OllamaError):
    """Raised when the Ollama service is unreachable (network or offline service)."""
    pass


class OllamaTimeoutError(OllamaError):
    """Raised when an Ollama inference request times out."""
    pass


class OllamaAPIError(OllamaError):
    """Base exception for HTTP errors returned by the Ollama API."""
    pass


class OllamaAuthenticationError(OllamaAPIError):
    """Raised when an Ollama Cloud request is missing an API key or rejected (HTTP 401)."""
    pass


class OllamaPaymentRequiredError(OllamaAPIError):
    """Raised when Ollama Cloud credits are exhausted or a paid subscription is required (HTTP 402/403)."""
    pass


class OllamaModelNotFoundError(OllamaAPIError):
    """Raised when the requested model is not found on the active provider (HTTP 404)."""
    pass


class OllamaRateLimitError(OllamaAPIError):
    """Raised when Ollama Cloud rate limits are exceeded (HTTP 429)."""
    pass


class OllamaClient:
    """HTTP client for local Ollama and Ollama Cloud inference."""

    def __init__(
        self,
        provider: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        fallback_to_local: Optional[bool] = None
    ):
        raw_provider = (provider or os.environ.get("AI_PROVIDER", "local")).strip().lower()
        if raw_provider in ("ollama_cloud", "cloud"):
            self.provider = "ollama_cloud"
        else:
            self.provider = "local"

        self.timeout = timeout

        if self.provider == "ollama_cloud":
            self.base_url = (base_url or os.environ.get("OLLAMA_CLOUD_BASE_URL", DEFAULT_CLOUD_URL)).rstrip("/")
            # Prefer OLLAMA_CLOUD_MODEL env var, otherwise default to gemma4:31b
            self.model = (
                model
                or os.environ.get("OLLAMA_CLOUD_MODEL")
                or DEFAULT_CLOUD_MODEL
            )
            # Store API key in memory only; never print or expose
            self._api_key = api_key or os.environ.get("OLLAMA_API_KEY", "")
        else:
            self.base_url = (base_url or os.environ.get("OLLAMA_BASE_URL", DEFAULT_LOCAL_URL)).rstrip("/")
            self.model = model or os.environ.get("OLLAMA_MODEL", DEFAULT_LOCAL_MODEL)
            self._api_key = None

        if fallback_to_local is not None:
            self.fallback_to_local = fallback_to_local
        else:
            self.fallback_to_local = (
                os.environ.get("OLLAMA_CLOUD_FALLBACK_TO_LOCAL", "false").lower() == "true"
            )

    @property
    def has_api_key(self) -> bool:
        """Check if an API key is configured without exposing the secret value."""
        return bool(self._api_key and self._api_key.strip())

    def _get_headers(self) -> Dict[str, str]:
        """Construct request headers, injecting Bearer token for cloud mode."""
        headers = {"Content-Type": "application/json"}
        if self.provider == "ollama_cloud":
            if not self.has_api_key:
                raise OllamaAuthenticationError(
                    "Ollama Cloud API key is missing. Set the OLLAMA_API_KEY environment variable."
                )
            headers["Authorization"] = f"Bearer {self._api_key.strip()}"
        return headers

    def _handle_http_error(self, e: httpx.HTTPStatusError) -> None:
        """Map HTTP error status codes to specific, actionable exceptions."""
        status_code = e.response.status_code
        err_msg = ""
        try:
            body = e.response.json()
            if isinstance(body, dict):
                err_msg = body.get("error") or body.get("message") or ""
        except Exception:
            err_msg = e.response.text[:200]

        if not err_msg:
            err_msg = e.response.text[:200]

        if status_code == 401:
            raise OllamaAuthenticationError(
                "Ollama Cloud API key is invalid or rejected (HTTP 401 Unauthorized)."
            ) from None
        elif status_code in (402, 403):
            raise OllamaPaymentRequiredError(
                f"Ollama Cloud account restriction (HTTP {status_code}): {err_msg or 'Credits exhausted or model requires subscription.'}"
            ) from None
        elif status_code == 404:
            raise OllamaModelNotFoundError(
                f"Model '{self.model}' was not found on {self.provider} (HTTP 404)."
            ) from None
        elif status_code == 429:
            raise OllamaRateLimitError(
                f"Ollama Cloud rate limit exceeded (HTTP 429): {err_msg or 'Please wait before retrying.'}"
            ) from None
        else:
            raise OllamaAPIError(
                f"Ollama {self.provider} returned HTTP {status_code}: {err_msg or e.response.text[:200]}"
            ) from None

    def check_health(self) -> dict:
        """Verify model provider status and target model availability."""
        url = f"{self.base_url}/api/tags"

        # Cloud without key: report degraded state immediately without network error
        if self.provider == "ollama_cloud" and not self.has_api_key:
            return {
                "status": "degraded",
                "provider": "ollama_cloud",
                "target_model": self.model,
                "model_ready": False,
                "error": "OLLAMA_API_KEY environment variable is not configured."
            }

        headers = {}
        if self.provider == "ollama_cloud" and self.has_api_key:
            headers["Authorization"] = f"Bearer {self._api_key.strip()}"

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 401:
                    raise OllamaAuthenticationError(
                        "Ollama Cloud API key is invalid (HTTP 401 Unauthorized)."
                    )
                resp.raise_for_status()
                data = resp.json()
                models = [m.get("name") for m in data.get("models", [])]
                model_found = any(self.model in m for m in models)
                return {
                    "status": "ok",
                    "provider": self.provider,
                    "available_models": models,
                    "target_model": self.model,
                    "model_ready": model_found
                }
        except httpx.ConnectError:
            raise OllamaConnectionError(
                f"Cannot connect to Ollama at {self.base_url}. Ensure the service is active."
            ) from None
        except httpx.TimeoutException:
            raise OllamaTimeoutError(
                f"Health check to {self.base_url} timed out."
            ) from None
        except httpx.HTTPStatusError as e:
            self._handle_http_error(e)

    def chat(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        history: Optional[list] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = 512
    ) -> str:
        """Send chat completion request to active provider."""
        url = f"{self.base_url}/api/chat"

        try:
            headers = self._get_headers()
        except OllamaAuthenticationError:
            if self.fallback_to_local:
                return self._fallback_chat(user_message, system_prompt, history, temperature, max_tokens)
            raise

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            for item in history:
                if isinstance(item, dict) and "role" in item and "content" in item:
                    messages.append({"role": item["role"], "content": item["content"]})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                message = data.get("message", {})
                content = message.get("content", "").strip()
                if not content:
                    raise OllamaAPIError("Ollama returned an empty response.")
                return content
        except (OllamaError, httpx.HTTPError) as err:
            if self.fallback_to_local and self.provider == "ollama_cloud":
                return self._fallback_chat(user_message, system_prompt, history, temperature, max_tokens)
            if isinstance(err, httpx.ConnectError):
                raise OllamaConnectionError(
                    f"Cannot connect to {self.provider} at {self.base_url}."
                ) from None
            if isinstance(err, httpx.TimeoutException):
                raise OllamaTimeoutError(
                    f"Inference request to {self.provider} timed out after {self.timeout} seconds."
                ) from None
            if isinstance(err, httpx.HTTPStatusError):
                self._handle_http_error(err)
            raise

    def _fallback_chat(
        self,
        user_message: str,
        system_prompt: Optional[str],
        history: Optional[list],
        temperature: float,
        max_tokens: Optional[int]
    ) -> str:
        """Explicitly configured fallback to local Ollama runner."""
        local_client = OllamaClient(
            provider="local",
            timeout=self.timeout,
            fallback_to_local=False
        )
        return local_client.chat(
            user_message=user_message,
            system_prompt=system_prompt,
            history=history,
            temperature=temperature,
            max_tokens=max_tokens
        )

    def chat_stream(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        history: Optional[list] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = 512
    ) -> Generator[str, None, None]:
        """Stream chat completion tokens from active provider."""
        url = f"{self.base_url}/api/chat"

        try:
            headers = self._get_headers()
        except OllamaAuthenticationError:
            if self.fallback_to_local:
                yield from self._fallback_chat_stream(user_message, system_prompt, history, temperature, max_tokens)
                return
            raise

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            for item in history:
                if isinstance(item, dict) and "role" in item and "content" in item:
                    messages.append({"role": item["role"], "content": item["content"]})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature
            }
        }
        if max_tokens:
            payload["options"]["num_predict"] = max_tokens

        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream("POST", url, json=payload, headers=headers) as resp:
                    if resp.status_code != 200:
                        resp.read()
                        self._handle_http_error(httpx.HTTPStatusError("Stream error", request=resp.request, response=resp))
                    for line in resp.iter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except Exception:
                            continue
                        msg = data.get("message", {})
                        content = msg.get("content", "")
                        if content:
                            yield content
                        if data.get("done", False):
                            break
        except (OllamaError, httpx.HTTPError) as err:
            if self.fallback_to_local and self.provider == "ollama_cloud":
                yield from self._fallback_chat_stream(user_message, system_prompt, history, temperature, max_tokens)
                return
            if isinstance(err, httpx.ConnectError):
                raise OllamaConnectionError(
                    f"Cannot connect to {self.provider} at {self.base_url}."
                ) from None
            if isinstance(err, httpx.TimeoutException):
                raise OllamaTimeoutError(
                    f"Inference request to {self.provider} timed out after {self.timeout} seconds."
                ) from None
            if isinstance(err, httpx.HTTPStatusError):
                self._handle_http_error(err)
            raise

    def _fallback_chat_stream(
        self,
        user_message: str,
        system_prompt: Optional[str],
        history: Optional[list],
        temperature: float,
        max_tokens: Optional[int]
    ) -> Generator[str, None, None]:
        """Explicitly configured fallback to local Ollama runner stream."""
        local_client = OllamaClient(
            provider="local",
            timeout=self.timeout,
            fallback_to_local=False
        )
        yield from local_client.chat_stream(
            user_message=user_message,
            system_prompt=system_prompt,
            history=history,
            temperature=temperature,
            max_tokens=max_tokens
        )

    def __repr__(self) -> str:
        # Crucial security rule: NEVER print _api_key
        has_key_str = "set" if self.has_api_key else "none"
        return f"<OllamaClient provider={self.provider} model={self.model} base_url={self.base_url} api_key={has_key_str}>"
