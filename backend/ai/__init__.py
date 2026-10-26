"""ZettaRemit AI Package (Phase 1 RAG Foundation)."""

from .ollama_client import OllamaClient, OllamaError, OllamaConnectionError
from .rag_service import RAGService, RAGResponse, get_rag_service, ask_assistant
from .index_knowledge import query_knowledge_base, index_knowledge_base

__all__ = [
    "OllamaClient",
    "OllamaError",
    "OllamaConnectionError",
    "RAGService",
    "RAGResponse",
    "get_rag_service",
    "ask_assistant",
    "query_knowledge_base",
    "index_knowledge_base",
]
