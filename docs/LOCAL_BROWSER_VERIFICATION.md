# Local browser verification — 2026-11-15

**Result: ready for a local browser demonstration.** The actual Expo application
was tested in headless Microsoft Edge using Playwright 1.65.1. FastAPI, the
private Java calculator, local MySQL and real Gemini APIs were used. Backend
responses were not mocked in these browser journeys.

Open **http://127.0.0.1:8081/**. All three services were left running and returned
HTTP 200 at final verification. No deployment, commit or push occurred.

## Configuration and scope

- Effective database: `zettaremit_ai_dev` on `127.0.0.1:3306`, development mode.
- `LOCAL_CREATE_TABLES=false` throughout. No MySQL schema changes or migrations.
- Existing Gemini/JWT/internal-service credentials were preserved. No secrets
  were printed. `backend/.env` and `frontend/.env.local` remain ignored/untracked.
- Frontend API base is explicitly `http://127.0.0.1:8000`. The final exported
  JavaScript contains that target and no Render fallback.
- Browser routing allowed only local service ports and the existing keyless
  reference-rate provider. Final browser recordings contain **zero** attempted
  unapproved/production hosts. No Aiven, Render or Cloudflare resources were used.
- Only synthetic registration data and simulated transfers were inserted in the
  isolated development database. `instaremit_db` was not accessed or modified.

Final development row counts are **22 users, 22 verification records and 16
transactions**. This includes the four of each that existed before the task and
retained fixtures from exploratory runs and retests. No records were deleted.
Every transaction remains `SIMULATED`. Retained rows from different runs are not
duplicate submissions: each successful journey separately verified its own
double-click guard and exact-request idempotency replay.

## Rendered browser journeys

| Journey | Verified result |
| --- | --- |
| Registration | Desktop and mobile eight-step simulation wizard completed through actual UI controls; empty email and short password errors displayed; registration API returned 201. |
| Login/session | Supported login returned 200; the dashboard displayed the synthetic user's name. Reload restored the authenticated dashboard and persisted the session. Logout cleared session storage. |
| Public/protected access | Public pages did not expose private navigation. Missing/invalid JWT requests returned 401. A clock-expired session was cleared and redirected from protected AI entry, after resetting transfer state to eliminate background-request interference. |
| Dashboard | History/rate loading completed; correct account name and activity rendered; desktop and mobile navigation worked. |
| Transfer | Actual UI requested an INR-to-USD quote. INR 10,000 produced INR 300 fee and INR 9,700 net; USD payout matched the returned provider rate and rounding. |
| Submission/history | Simulated UPI confirmation submitted through the supported UI, showed a no-live-funds receipt, and appeared in history. A rapid double-click issued one create request. An exact API replay returned the same transaction. |
| Invalid input | Zero amount disabled proceeding. Registration validation also rejected missing email and passwords below the required length. |
| Mobile quote | Rendered INR 12,000 quote showed INR 360 fee and INR 11,640 net with the actual USD estimate; no second-user transfer was submitted. |
| Ownership isolation | The second newly registered user saw no first-user transfer. Its authenticated history API returned an empty list, and an explicit request using the other sender returned 403. |
| Desktop/mobile layout | 1440×1000 and 390×844 viewports were used. Home/dashboard/AI/quote checks found no document-level horizontal overflow. Long real chat history scrolled. Mobile header controls were checked for non-overlapping bounds. |
| Browser safety | No page runtime errors, detected console secret exposure or production request attempts in the final run. No HAR, trace, request bodies or authorization headers were saved. |

Authentication necessarily transports its credentials through the authorized
local login and Bearer requests. Those values were retained only in test/browser
memory and were not printed, included in screenshots or copied into the saved
network summary. Test passwords and tokens were not retained for manual login.

## Real AI and Hybrid RAG results

FastAPI startup explicitly reported **8 approved documents, 39 chunks, hybrid
mode**. The existing Gemini embedding model supplies 3,072-dimensional vectors.
The knowledge question used an approved tool and returned actual document
references, including `fees_and_rates.md`, displayed as **Fees and reference
rates** rather than a technical filename.

All four requested AI interactions succeeded in the rendered desktop UI:

| Prompt purpose | Observed tool count | Real text chunks |
| --- | ---: | ---: |
| Fee policy and simulation/no-real-money question | 1 | 4 |
| Latest owned transaction, details and recorded status | 2 | 9 |
| Indicative rate plus deterministic INR-to-USD estimate | 2 | 10 |
| Support draft for the user's created transaction | 1 | 9 |

The owned transaction answer displayed the test transaction and `SIMULATED`
status. The estimate used the backend Decimal tool. Support returned a structured
draft with `submitted=false`; the UI did not claim a ticket was submitted.
**Submission remains unavailable because there is no support backend.**

After the frontend fixes, a final minimal live knowledge request also succeeded:
**5 genuine provider-text chunks and 7 observed text-length changes**, with
readable reference pills. This was real incremental provider output, not a
finished answer split into artificial chunks. The existing overall agent deadline,
tool limits, ownership checks and confirmation boundary remain in force.

The browser harness observes a cloned copy of real fetch/SSE bytes and DOM
mutations. It does not replace service responses or model output. Only sanitized
counts, source names and submission flags are retained from that observation.

## Bugs found and fixes verified

1. **Agent answers were buffered into one SSE chunk.** The agent now consumes the
   SDK's native async stream, forwards ordinary text as it arrives and preserves
   function-call parts/thought signatures for subsequent tool turns. Retrieved
   reasoning/thought text is not forwarded. The router uses a bounded queue,
   keepalives and cancellation cleanup. Browser chunk/DOM checks passed.
2. **Provider failures lacked useful safe diagnostics.** Safe error categories,
   status codes, quota labels and model-turn timing are logged without prompts,
   raw exceptions, credentials or private records. Browser attempts observed
   read timeouts and Google HTTP **503 UNAVAILABLE**. These are not presented as
   successful model actions.
3. **Transient generation failures immediately ended requests.** The SDK request
   timeout is now a configurable 30 seconds. A model turn may retry once before
   any answer text has escaped; partial answers and quota/auth errors are never
   replayed. The whole-agent timeout remains 45 seconds by default. Offline tests
   verified retry boundaries and partial-stream failures.
4. **Signed support-draft tokens were unnecessarily sent back to Gemini.** The
   structured browser response retains the token, but model tool responses now
   omit it. Regression tests verify that separation.
5. **Expired cached sessions could enter the AI page.** An isolated browser-clock
   test reproduced this without a pending transfer. The shared `session()` getter
   now clears expired/malformed sessions and returns null. The corrected browser
   test and frontend regression passed.
6. **The AI header crowded its controls at mobile width.** The title now has a
   constrained flex area, single-line text and a smaller mobile font. Real browser
   bounds and screenshots verified the controls no longer overlap.

Exploratory test-harness failures were also corrected: selectors had matched
retained hidden React Navigation screens, expected the wrong UPI label/mobile
navigation controls, or assumed reload would return to the public homepage.
Reload correctly restores the dashboard. The Send button also remains disabled
when the input is empty, so request completion is now measured using the input's
editable state. Chromium's response-body inspection was unreliable for SSE;
the real-response clone observer replaced it. These were harness fixes, not
application defects. Expo CI mode required a restart after source edits because
it does not watch files; final tests used the updated clean bundle.

## Tests executed and result accounting

| Check | Actual result |
| --- | --- |
| Final browser run, `node tools/test_local_browser.cjs --live --knowledge-only` | **33 passed, 0 failed**, including a fresh real Gemini answer after frontend fixes. |
| Separate complete four-prompt AI browser segment | All four AI journeys, readable references, progressive display and mobile long-chat scrolling passed. That exploratory run later stopped on a harness-only mobile navigation selector. |
| Final isolated mobile/security rerun, `--live --skip-ai` | **30 passed, 0 failed**, without repeating already successful Gemini calls. |
| Distinct browser checks across the final segments | **38 distinct checks have passing results**. This is coverage across segments, not a claim that 38 tests ran in one process. |
| `python -B tools/test_ai_offline.py` | **162 + 18 = 180 passed**, 0 failures/errors; synthetic credentials, SQLite fixtures and mocked external services. |
| `npm test` | **104 passed**, 0 failed. |
| `gradlew.bat test --rerun-tasks --no-daemon` | **10 passed**, 0 failures/errors; all six Gradle tasks executed, BUILD SUCCESSFUL. |
| `npm run build:web -- --clear` | Passed. Final artifact API-target inspection also passed. |
| `git diff --check` | Passed; only existing Windows line-ending notices. |
| Secret/artifact protection | Both local env files and screenshot directory ignored/untracked; saved JSON/log/text artifacts passed a scan for configured secrets and JWT-shaped strings. |

Earlier failed provider attempts, harness issues and the reproduced expiry bug
are recorded above rather than represented as passes. Unit tests are distinct
from the real browser journeys. Physical Android/iOS devices and other browser
engines were not tested. Transient Gemini availability remains an external
dependency; a bounded retry and safe visible errors cannot guarantee uptime.

## Artifacts

All screenshots, sanitized results, service logs and PIDs are in the Git-ignored
directory **`.local-backups/browser-verification/`**. There are 22 screenshots,
including exploratory failures retained for review; all contain only synthetic or
public application content. No personal browser profile was used.

Useful current screenshots:

- `screenshots/01-home-desktop.png`
- `screenshots/02-dashboard-desktop.png`
- `screenshots/03-quote-desktop.png`
- `screenshots/04-simulated-receipt.png`
- `screenshots/05-history-desktop.png`
- `screenshots/06-ai-desktop.png` — final live knowledge answer
- `screenshots/07-ai-mobile.png` — final live answer and fixed mobile header
- `screenshots/08-dashboard-mobile.png`
- `screenshots/09-expired-session-login-mobile.png`
- `screenshots/10-quote-mobile.png`

`06-ai-tools-desktop.png` records the earlier complete multi-tool chat.
`07-ai-mobile-before-header-fix.png` is explicitly a before-fix screenshot.
`browser-results.json` contains the final 33-check run; `browser-ai-results.json`
retains the earlier complete AI segment; `browser-final-mobile-results.json`
contains the final 30-check mobile/security run. Saved network summaries contain
only local request methods/paths, never bodies, tokens or headers.

## Files changed in this task

- `backend/ai/agent.py`: native streaming, bounded transient retries, safe failures,
  and withholding signed draft tokens from model input.
- `backend/ai/agent_router.py`: incremental SSE queue, keepalives and cancellation.
- `backend/ai/gemini_client.py`: configurable request timeout and safe diagnostics.
- `backend/main.py`: safe startup document/chunk/retrieval-mode logging.
- `backend/test_hybrid_agent_offline.py`: five additional regression tests.
- `frontend/lib/client.js`: expired/malformed passive session handling.
- `frontend/screens/AIAssistantScreen.js`: constrained mobile header.
- `frontend/tests/ai_stream.test.cjs`: passive-session expiry regression.
- `tools/start_local_demo.py`: guarded hidden local-service launcher and PID/log
  recording; no schema changes or account creation.
- `tools/test_local_browser.cjs`: actual rendered-UI Playwright verification.
- This report and the cross-reference in `docs/LOCAL_AI_TESTING.md`.

No environment secrets, database connection settings, dependency manifests,
production deployment files or pre-existing unrelated workspace edits were changed
in this task. Playwright was installed only in the ignored test workspace.

## Open or restart the demonstration

**Services are already running. Open http://127.0.0.1:8081/ now.** Register a new
synthetic account through Get Started. The automated accounts have random test
passwords that were deliberately not displayed or retained.

From a stopped environment, the existing documented commands are:

```powershell
# Terminal 1, repository root
python -B tools/start_java_local.py

# Terminal 2
Set-Location backend
python -B -m uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log

# Terminal 3
Set-Location frontend
npm run web -- --clear
```

Alternatively, from the repository root with all three ports free:
`python -B tools/start_local_demo.py`. This leaves hidden services running and
saves their PIDs/logs in the ignored artifact directory. It refuses occupied
ports or a different database configuration. The helper's CI-mode Expo process
must be restarted after source edits; normal interactive Expo supports watching.

Future full browser runs require the ignored Playwright installation and an
installed Edge browser. Install the tooling, if absent, using
`npm install --prefix .local-backups/browser-verification --no-audit --no-fund --ignore-scripts playwright`.
Run `node tools/test_local_browser.cjs --live` for all prompts, or use
`--knowledge-only` / `--skip-ai` to reduce repeat API usage. These tests retain
synthetic fixtures. Backend startup embeds approved documents and live AI tests
can incur provider charges.

No blocking local application defect remains in the verified paths. Support
submission intentionally remains unavailable, and external Gemini interruptions
remain possible. No real payments or production-readiness certification is implied.
