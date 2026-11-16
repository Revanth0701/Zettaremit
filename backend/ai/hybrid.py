"""Versioned, atomic in-memory BM25/vector snapshots of reviewed bundled Markdown.

No network on import. Failed refreshes retain the last complete snapshot. Each
worker checks files on demand; deployments/restarts rebuild from approved files.
"""
from dataclasses import dataclass
import hashlib
import logging
import math
from pathlib import Path
import re
from threading import Lock
import time
import unicodedata

from settings import setting
from .lightweight_retriever import BM25Retriever
from .markdown_utils import load_markdown_files, split_markdown_into_chunks

log = logging.getLogger(__name__)


def integer(name, default, low=1, high=100):
    value = int(setting(name, str(default)))
    if not low <= value <= high:
        raise ValueError(f"Invalid {name}")
    return value


@dataclass(frozen=True)
class RetrievalConfig:
    bm25: int = 5
    vector: int = 5
    final: int = 3
    rrf: int = 60
    fallback: bool = True
    interval: int = 60

    @classmethod
    def environment(cls):
        return cls(integer('RAG_BM25_CANDIDATES', 5), integer('RAG_VECTOR_CANDIDATES', 5),
                   integer('RAG_FINAL_CHUNKS', 3, high=20), integer('RAG_RRF_K', 60, high=1000),
                   setting('RAG_BM25_FALLBACK', 'true').lower() == 'true',
                   integer('RAG_SYNC_SECONDS', 60, low=0, high=86400))


def unit(vector):
    values = tuple(float(v) for v in vector)
    if not values or any(not math.isfinite(v) for v in values):
        raise ValueError('Invalid embedding')
    norm = math.sqrt(sum(v*v for v in values))
    if not norm:
        raise ValueError('Empty embedding')
    return tuple(v/norm for v in values)


class Embeddings:
    """Optional lightweight ONNX local model or existing Gemini SDK.

    Hosted query inputs are projected onto public KB vocabulary to prevent
    forwarding customer names, identifiers, amounts, or free-form private text.
    Local mode avoids that quality/privacy compromise entirely.
    """
    def __init__(self):
        self.provider = setting('RAG_EMBEDDING_PROVIDER', 'none')
        default = 'BAAI/bge-small-en-v1.5' if self.provider == 'local' else 'gemini-embedding-001'
        self.model = setting('RAG_EMBEDDING_MODEL', default)
        self.identity = f'{self.provider}:{self.model}'
        self._client = None

    def embed(self, texts, query=False):
        if self.provider == 'none':
            raise RuntimeError('Embedding provider not configured')
        if self.provider == 'local':
            if self._client is None:
                from fastembed import TextEmbedding
                self._client = TextEmbedding(model_name=self.model, threads=1)
            return [unit(v) for v in self._client.embed(texts)]
        if self.provider == 'gemini':
            from .gemini_client import GeminiClient
            from google.genai import types
            if self._client is None:
                self._client = GeminiClient()._get_client()
            response = self._client.models.embed_content(
                model=self.model, contents=texts,
                config=types.EmbedContentConfig(task_type='RETRIEVAL_QUERY' if query else 'RETRIEVAL_DOCUMENT'))
            return [unit(e.values) for e in response.embeddings]
        raise ValueError('Unsupported embedding provider')


@dataclass(frozen=True)
class Snapshot:
    version: str
    chunks: tuple
    bm25: BM25Retriever
    vectors: tuple
    vocabulary: frozenset


def fuse(rankings, constant):
    scores, chunks = {}, {}
    for ranking in rankings:
        seen = set()
        for rank, chunk in enumerate(ranking, 1):
            key = chunk['chunk_id']
            if key in seen:
                continue
            seen.add(key)
            scores[key] = scores.get(key, 0) + 1 / (constant + rank)
            chunks[key] = chunk
    return [dict(chunks[key], rrf_score=scores[key])
            for key in sorted(scores, key=lambda k: (-scores[k], k))]


class KnowledgeIndex:
    def __init__(self, directory=None, embeddings=None, config=None):
        self.directory = directory or Path(__file__).parent / 'knowledge_base'
        self.embeddings = embeddings if embeddings is not None else Embeddings()
        self.config = config or RetrievalConfig.environment()
        self._snapshot = None
        self._cache = {}
        self._lock = Lock()
        self._checked = float('-inf')
        self.last_error = None

    def sync(self, force=False):
        with self._lock:
            if not force and time.monotonic() - self._checked < self.config.interval:
                return False
            self._checked = time.monotonic()
            try:
                docs = load_markdown_files(self.directory)
                version = hashlib.sha256(repr(docs).encode()).hexdigest()
                if self._snapshot and self._snapshot.version == version and not self.last_error:
                    return False
                chunks = []
                for name, text in docs:
                    digest = hashlib.sha256(text.encode()).hexdigest()
                    occurrences = {}
                    for c in split_markdown_into_chunks(name, text):
                        identity = hashlib.sha256(f'{name}\0{c.section_title}\0{c.text}'.encode()).hexdigest()
                        occurrence = occurrences.get(identity, 0)
                        occurrences[identity] = occurrence + 1
                        chunks.append(dict(chunk_id=f'{identity}:{occurrence}', source=name,
                                           section=c.section_title, text=c.text, source_version=digest))
                bm25 = BM25Retriever()
                bm25.index_documents(chunks)
                cache = {}
                vectors = []
                try:
                    missing = [c for c in chunks if (self.embeddings.identity, c['chunk_id']) not in self._cache]
                    new = self.embeddings.embed([c['text'] for c in missing]) if missing else []
                    if len(new) != len(missing):
                        raise ValueError('Embedding count mismatch')
                    cache.update({(self.embeddings.identity, c['chunk_id']): unit(v) for c, v in zip(missing, new)})
                    for c in chunks:
                        key = (self.embeddings.identity, c['chunk_id'])
                        cache[key] = cache[key] if key in cache else self._cache[key]
                        vectors.append(cache[key])
                    if len({len(v) for v in vectors}) > 1:
                        raise ValueError('Embedding dimension mismatch')
                    vector_error = None
                except Exception:
                    # Existing hybrid snapshots never regress to a partially updated index.
                    if (self._snapshot and self._snapshot.vectors) or not self.config.fallback:
                        raise
                    vectors, cache = [], {}
                    vector_error = 'embeddings_unavailable'
                vocabulary = frozenset(re.findall(r'[a-z]{2,}', ' '.join(c['text'].lower() for c in chunks)))
                snapshot = Snapshot(version, tuple(chunks), bm25, tuple(vectors), vocabulary)
                self._cache = cache
                self._snapshot = snapshot  # single publication after both indexes complete
                self.last_error = vector_error
                return True
            except Exception:
                self.last_error = 'index_refresh_failed'
                log.warning('Knowledge refresh failed; retaining complete snapshot')
                if self._snapshot is None:
                    raise RuntimeError('Knowledge index unavailable') from None
                return False

    def query(self, query, top_k=None):
        start = time.perf_counter()
        self.sync()
        snapshot = self._snapshot
        query = ' '.join(unicodedata.normalize('NFKC', query).split())[:1000]
        lexical = snapshot.bm25.query(query, top_k=self.config.bm25)
        # BM25's public output remains unchanged; attach stable metadata here.
        lookup = {(c['source'], c['section'], c['text']): c for c in snapshot.chunks}
        lexical = [dict(lookup[(c['source'], c['section'], c['text'])], **{'lexical_score': c['score']})
                   for c in lexical if c['score'] > 0]
        semantic, fallback = [], not bool(snapshot.vectors)
        if snapshot.vectors and query:
            try:
                safe_query = query
                if getattr(self.embeddings, 'provider', None) == 'gemini':
                    safe_query = ' '.join(w for w in re.findall(r'[a-z]{2,}', query.lower()) if w in snapshot.vocabulary)
                    if not safe_query:
                        raise ValueError('No public query terms')
                vector = unit(self.embeddings.embed([safe_query], query=True)[0])
                if len(vector) != len(snapshot.vectors[0]):
                    raise ValueError('Query dimension mismatch')
                scores = [sum(a*b for a, b in zip(vector, v)) for v in snapshot.vectors]
                semantic = [dict(snapshot.chunks[i], cosine=scores[i])
                            for i in sorted(range(len(scores)), key=lambda i: -scores[i])[:self.config.vector]]
            except Exception:
                if not self.config.fallback:
                    raise RuntimeError('Semantic retrieval unavailable') from None
                fallback = True
        results = fuse([lexical, semantic], self.config.rrf)[:top_k or self.config.final]
        diagnostics = dict(index_version=snapshot.version, mode='bm25' if fallback else 'hybrid',
                           latency_ms=round((time.perf_counter()-start)*1000, 2),
                           bm25_candidates=len(lexical), vector_candidates=len(semantic), sync_error=self.last_error)
        return [dict(c, retrieval=diagnostics) for c in results]


_index = None
_index_lock = Lock()


def get_knowledge_index():
    global _index
    with _index_lock:
        if _index is None:
            _index = KnowledgeIndex()
        return _index
