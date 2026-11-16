# Local AI integration verification — 2026-11-15

Subsequent real-browser verification, native streaming and session/header fixes
are recorded in [LOCAL_BROWSER_VERIFICATION.md](LOCAL_BROWSER_VERIFICATION.md).
The results below describe the earlier API/client verification stage.

The local system is ready for an API demonstration. Actual Gemini generation,
embeddings, authenticated multi-step tool execution and the frontend HTTP/SSE
client were exercised successfully. No deployment or production access occurred.
FastAPI and Java processes started by the smoke test were stopped afterward.

## Local configuration

The ignored `backend/.env` now enables `ENABLE_AI_ASSISTANT=true`,
`ENABLE_AI_AGENT=true`, `RAG_EMBEDDING_PROVIDER=gemini` and
`RAG_EMBEDDING_MODEL=gemini-embedding-001`. Generation uses
`GEMINI_MODEL=gemini-3.1-flash-lite`. The environment remains development-only,
the database is `zettaremit_ai_dev` at loopback port 3306, and
`LOCAL_CREATE_TABLES=false` remains set. Existing database connection settings,
JWT signing key and Gemini key were preserved. A missing development-only
`INTERNAL_SERVICE_TOKEN` was generated securely and passed to Java using the
existing environment-variable convention. No secret values are included here.

The ignored `frontend/.env.local` sets the public API base to
`http://127.0.0.1:8000`. This is used by local Expo development and local web
exports; it is not committed and does not change Cloudflare configuration.
Both local environment files are ignored and untracked.

Only bcrypt was changed in the active Python installation: 3.2.2 was replaced
with the project's already-declared 4.0.1. `pip check` reports no broken
requirements. No dependency manifests or deployment settings were changed in
this verification workflow.

## Integration fixes and files changed in this workflow

| File | Change |
| --- | --- |
| `backend/.env` (ignored) | Enable local AI and configure the development internal-service token; preserve DB/JWT/API key settings. |
| `frontend/.env.local` (ignored) | Explicit loopback frontend API URL. |
| `backend/ai/agent.py` | Require an approved evidence tool on the first model turn, then use automatic tool selection on later turns; submission is excluded from first-turn allowed calls. |
| `backend/test_hybrid_agent_offline.py` | Assert first-turn evidence enforcement and later automatic selection in the existing multi-step regression test. |
| `frontend/lib/aiStream.js` | Shared SSE parser supporting streamed and buffered responses, keepalives, split CRLF boundaries, final sources/drafts, errors and truncated-response detection. |
| `frontend/lib/client.js` | Use the parser for both browser streams and buffered native responses; notify sources at completion and release readers. |
| `frontend/screens/AIAssistantScreen.js` | Display approved references using readable titles without exposing raw Markdown filenames. |
| `frontend/tests/ai_stream.test.cjs` | Four regressions for final sources, buffered responses, malformed/truncated streams and buffered provider errors. |
| `tools/test_ai_offline.py` | Reproducible offline runner with synthetic credentials, SQLite configuration, disabled hosted embeddings and mocked rate data. |
| `tools/test_local_ai_integration.py` | Explicit `--live` local-only integration runner; real HTTP, real MySQL, real Java and real Gemini; safe summaries and automatic service shutdown. |
| `docs/AI_UPGRADE.md` | Link the original implementation report to these subsequent live results. |
| `docs/LOCAL_AI_TESTING.md` | This verification record and reproduction steps. |

Earlier upgrade edits already present in the workspace, including Render and
deployment-template changes, were preserved. This workflow did not edit those
deployment files, change production settings, commit or push anything.

## Real API and local service results

- Google model metadata confirmed access to `gemini-3.1-flash-lite`
  (`generateContent`) and `gemini-embedding-001` (`embedContent`).
- A minimal live generation call returned nonempty text: 14 input tokens and
  2 output tokens. A separate live embedding call returned one 3,072-dimensional
  vector.
- Real FastAPI lifespan startup succeeded with hosted embeddings enabled.
  All eight approved documents produced 39 indexed chunks, each with a
  3,072-dimensional vector. Startup reported no indexing error.
- Two sample retrieval questions returned the expected fee/corridor sources,
  hybrid mode, lexical plus vector candidates and three final context chunks.
  This validates the pipeline on those examples, not an exhaustive retrieval
  quality benchmark.
- Automatic change detection rebuilt both indexes for a modified temporary
  copy of the approved KB. Cached unchanged vectors were reused. The application
  knowledge files themselves were never edited. Add/update/delete, failed rebuild,
  lexical fallback and recovery cases also passed deterministic offline tests.
- The Java calculator started on loopback port 8082 with the matching internal
  token. Real reference-rate requests and Python-to-Java quotes succeeded.
  Each synthetic INR 10,000 quote deducted INR 300, used the supported INR-to-USD
  direction and produced a simulated transfer through the supported API.
- Transfer retries with the same idempotency key returned the same transaction.
- A real authenticated Gemini request executed `get_latest_transaction`,
  `get_exchange_rate`, `calculate_transfer_estimate`, `search_knowledge`, and
  `prepare_support_request`, then returned an answer and a structured draft.
  The final multi-step run used 10,358 aggregate input tokens and 577 aggregate
  output tokens across its model turns. Financial arithmetic ran in backend
  Decimal functions, not in the language model.
- The actual frontend client consumed a real `/ai/ask-stream` response with
  Bearer authentication, answer text, sources and a sources callback.
- Missing-auth requests were rejected on all four AI question routes. An
  LLM/user-supplied identity field was rejected. Owner-scoped transaction tools
  returned not found for another synthetic user's record; history rejected a
  mismatched sender. Unknown tools and invalid tool arguments were rejected.
- Support confirmation rejected false confirmation and another user's signed
  draft. Repeated valid confirmations returned 503 with `submitted=false`.
  **No support backend exists; submission intentionally remains unavailable.**
- All recorded transfers remained `SIMULATED`. No real payment service or money
  movement was invoked.

The first live run exposed an unsourced policy answer: Gemini answered directly
without choosing retrieval. First-turn tool enforcement corrected that gap. The
corrected run passed all checks, including source delivery through the frontend.
Four synthetic users, four verification records and four simulated transactions
were retained across the two runs. No historical data was copied or deleted.
Only `zettaremit_ai_dev` was used for the integration data; `instaremit_db`, Aiven
and production databases were not accessed by the test workflow.

## Test results

| Check | Result |
| --- | --- |
| `python -B tools/test_ai_offline.py` | 157 backend offline tests plus 18 rate/security regressions passed; 0 failures. |
| `python -B tools/test_local_ai_integration.py --live` | Final run: 26 checks passed; 0 failed. Real provider/model calls, no mocked business services. |
| Initial live integration run | 24 passed, 2 failed (frontend source-delivery check and its process status); fixed and rerun successfully. |
| `npm test` in `frontend` | 103 passed; 0 failed, including four new SSE parser tests. |
| `npm run build:web -- --clear` in `frontend` | Passed; final bundle inspection confirmed the loopback API target and absence of the production fallback. |
| `gradlew.bat test bootJar --no-daemon` | BUILD SUCCESSFUL; 10-test results have no failures/errors. Gradle reused up-to-date test and jar outputs in this workflow. |
| `python -B -m pip check` | No broken requirements found. |
| `git diff --check` | Passed; only Windows line-ending notices. |

Offline tests use synthetic configuration and mocks; their results are distinct
from the real API checks above. An automated browser walkthrough and physical
Android/iOS testing were not performed. Frontend verification covers its source
contracts, unit tests, web export and real Node fetch/SSE integration.

The first export after adding `.env.local` reused Metro's cached production API
selection. Clearing the export cache corrected it; the resulting JavaScript was
inspected to confirm its API target. Clear Metro's cache after changing local
public environment values rather than assuming a successful build picked them up.

## Run a local demonstration

Use the configured Python 3.12 environment. From the repository root, first run:

```powershell
python -B tools/start_java_local.py
```

In a separate terminal, start FastAPI:

```powershell
Set-Location backend
python -B -m uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Then start Expo from another terminal:

```powershell
Set-Location frontend
npm run web -- --clear
```

Keep `LOCAL_CREATE_TABLES=false`. FastAPI startup embeds approved documents and
can incur provider charges. Register a new synthetic demo account through the
UI; randomly generated smoke-test passwords and tokens are deliberately neither
displayed nor retained. Use supported quote/transfer screens to create simulated
records, then ask about fees, the latest transfer, reference rates or a support
draft. Rates are indicative daily snapshots, not tick-live quotes.

For an automated rerun, stop other services on ports 8000 and 8082, then run
`python -B tools/test_local_ai_integration.py --live`. It makes live API calls,
retains two additional synthetic accounts/transactions when successful, and
stops its own services. For ordinary nonbillable checks use
`python -B tools/test_ai_offline.py` so the enabled development environment does
not accidentally select hosted embeddings in retrieval tests.

No local-demo blocker remains for the tested paths. Support submission is
unavailable by design; browser/device interaction and production deployment
remain outside the verified scope. Database credentials still use the existing
local root account; consider a separately scoped development user before sharing
the environment. No production-readiness claim is made by these local results.
