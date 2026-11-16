# ZettaRemit AI upgrade implementation report

Subsequent local live verification is recorded in [LOCAL_AI_TESTING.md](LOCAL_AI_TESTING.md).
The no-live-call statements below describe the original implementation stage.

## Repository audit and implementation plan

The actual application is an Expo/React Native web frontend, a FastAPI backend
with SQLAlchemy/MySQL persistence and short-lived HS256 JWTs, and a Spring Boot
stateless simulation calculator. The supported **transfer** direction is INR to
USD, with an approved 3% simulation fee in `backend/money.py` and Java. The
USD/INR reference rate is quoted as INR per USD; that quotation is not a supported
USD-to-INR transfer corridor. This upgrade preserves the real code's contracts.

`backend/main.py` owns registration, simulated KYC, account validation, quotes,
transaction persistence and owner-scoped history. Java exposes authenticated
`/internal/v2/quote`; it has no transaction history/status lookup. The appropriate
transaction authorization boundary is consequently the existing FastAPI service
layer, not a new arbitrary Java/database endpoint.

The AI implementation uses `google-genai`, configurable `GEMINI_MODEL`, a
hand-written BM25F retriever, section-preserving Markdown chunks, bounded
conversation history, `/ai/ask`, and `/ai/ask-stream` SSE events. AI is disabled by
default. Knowledge is bundled in `backend/ai/knowledge_base/*.md`. There is no
support-ticket persistence or transport. The existing exchange-rate service
validates daily ExchangeRate-API snapshots and can serve a cached snapshot up to
its explicit validity limit (96 hours). It does not supply a tick-live market rate.
The Render blueprint still contained obsolete Ollama settings; these are corrected.

Implementation order: run baseline tests; retain BM25 and add semantic/RRF
retrieval; add atomic file synchronization and embedding reuse; add a bounded
native Gemini function loop and read-only tools; add signed support drafts with
an independent confirmation boundary; run backend, frontend and Java checks;
document configuration and deployment limitations. No database migration,
deployment, external communication, or model training is performed.

## Changed files

| File | Purpose |
| --- | --- |
| `backend/ai/hybrid.py` (new) | Configurable embeddings, cosine search, RRF, diagnostics, stable IDs, versioned atomic snapshots and automatic refresh. |
| `backend/ai/agent.py` (new) | Seven validated tool contracts, owned transaction adapters, deterministic estimates, signed drafts, unavailable submission response and bounded Gemini loop. |
| `backend/ai/agent_router.py` (new) | Authenticated agent JSON/SSE routes, active-account check, existing rate/concurrency limits, scoped history and independent confirmation route. |
| `backend/ai/rag_service.py` | Hybrid retrieval for existing generation paths, configurable final chunk count, explicit untrusted-document instructions. |
| `backend/ai/router.py` | Opt-in dispatch on existing chat routes, additive draft/error response fields. |
| `backend/ai/gemini_client.py` | SDK HTTP deadline and bounded retry configuration. |
| `backend/main.py` | Owner-scoped read-only transaction service methods and AI startup/feature registration. |
| `backend/requirements-container.lock` | Constrain google-genai to the locally tested SDK version, 2.7.0. |
| `backend/test_hybrid_agent_offline.py` (new) | Offline hybrid/synchronization/agent/security/API regression tests. |
| `deployment/.env.example` | Nonsecret configuration template for every new setting. |
| `render.yaml` | Replace obsolete AI settings with Gemini and safe opt-in defaults. |
| `docs/AI_UPGRADE.md` (new) | This report, operational instructions and demonstrations. |

Existing `.vscode/` changes are left alone. Web export and Java test output are
generated artifacts, not source edits.

## Implemented behavior and status

Fully implemented:

- Retained BM25F plus cosine semantic rankings, RRF (60), stable deduplication,
  defaults of 5 lexical / 5 vector / 3 final chunks, configurable limits and
  per-query latency/mode/version diagnostics.
- File additions/modifications/deletions detected by content hashes. Indexing
  happens on AI startup and on the first query after the refresh interval.
  No background watcher is assumed to observe GitHub. A deployment bundles new
  reviewed files and startup refreshes them. In-place local file changes refresh
  on the next eligible query. Both indexes use one captured document set.
- Content-based chunk IDs survive unrelated document changes; source hashes
  identify document versions. Unchanged chunk embeddings are reused in memory.
  New snapshots publish only after complete construction. Failed hybrid rebuilds
  retain both old indexes and report degraded diagnostics; subsequent intervals
  retry. Query embedding failures can use configurable BM25 fallback. If no
  hybrid snapshot exists, fallback may publish a complete lexical-only snapshot.
- Gemini native function declarations with automatic execution disabled. Backend
  allowlisting and Pydantic validation reject extra identity fields and invalid
  identifiers, currencies and amounts. Iteration/call/HTTP/tool/whole-agent
  deadlines bound execution; repeated tool requests are cached within a run.
  Repeated identical knowledge searches reference earlier chunks rather than
  repeat full context. Input/output usage is returned where Gemini supplies it.
- Transaction callbacks use fresh DB sessions, recheck active users, and include
  the owner in every query. No private recipient names, KYC data, sender IDs or
  credentials are returned to Gemini. Missing pending reasons and ETAs are null.
- Reference-rate provenance, actual provider/observation/fetch/retrieval times,
  indicative/cache freshness and no invented live claims. Deterministic Decimal
  INR-to-USD estimates reuse `money.amounts` and `money.FEE`; fees and payouts round
  half up to cents. Estimates are simulated and not guaranteed.
- Signed, owner-bound, ten-minute support drafts contain only transaction ID,
  recorded status and a validated issue category. User confirmation is validated
  separately; a model-provided flag or text never authorizes an action.
- Legacy token streaming remains available when the agent flag is off. With the
  agent on, existing chat routes use the controlled loop and keep `start`,
  `chunk`, `done`, `error` SSE framing. Agent answers arrive as a final text chunk
  after tool work, with keepalive comments while waiting. Conversation history
  remains bounded and scoped to authenticated user plus session.

Implemented but requiring configuration:

- Semantic embeddings: choose `gemini` or install optional `fastembed` and choose
  `local`. Default `none` deliberately preserves inexpensive BM25-only operation.
- Gemini generation/agent: configure an API key, a model available to that key,
  and both enable flags. No billable call was made during implementation.

Partial or unavailable:

- Support **submission is unavailable**, including after valid confirmation.
  No support backend exists, so the confirmation endpoint returns HTTP 503 and
  `submitted: false`. Repeated confirmations cannot create duplicate tickets
  because nothing is submitted. A future real integration needs durable atomic
  idempotency, ownership revalidation and an audited transport before enabling
  submission. There is no pretend local ticket number or external notification.
- Strict tick-live FX and USD-to-INR transfers are not implemented: the actual
  platform supports daily reference snapshots and INR-to-USD simulations. Rate
  tools expose actual freshness instead of mislabeling cached data.
- No new frontend confirmation screen was added; API consumers can review the
  structured `drafts` field and call the confirmation endpoint. Existing chat
  screens continue to display the agent's text.

## Configuration

Set backend values in Render environment settings or local process environment.
Do not put keys in Cloudflare/Expo public variables. `deployment/.env.example`
contains placeholders only. Existing DB/JWT/TLS/CORS/internal-service settings
remain required and unchanged.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ENABLE_AI_AGENT` | `false` | Enable agent routes and dispatch existing chat through the agent; also requires existing `ENABLE_AI_ASSISTANT=true`. |
| `RAG_EMBEDDING_PROVIDER` | `none` | `none`, `gemini`, or `local`. |
| `RAG_EMBEDDING_MODEL` | provider dependent | `gemini-embedding-001` hosted; `BAAI/bge-small-en-v1.5` local. |
| `RAG_BM25_CANDIDATES` | `5` | Lexical candidate limit, 1–100. |
| `RAG_VECTOR_CANDIDATES` | `5` | Semantic candidate limit, 1–100. |
| `RAG_FINAL_CHUNKS` | `3` | Final context limit, 1–20; tune using evaluation. |
| `RAG_RRF_K` | `60` | RRF constant, 1–1000. |
| `RAG_BM25_FALLBACK` | `true` | Allow lexical-only startup/query fallback. Existing hybrid rebuild failures retain the previous snapshot. |
| `RAG_SYNC_SECONDS` | `60` | Minimum interval between file checks, 0–86400; zero checks every query. |
| `AGENT_MAX_TOOL_CALLS` | `8` | Total calls per run, 1–20, including cached/rejected calls. |
| `AGENT_MAX_ITERATIONS` | `5` | Model turns per run, 1–10. |
| `AGENT_TIMEOUT_SECONDS` | `45` | Whole-agent deadline, 1–120. |
| `AGENT_TOOL_TIMEOUT_SECONDS` | `8` | Individual tool wait deadline, 1–30. |
| `AGENT_RATE_PROVIDER` | `exchange_rate_api` | Existing fixed HTTPS provider; `none` or other values return unavailable. Arbitrary provider URLs are not accepted. |

Existing `GEMINI_API_KEY` and `GEMINI_MODEL` still control Google credentials and
generation. Fees come from the approved application constant, not an invented
environment fee schedule. No support destination or credentials are configured.

## Deployment and embedding tradeoffs

The small KB uses an in-memory vector list, not a separate vector database.
Hosted embeddings avoid local model RAM/download/cold-start overhead at the cost
of external availability, per-request latency and provider billing. Document
embeddings are cached per worker and reused for unchanged chunks, but rebuilt
after restart. Hosted query text is projected to alphabetic terms already present
in the public KB: raw names, identifiers, numbers and private messages are not
forwarded verbatim. This reduces semantic quality for vocabulary absent from the
KB; use local embeddings for full query semantics without hosted disclosure.
Do not place customer information or secrets in the public KB.

Local mode uses optional ONNX fastembed, one model instance with one compute
thread, rather than introducing PyTorch. Install `fastembed` separately and set
`RAG_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5` (remove the hosted example override).
This path and its model download/RAM/cold start were not benchmarked here.
Provision/download its cache ahead of startup and measure memory on the actual
Render plan before choosing it. It is not included in the default free-tier
Docker image. Hosted `gemini` mode needs no extra Python dependency.

Render: retain existing production schema acknowledgement, CA mount, separate JWT
and internal-service secrets, exact HTTPS CORS origins and supervised Java service.
Enable AI only after selecting the provider/model and validating the account's
quota/model access. The SDK timeout is 15 seconds with one attempt. No new port,
database table, migration, filesystem persistence or worker service is needed.
Per-worker rate budgets/history/cache are process-local, as before; multi-instance
global quotas would require shared infrastructure.

Cloudflare: no build setting or public API URL changes. Existing web build uses
`npm run build:web`, output `frontend/dist`. SSE proxy buffering must remain off;
agent responses send keepalive comments every five seconds. Cancellation stops
async model work. Synchronous read tools can finish after a timeout; a dedicated
two-thread executor bounds active background tools. No state-changing transport
runs in that executor.

Only reviewed Markdown bundled in `knowledge_base` is authoritative. External
regulatory/financial content must be reviewed in a PR before entering that folder;
there is no automatic web ingestion or publication, and no Gemini fine-tuning.
Keep the source directory read-only for untrusted application clients.

SDK interfaces were checked against the installed 2.7.0 types and Google's
[official SDK documentation](https://github.com/googleapis/python-genai), including
native function declarations, disabled automatic function execution and embeddings.

## Demonstrations (after configuration; examples were not sent to live services)

Use the JWT returned by `/users/login`, never an LLM-supplied identity. These curl
examples use shell environment variables `API` and `ACCESS_TOKEN` as placeholders.

1. Hybrid RAG: with embeddings configured, POST `/ai/ask` with
   `{"question":"What are the simulation fees?"}`. With agent enabled, knowledge
   search is selected by Gemini; with it disabled, RAG always retrieves. Internal
   tool chunk metadata includes retrieval mode, version and latency.

   ```sh
   curl "$API/ai/ask" -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H 'Content-Type: application/json' -d '{"question":"What are the simulation fees?"}'
   ```

2. Automatic update: edit/add/delete an approved `.md` file locally, wait at least
   `RAG_SYNC_SECONDS`, then ask about its topic. The next query rebuilds and
   publishes a new snapshot. On Render, commit the approved content and deploy
   a new bundle; a filesystem watcher does not fetch GitHub changes. For direct
   diagnostics from a configured backend working directory:

   ```python
   from ai.hybrid import get_knowledge_index
   print(get_knowledge_index().query('simulation fees')[0]['retrieval'])
   ```

3. Authenticated transaction lookup: POST `/ai/agent/ask` with
   `{"question":"Show my latest simulated transfer."}`. No user ID is accepted.
   The unchanged `/transactions/?limit=1` route also provides deterministic history.
   A request about another user's `TXN-...` returns not found, not their record.

4. Multi-step workflow and SSE:

   ```sh
   curl -N "$API/ai/ask-stream" -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"question":"Check my latest transfer. If pending, explain the reason and prepare a support request."}'
   ```

   The agent can retrieve the owned transaction, search policies and prepare a
   draft. Missing reasons remain unknown; a recorded SIMULATED status must not be
   changed to pending to fit the question.

5. Exchange rate: POST `/ai/agent/ask` with
   `{"question":"What is the current USD/INR reference rate and when was it observed?"}`.
   The result is provider data with snapshot provenance, or unavailable. To estimate
   the supported corridor ask `Estimate USD received for 10000 INR including fees`.

6. Support: ask `Prepare a status_question support draft for TXN-<your-owned-id>`.
   Review the returned `drafts[0].draft` and copy its exact `draft_token`. Then:

   ```sh
   curl "$API/ai/support/confirm" -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"draft_token":"<exact-reviewed-token>","confirmed":true}'
   ```

   Current expected response: HTTP 503, `support_backend_unavailable`,
   `submitted:false`. False/missing confirmation, tampering, expiry and a different
   owner fail validation. Saying "yes" in chat never submits a request.

## Validation results

Baseline: `python -m unittest discover -s backend -p 'test_*offline.py'` ran
129 tests, all passed before changes. Final verification is recorded below.

| Check executed | Result |
| --- | --- |
| `python -m unittest discover -s backend -p 'test_*offline.py'` | 157 passed in 20.044s, 0 failures/errors (includes 28 new tests). |
| Existing `test_ai_rate_integration` and `test_sec_fixes` with synthetic test environment and mocked shared rate provider | 18 passed, 0 failures/errors. |
| `npm test` from `frontend` | 99 passed, 0 failed. |
| `npm run build:web` from `frontend` | Exit 0; Metro exported `dist`. |
| `gradlew.bat test --rerun-tasks --no-daemon` from transaction service | BUILD SUCCESSFUL; all six Gradle tasks executed; XML results show 4 SnapshotQuoteTest + 6 TransactionServiceSpec tests, 0 failures/errors. |
| `git diff --check` | Exit 0, no whitespace errors; Windows line-ending notices only. |
| Docker engine availability check | Failed: Docker Desktop Linux engine named pipe does not exist; container build/runtime tests not executed. |

An additional AI-enabled application smoke test initially exposed removal of
`FastAPI.add_event_handler` in the installed FastAPI version. Startup now uses a
lifespan context manager. The corrected smoke test passed real application
startup, OpenAPI generation and 401 rejection on all five AI endpoints. It is
included as an isolated regression test in the final offline suite.

Initial direct invocations of the two older non-`offline` suites failed before
meaningful execution because no local DATABASE_URL/JWT test configuration was
provided. They passed after isolating their environment and mocking the rate
provider. This run did not use a customer database or the live FX API. A
reproducible PowerShell invocation from the repository root is:

```powershell
@'
import os, sys, unittest
from unittest.mock import Mock, patch
from datetime import datetime, timezone
from decimal import Decimal
sys.path.insert(0, 'backend')
from exchange_rates import RateSnapshot
now = datetime.now(timezone.utc)
provider = Mock()
provider.get_rate.return_value = RateSnapshot(Decimal('80'), now, now, now, now)
with patch.dict(os.environ, {'APP_ENV':'test', 'DATABASE_MODE':'local', 'DATABASE_URL':'sqlite://', 'LOCAL_CREATE_TABLES':'false', 'JWT_SECRET_KEY':'synthetic-unit-test-key-at-least-32-bytes', 'ENABLE_AI_ASSISTANT':'false'}), patch('exchange_rates.get_exchange_rate_provider', return_value=provider):
    suite = unittest.defaultTestLoader.loadTestsFromNames(['backend.test_ai_rate_integration', 'backend.test_sec_fixes'])
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    sys.exit(not result.wasSuccessful())
'@ | python -
```

Expected test warnings: Starlette's existing httpx TestClient deprecation,
intentional knowledge-refresh failure warnings in recovery tests, and occasional
async debug timing notices. No failure was hidden by these warnings.

No live Gemini/embedding calls, customer DB checks, Render deployment or real
support communications were performed. Semantic unit tests use a deterministic
embedding double to verify ranking; actual model quality/latency/cost needs an
evaluation run with the chosen provider and approved benchmark questions.

## Remaining limitations

This is a production-oriented upgrade, not a production certification. Live key
access, embedding quality, Render memory/startup, Linux dependency installation
and production proxy behavior need deployment-environment validation. Model
answers can still be wrong; prompt instructions are defense in depth, while
ownership, allowlisting and confirmation are enforced outside the model. Do not
grant additional model tools or write privileges without authorization tests.
