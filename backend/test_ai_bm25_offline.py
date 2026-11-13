"""Regression coverage for shared Markdown parsing and Gemini/BM25 orchestration."""

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import MagicMock, patch

from backend.ai.gemini_client import GeminiClient
from backend.ai.markdown_utils import load_markdown_files, split_markdown_into_chunks
from backend.ai.rag_service import RAGService, SessionManager, get_rag_service, query_knowledge_base


class TestMarkdownAndBM25(unittest.TestCase):
    def test_chunking_preserves_sections_unicode_and_stable_ids(self):
        chunks = split_markdown_into_chunks(
            "fees.md", "# Fees\nOverview\n## Transfer\n3% fee\n### Example\n₹300\n## Limits\nINR only\n"
        )
        self.assertEqual([c.chunk_id for c in chunks], [f"fees_{i:03d}" for i in range(4)])
        self.assertEqual([c.section_title for c in chunks], [
            "Fees", "Fees > Transfer", "Fees > Transfer > Example", "Fees > Limits"
        ])
        self.assertEqual(chunks[2].text, "## Fees > Transfer > Example\n₹300")
        self.assertTrue(all(c.source_file == "fees.md" for c in chunks))

    def test_markdown_loading_is_sorted_and_ignores_other_files(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "b.md").write_text("₹300", encoding="utf-8")
            (root / "a.md").write_text("first", encoding="utf-8")
            (root / "ignored.txt").write_text("not knowledge", encoding="utf-8")
            self.assertEqual(load_markdown_files(root), [("a.md", "first"), ("b.md", "₹300")])

    def test_bm25_indexes_all_knowledge_documents_and_retrieves_fee_policy(self):
        from backend.ai.lightweight_retriever import get_lightweight_retriever
        retriever = get_lightweight_retriever()
        results = query_knowledge_base("What is the transfer fee?", top_k=3)
        self.assertTrue(results)
        self.assertTrue(any(r["source"] == "fees_and_rates.md" for r in results))
        # All documents remain available to the in-memory index after removing Chroma.
        documents = load_markdown_files(Path(__file__).parent / "ai" / "knowledge_base")
        self.assertEqual(len(documents), 8)
        self.assertEqual({c["source"] for c in retriever.chunks}, {name for name, _ in documents})

    def test_missing_knowledge_directory_reports_error(self):
        with TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                load_markdown_files(Path(directory) / "missing")


class TestGeminiConversation(unittest.TestCase):
    def test_sync_and_stream_share_followup_context_and_history(self):
        client = MagicMock(spec=GeminiClient)
        client.provider = "gemini"
        client.model = "test-model"
        client.chat.return_value = "ZettaRemit simulates transfers."
        client.chat_stream.return_value = iter(["It uses ", "INR to USD."])
        service = RAGService(gemini_client=client, session_manager=SessionManager())
        with patch("backend.ai.rag_service.query_knowledge_base", return_value=[{
            "source": "about_zettaremit.md", "text": "Verified simulation context"
        }]) as retrieve:
            service.answer("What is ZettaRemit?", session_id="conversation")
            events = list(service.answer_stream("How does it work?", session_id="conversation"))
        self.assertEqual(retrieve.call_args.args[0], "What is ZettaRemit? How does it work?")
        kwargs = client.chat_stream.call_args.kwargs
        self.assertEqual(kwargs["history"][0]["content"], "What is ZettaRemit?")
        self.assertIn("Verified simulation context", kwargs["user_message"])
        self.assertIn("Strict Grounding", kwargs["system_prompt"])
        self.assertEqual(events[-1]["type"], "done")
        self.assertEqual(service.sessions.get_history("conversation")[-1]["content"], "It uses INR to USD.")

    def test_singleton_preserves_conversation_service(self):
        with patch("backend.ai.rag_service._DEFAULT_SERVICE", None):
            first = get_rag_service()
            self.assertIs(get_rag_service(), first)
            self.assertEqual(first.gemini.provider, "gemini")

    def test_no_context_returns_grounded_fallback_without_generation(self):
        client = MagicMock(spec=GeminiClient)
        client.provider, client.model = "gemini", "test-model"
        service = RAGService(gemini_client=client)
        with patch("backend.ai.rag_service.query_knowledge_base", return_value=[]):
            response = service.answer("Who is the founder?")
            events = list(service.answer_stream("Who is the founder?"))
        self.assertIn("don't have information", response.answer)
        self.assertEqual(events[-1]["type"], "done")
        client.chat.assert_not_called()
        client.chat_stream.assert_not_called()
