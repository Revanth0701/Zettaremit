"""Shared Markdown loading and section-preserving chunking for BM25 RAG."""

from dataclasses import dataclass
from pathlib import Path
from typing import List


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
