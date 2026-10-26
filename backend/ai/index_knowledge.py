#!/usr/bin/env python3
"""ZettaRemit Knowledge Base Indexer (Phase 1 RAG).

Reads Markdown documents from backend/ai/knowledge_base/, splits them into
chunks, computes embeddings via Sentence Transformers (all-MiniLM-L6-v2),
and stores them in a local ChromaDB collection.
"""

from dataclasses import dataclass
import io
import os
from pathlib import Path
import re
import sys
from typing import List, Optional

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent
KNOWLEDGE_BASE_DIR = BASE_DIR / "knowledge_base"
CHROMA_DATA_DIR = BASE_DIR / "chroma_data"
COLLECTION_NAME = "zettaremit_knowledge"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

_CACHED_EMBEDDER = None


def get_embedder():
    """Lazily load and cache the SentenceTransformer embedding model."""
    global _CACHED_EMBEDDER
    if _CACHED_EMBEDDER is None:
        from sentence_transformers import SentenceTransformer
        _CACHED_EMBEDDER = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _CACHED_EMBEDDER


@dataclass
class DocumentChunk:
    chunk_id: str
    source_file: str
    section_title: str
    text: str


def load_markdown_files(directory: Path) -> List[tuple[str, str]]:
    """Load all markdown files from the specified directory."""
    if not directory.exists():
        raise FileNotFoundError(f"Knowledge base directory not found: {directory}")

    docs = []
    for file_path in sorted(directory.glob("*.md")):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        docs.append((file_path.name, content))
    return docs


def split_markdown_into_chunks(filename: str, content: str) -> List[DocumentChunk]:
    """Split markdown text into structured chunks preserving section headings up to H3."""
    chunks: List[DocumentChunk] = []
    lines = content.splitlines()

    current_h1 = filename.replace(".md", "").replace("_", " ").title()
    current_h2 = "General"
    current_h3 = ""
    current_lines: List[str] = []
    chunk_counter = 0

    def flush_chunk():
        nonlocal chunk_counter, current_lines
        body = "\n".join(current_lines).strip()
        if body:
            chunk_id = f"{Path(filename).stem}_{chunk_counter:03d}"
            parts = [current_h1]
            if current_h2 and current_h2 != "General":
                parts.append(current_h2)
            if current_h3:
                parts.append(current_h3)
            section = " > ".join(parts)
            chunk_text = f"## {section}\n{body}"
            chunks.append(DocumentChunk(
                chunk_id=chunk_id,
                source_file=filename,
                section_title=section,
                text=chunk_text
            ))
            chunk_counter += 1
        current_lines = []

    for line in lines:
        if line.startswith("# "):
            flush_chunk()
            current_h1 = line[2:].strip()
            current_h2 = "General"
            current_h3 = ""
        elif line.startswith("## "):
            flush_chunk()
            current_h2 = line[3:].strip()
            current_h3 = ""
        elif line.startswith("### "):
            flush_chunk()
            current_h3 = line[4:].strip()
        else:
            current_lines.append(line)

    flush_chunk()
    return chunks


def get_all_chunks() -> List[DocumentChunk]:
    """Load and chunk all markdown files in the knowledge base."""
    docs = load_markdown_files(KNOWLEDGE_BASE_DIR)
    all_chunks = []
    for filename, content in docs:
        chunks = split_markdown_into_chunks(filename, content)
        all_chunks.extend(chunks)
    return all_chunks


def index_knowledge_base():
    """Index all knowledge chunks into a local persistent ChromaDB collection."""
    try:
        import chromadb
        embedder = get_embedder()
    except ImportError as e:
        print("\n[AI Dependencies Not Installed]")
        print(f"Import error: {e}")
        print("To install required packages when ready, run:")
        print("  pip install -r backend/requirements-ai.txt\n")
        print("Dry-run preview of parsed chunks:")
        chunks = get_all_chunks()
        print(f"Total chunks extracted: {len(chunks)}")
        for c in chunks[:3]:
            print(f"  - [{c.chunk_id}] {c.section_title} ({len(c.text)} chars)")
        return False

    print(f"1. Embedding model loaded: {EMBEDDING_MODEL_NAME}")
    print(f"2. Initializing ChromaDB at: {CHROMA_DATA_DIR}...")
    CHROMA_DATA_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_DATA_DIR))

    # Recreate collection to ensure clean state
    try:
        client.delete_collection(name=COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )

    chunks = get_all_chunks()
    print(f"3. Extracted {len(chunks)} chunks from {len(list(KNOWLEDGE_BASE_DIR.glob('*.md')))} files.")

    ids = [c.chunk_id for c in chunks]
    documents = [c.text for c in chunks]
    metadatas = [{"source": c.source_file, "section": c.section_title} for c in chunks]

    print("4. Computing embeddings...")
    embeddings = embedder.encode(documents, convert_to_numpy=True).tolist()

    print("5. Upserting into ChromaDB collection...")
    collection.upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

    print(f"[SUCCESS] Indexed {len(chunks)} knowledge chunks into ChromaDB '{COLLECTION_NAME}'.")
    return True


def query_knowledge_base(query: str, top_k: int = 3):
    """Perform a semantic search against the indexed ChromaDB collection."""
    try:
        import chromadb
        embedder = get_embedder()
    except ImportError:
        print("Cannot query: chromadb and sentence-transformers must be installed first.")
        return []

    if not CHROMA_DATA_DIR.exists():
        print("ChromaDB storage not found. Run indexing first.")
        return []

    client = chromadb.PersistentClient(path=str(CHROMA_DATA_DIR))
    try:
        collection = client.get_collection(name=COLLECTION_NAME)
    except Exception:
        print(f"Collection '{COLLECTION_NAME}' not found. Please index first.")
        return []

    query_embedding = embedder.encode([query], convert_to_numpy=True).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(top_k, collection.count())
    )

    output = []
    if results and "documents" in results and results["documents"]:
        docs = results["documents"][0]
        metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
        distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)

        for doc, meta, dist in zip(docs, metas, distances):
            similarity = 1.0 - dist
            output.append({
                "source": meta.get("source", "unknown"),
                "section": meta.get("section", "unknown"),
                "similarity": similarity,
                "text": doc
            })
    return output


def run_test_suite():
    """Run verification search queries on the knowledge base."""
    test_queries = [
        "What is ZettaRemit's transfer fee?",
        "How long is a signed quote valid?",
        "Does ZettaRemit move real money?",
        "What is the maximum allowed transfer amount in INR?"
    ]

    print("\n==============================================")
    print("  ZettaRemit Semantic Retrieval Test Results")
    print("==============================================")
    for q in test_queries:
        print(f"\nQuery: \"{q}\"")
        results = query_knowledge_base(q, top_k=2)
        if not results:
            print("  (No results or dependencies missing)")
        for idx, r in enumerate(results, 1):
            print(f"\n  [Rank {idx}] Match Score: {r['similarity']:.4f}")
            print(f"  Source Document: {r['source']}")
            print(f"  Section: {r['section']}")
            print("  Passage:")
            for line in r['text'].splitlines():
                print(f"    {line}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--query":
        query_str = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "What is the fee?"
        print(f"Querying: {query_str}")
        res = query_knowledge_base(query_str)
        for r in res:
            print(f"\n[{r['source']}] {r['section']} (similarity: {r['similarity']:.4f})")
            print(r['text'])
    else:
        success = index_knowledge_base()
        if success:
            run_test_suite()
