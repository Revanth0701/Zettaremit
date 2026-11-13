"""Gemini and BM25 support for the ZettaRemit assistant."""

from .gemini_client import GeminiClient, GeminiError
from .markdown_utils import DocumentChunk, load_markdown_files, split_markdown_into_chunks
from .rag_service import (
    RAGService, RAGResponse, get_rag_service, query_knowledge_base,
    ask_assistant, ask_assistant_stream,
)

__all__ = [
    "GeminiClient", "GeminiError", "DocumentChunk", "load_markdown_files",
    "split_markdown_into_chunks", "RAGService", "RAGResponse", "get_rag_service",
    "query_knowledge_base", "ask_assistant", "ask_assistant_stream",
]
