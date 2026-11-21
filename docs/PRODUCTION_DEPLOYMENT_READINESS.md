# Production deployment readiness

Audit date: 2026-11-16. **BLOCKED: preparation completed; production deployment is not approved or performed.**

This assessment separates source inspection and local tests from production evidence.
No connections to existing local or production databases, persistent environment edits,
commits, pushes, or deployments were performed during this audit. Tests used disposable
in-memory SQLite fixtures. Existing local services were left running. No Gemini
generation or embedding requests were made during this audit.

## Discovery

| Item | Evidence and status |
| --- | --- |
| Public frontend | **PASS** `https://zettaremit-app.pages.dev` returned HTTP 200, title `ZettaRemit Simulation`. Its downloaded JS contains `https://zettaremit-app.onrender.com`, with no local API URL. |
| Public backend | **PASS, limited** `https://zettaremit-app.onrender.com/health` returned HTTP 200 on a second attempt after an initial timeout. HSTS and nosniff headers were present. Health is liveness, not database, Java, or AI readiness. |
| Public CORS | **PASS, limited** OPTIONS `/transactions/` from `https://zettaremit-app.pages.dev` returned 200, exact origin allowed, Authorization header permitted. This does not inventory other allowed origins. |
| Actual Render service identity | **PASS**, read-only MCP confirms workspace `My Workspace` (`tea-d8d35lmk1jcs738i7n2g`), service `ZettaRemit-App` (`srv-dbdv8o3ncjis73dkflag`), private repository `Revanth0701/ZettaRemit-App`, branch `main`, Docker/root context, Free plan, one instance, Oregon; auto-deploy `no`. Live deployment `dep-dbr7a46c6qcc73d225r0` runs `6c6881547e265ac9a7f5de416dd768f571afec31`. |
| Cloudflare project | Owner confirmed `Revanth0701/ZettaRemit-App` as the frontend deployment repository. Public hostname suggests project `zettaremit-app`; actual project configuration, deployment ID, production branch, build settings and auto-deploy behavior are **UNKNOWN**. |
| Git repositories | `origin` = public `Revanth0701/Zettaremit`; `prod-remote` = private `Revanth0701/ZettaRemit-App`. Do not push to the default remote by assumption. |
| Candidate base | Local `feature/gemini-ai-cleanup`, HEAD `5bbfde9446e0ea825a89f820832cfc74a3cf36a9`, plus uncommitted changes. GitHub confirms the same feature head in the private repository. Private `main` is merge commit `87f1f66729f208bf55ad6ceb02f98202923c1ad5`; its local tracked tree has no differences from HEAD before working changes. Neither SHA is verified as deployed. |
| CI/CD | No `.github` directory in local source or the inspected private repository's default-branch root. No Wrangler/Cloudflare config found locally. Render auto-deploy is independently confirmed disabled; Cloudflare production deployment settings remain unverified. |
| Provider access | GitHub read access works. Render MCP is connected and service/deployment inspection succeeded; it does not expose environment-variable or secret-file read tools. No Render, Cloudflare or Aiven credential variables were present in this process; `backend/.env.cloud` is absent. No production secrets were extracted from other applications or backups. |
| Production database | **UNKNOWN**. Aiven `zettaremit` is the intended template configuration, not verified deployed runtime identity. |
| Production Java | **UNKNOWN**. Source packages Java inside the FastAPI Docker container, supervised on authenticated loopback port 8082. No separate Java public service is needed by this design. Actual deployed packaging/connectivity cannot be inferred from source or `/health`. |

## Validation performed now

| Check | Result |
| --- | --- |
| Backend safe runner: `python -B tools/test_ai_offline.py` | **PASS**, 173 + 18 = **191 tests**, synthetic configuration/in-memory SQLite and mocked external providers. |
| Frontend: `npm test` in `frontend` | **PASS**, **104 tests**, zero failures. |
| Java: `gradlew.bat test bootJar --no-daemon --rerun-tasks` | **PASS**, **10 tests** across JUnit/Spock; boot JAR built. |
| Production-mode frontend export | **PASS**, explicit process `EXPO_NO_DOTENV=1`, `CI=1`, `EXPO_PUBLIC_API_URL=https://zettaremit-app.onrender.com`; `npm run build:web -- --clear --output-dir ../.local-backups/production-readiness/frontend-dist`. Exported bundle contains this HTTPS API and no local API/development database reference. URL correctness for future release still depends on provider identity confirmation. |
| Linux Python resolution | **PASS**, pip dry-run for CPython 3.12 x86_64, manylinux 2.28/2.27/2014 and abi3, project requirements plus container constraints. No packages installed. An initial overly restrictive manylinux2014-only probe could not resolve pandas; the corrected Bookworm-compatible probe succeeded. |
| Docker build | **PASS**, engine initially unavailable; Docker Desktop started locally and root Dockerfile built successfully, including Java tests and pinned Python dependency installation. Image ID `sha256:038819aea1ee140969ecf9d564db808cedbf1df738ff1e360316e72d110fe3b8`. Nothing published. |
| Isolated Linux runtime | **PASS**, network disabled, no host mounts or published ports, read-only root with disposable tmpfs, synthetic production configuration/CA/secrets, 512 MiB cap and one CPU. All **191 backend tests passed again** using disposable SQLite. Real container checks verified non-root execution, strict TLS setup, protected API/Java authentication, loopback-only Java and secret isolation, authenticated v2 calculation, bcrypt hash/verify, eight documents/39 chunks and offline BM25 fallback. Clean exit 0, no OOM. Startup **78.02 seconds**; measured peak **512.00 MiB reached the 512 MiB limit**, including the separate regression worker. Container OOMKilled=false does not establish that no memory pressure occurred. Capacity/headroom verification remains a blocker. No existing MySQL or live Gemini access. This is not a production traffic/load or hosted-embedding capacity guarantee. |
| npm audit after compatible fix | **WARNING**, 13 package findings: **1 high** (`image-size`), 11 moderate, 1 low, zero critical. `node-forge` patched 1.4.0 -> 1.4.3 within existing semver ranges; only its lockfile entry changed. No forced major upgrades or risk acceptance performed. Older audit counts in this repository are historical. |
| Git protection / source scan | **PASS, bounded**: local environment files and `.local-backups` ignored; no tracked secret environment, certificate, dump, database or CSV candidates found. Google key/private-key/GitHub-token/JWT pattern scan found only a JWT scrubber test fixture. Pattern checks are not a comprehensive secret/history audit. |
| Whitespace validation | **PASS**, `git diff --check`. |

Prior local browser, Java integration, Gemini generation and embedding results are recorded in
`LOCAL_AI_TESTING.md` and `LOCAL_BROWSER_VERIFICATION.md`, and supplied by the owner.
They are not new production validation. The old `tools/test_internal_e2e.py` posts a
transaction without the current quote contract and is not evidence for this release.
`backend/test_cloud_connection.py` was not run: it connects to cloud and still assumes
the obsolete `service_transactions` table.

Container probe/logs and the synthetic source staging are ignored under
`.local-backups/production-readiness/`; no test fixtures or credentials are baked into
the release image. Initial private probe attempts were corrected for a wrong expected
HALF_UP rounding value and Docker's copy behavior with a read-only container; the final
run above passed without application changes. The temporary containers were removed.

## Production database compatibility assessment

**BLOCKED / UNKNOWN**: Render identity is verified, but no readable runtime database configuration or TLS database access is
available. Production row counts, migration history, engines, triggers, collations,
backups and restore capability are unknown. Do not substitute either local database.

The AI working changes introduce **no SQLAlchemy model/schema changes relative to the
deployed source or inspected private main tree** (AST comparison of all three mapped classes passed). This does not prove that deployed code or its schema
matches that tree. Existing authentication hashes and transaction data must be preserved.

Current required model contract:

| Table | Expected columns and constraints |
| --- | --- |
| `users` | `user_id VARCHAR(50)` PK/index; `full_name VARCHAR(100)`, `email VARCHAR(150)`, `password_hash VARCHAR(255)` NOT NULL; unique/indexed email; nullable unique `phone_number VARCHAR(20)`; nullable Boolean `is_active`, datetime `created_at` with application defaults. |
| `user_verifications` | `verification_id VARCHAR(50)` PK/index; NOT NULL `user_id VARCHAR(50)` FK to users, ON DELETE CASCADE; nullable `document_type VARCHAR(50)`, `document_number VARCHAR(100)`, `document_status VARCHAR(50)`, `otp_code VARCHAR(10)`, Boolean `is_phone_verified`. Defaults are application-side. |
| `transactions` | `transaction_id VARCHAR(255)` PK/index; NOT NULL `sender_id VARCHAR(50)` FK to users (RESTRICT/NO ACTION); NOT NULL `recipient_name VARCHAR(255)`; NOT NULL DECIMAL(18,2) `gross_amount`, `fee_deducted`, `net_amount`, `recipient_amount`; NOT NULL DECIMAL(18,8) `exchange_rate`; NOT NULL `source_currency`, `target_currency` VARCHAR(3); nullable `idempotency_key VARCHAR(128)` ASCII/ascii_bin and `request_hash VARCHAR(64)`; unique `(sender_id, idempotency_key)`; nullable `status VARCHAR(255)`, indexed datetime `created_at`, with application defaults. |

No Java `service_transactions` table is required by the current stateless runtime.
Existing extra tables must remain untouched. Read-only audit must cover exact types,
nullability, defaults, PKs, unique/index definitions, FK actions, table engines,
character sets/collations, CHECK constraints, generated columns, triggers and extra
required columns. Check aggregate row counts privately; never export user rows into
release artifacts. Validate legacy money/currency semantics independently if any
data conversion is proposed.

`backend/check_cloud_schema.py` can read information_schema without importing the app,
but its default comparison includes obsolete Java mappings and does not establish every
collation/default/trigger requirement. Adapt/review a metadata-only audit for the three
current Python tables before using its results as a release gate. Never launch the app
as a schema discovery mechanism.

**Do not run `backend/migrations/20261023_01_review_only.sql`.** It assumes verified
legacy USD-to-INR history, renames/converts monetary fields, adds currency defaults,
and references a missing `tools/migration_preflight.py`. It is not a safe generic
migration for an unknown production schema. If mismatches exist, stop, prepare a
schema-specific additive plan and separately obtain explicit database approval.
Never infer financial history or simply set the revision marker to bypass verification.

## Production configuration checklist

All values below are required proposals/checks, not changes made to Render.
Inspect existing provider configuration securely; report presence/validation only.

| Settings | Required validation |
| --- | --- |
| `APP_ENV`, `DATABASE_MODE`, `LOCAL_CREATE_TABLES` | `production`, `cloud`, `false`, explicitly in process environment. Database mode is process-selected; a dotenv file cannot select cloud mode. No local files copied into images. |
| `SCHEMA_REVISION` | `20261023_01` only after independent compatibility audit; marker is an acknowledgement, not a migration. |
| `AIVEN_HOST`, `AIVEN_PORT`, `AIVEN_DATABASE`, `AIVEN_USER`, `AIVEN_PASSWORD`, `AIVEN_CA_PATH` | Present in authorized provider configuration, runtime destination independently confirmed. Intended database `zettaremit`; valid mounted Aiven CA `/etc/secrets/aiven-ca.pem`; hostname/CA verification and TLS >=1.2. Restricted runtime grants; no root/admin identity or local database names. Preserve valid production credentials. |
| `JWT_SECRET_KEY` | Preserve existing valid production signing key, >=32 bytes, independent from internal token and local test keys. HS256, issuer/audience validation and 900-second tokens already implemented. Rotation requires separate approval and affects sessions. |
| `INTERNAL_SERVICE_TOKEN` | Existing strong independent production token >=32 bytes shared only between Python and Java. Never reuse local token. Do not rotate automatically. |
| `INTERNAL_SERVICE_URL` | Supervised container forces authenticated `http://127.0.0.1:8082`; Java binds loopback, not public ingress. Confirm from running instance/logs and a safe calculation probe. |
| `CORS_ORIGINS` | Exact confirmed HTTPS Pages/custom origins, no wildcard. Read-only preflight check from actual frontend origin; public HTTPS certificate and no debug errors. |
| `ENABLE_AI_ASSISTANT`, `ENABLE_AI_AGENT` | Proposed `true`, `true` only in approved provider update/deployment. Blueprint currently keeps both `false`; importing unchanged blueprint will not enable the upgrade. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Production key present/restricted; production project entitlement/quota verified. Proposed model `gemini-3.1-flash-lite`; local success does not prove production-key access. |
| `RAG_EMBEDDING_PROVIDER`, `RAG_EMBEDDING_MODEL` | Proposed `gemini`, `gemini-embedding-001`; local semantic model verified previously; production access unknown. |
| Retrieval settings | `RAG_BM25_CANDIDATES=5`, `RAG_VECTOR_CANDIDATES=5`, `RAG_FINAL_CHUNKS=3`, `RAG_RRF_K=60`, `RAG_BM25_FALLBACK=true`, `RAG_SYNC_SECONDS=60`. |
| Runtime bounds | `GEMINI_REQUEST_TIMEOUT_SECONDS=30`, `AGENT_MODEL_RETRIES=1`, `AGENT_MAX_TOOL_CALLS=8`, `AGENT_MAX_ITERATIONS=5`, `AGENT_TIMEOUT_SECONDS=45`, `AGENT_TOOL_TIMEOUT_SECONDS=8`, `AGENT_RATE_PROVIDER=exchange_rate_api`. |
| Cloudflare build | Existing project/repo/production branch verified; framework None, root `frontend`, `npm ci && npm run build:web`, output `dist`, `NODE_VERSION=22`; `EXPO_PUBLIC_API_URL=https://zettaremit-app.onrender.com` after identity confirmation. Do not upload local `.env.local` or any server secrets. Build from approved commit with cleared cache as necessary. |

## AI and availability review

**PASS in code/tests:** server-derived active owner on transaction tools; no model-selected
user ID; bounded pagination with total independent of returned page count; native tool
allowlist and validated arguments; no transfer-write tool; deterministic estimates;
signed expiring owner-bound support drafts; confirmation cannot submit because no backend
exists. UI/knowledge identify simulation and indicative daily rates, not real money or
tick-live quotes. Logs use bounded diagnostics instead of raw provider errors/results.

Bundled Markdown is copied into the container by the Docker allowlist. Expected source
index: eight documents, 39 chunks. Startup builds an in-memory snapshot; query-triggered
refresh checks after 60 seconds; unchanged embeddings reused within a worker. Read-only
container source is supported. To change knowledge in immutable hosted source, release
new reviewed files; there is no remote content synchronization or training. Cold starts
re-embed documents and lose caches/history. Embedding startup failure permits BM25;
refresh failure preserves the last complete hybrid snapshot; query embedding failure
falls back to lexical retrieval. Production mode must be verified in sanitized startup logs.

AI uses one concurrent request, IP limit 15/minute, user limit 10/minute and 50/rolling
day, max question 1000 characters and generation output 512 tokens per model iteration.
Limits, sessions and caches are **per-process memory**, reset on restart and are not
a durable billing cap. Several generation/tool/embedding calls can occur per question;
startup embeddings are outside question budgets. The supervisor disables proxy headers;
proxy-derived client IP may therefore be shared, causing coarse throttling behind Render.
Do not blindly trust forwarded IP headers to bypass this. Verify under real ingress.
AI IP/user tracking dictionaries have no global eviction bound; monitor memory and review
before unrestricted public traffic. Obtain verified provider quota/billing controls,
alerting and an agreed spend limit; this audit does not establish a hard spend ceiling.

Render Free plan in source has no demonstrated production traffic/hosted embedding capacity
or availability margin. The 512 MiB offline synthetic container passed functionally but hit its memory limit; the actual
Render plan, quotas, cold starts with hosted embeddings and concurrent traffic still need
verification. Any paid service/plan change requires explicit approval.
Zero downtime is not established by the current liveness probe.

## Blocking gates and next actions

1. Render access, service identity and deployment baseline are now verified. Securely inspect remaining
   env groups/secret mounts and actual runtime database identity. Docker/root settings,
   deployed SHA, branch, plan and auto-deploy settings have been verified. Obtain Cloudflare Pages read access or have the owner
   verify corresponding project/branch/build/deployment IDs. Do not create new services.
2. Match runtime DB configuration to the intended Aiven service and database. Use a
   least-privilege TLS metadata-only session from an authorized environment. Verify
   production schema against the contract above and capture aggregate baseline counts.
   Stop on incompatibility; no DDL approval has been given.
3. Verify current backup retention and restore procedure; perform a restore rehearsal in
   an independently approved isolated target before accepting backup readiness. Never
   restore over production or either existing local database. See rollback plan.
4. Resolve or explicitly review dependency findings. The Docker build, no-network runtime,
   pinned Linux regression and synthetic resource checks now pass. Verify actual provider
   capacity/cold-start behavior after access and approval; retain the measured image digest.
5. Confirm production Gemini key/model entitlements and quotas, secret separation, CORS,
   internal Java auth and ingress behavior. Do not copy development keys to production.
6. Update the manifest with exact deployed baseline IDs, verified backup reference,
   production repository/branch and candidate commit SHA after authorized commit creation.
   Review exact file allowlist and rescan staged diff/history for secrets; exclude `.vscode`,
   local artifacts and data. Request explicit approval before commit/push under the owner's
   safety rule, and before any auto-deploy branch push or deployment trigger.
7. Present final Render/Pages actions and exact rollback targets for deployment approval.
   Only after approval, deploy backend first, verify safe read/Java/AI checks, then publish
   frontend. Any migrations, data writes, secret rotations or paid changes need separate
   explicit approval. No blanket approval is implied by this report.
8. After deployment, use a designated safe test account for owner-approved registration,
   simulated transfer, pagination/count, streaming, isolation, unsupported support and
   mobile checks. Review sanitized logs and baseline integrity. Do not claim success
   from liveness alone or create test records without the applicable approval.

See [PRODUCTION_ROLLBACK_PLAN.md](PRODUCTION_ROLLBACK_PLAN.md) and
[PRODUCTION_RELEASE_MANIFEST.json](PRODUCTION_RELEASE_MANIFEST.json).

## Access required to finish the audit

Use the **Render** ChatGPT plugin, display description “Build and deploy apps and agents
on Render,” found in plugin discovery, and select only the workspace containing the existing
backend. It is connected at this audit. The required operations for this phase are
read-only: list workspace/services, inspect the existing service details/repository/branch/
runtime, list deployments and commit IDs, and read recent sanitized logs and resource
metrics. No create, update, deploy, delete, secret rotation or billing operations are
authorized. Configure per-action confirmation for any write capability if offered.

These are operational permissions requested for this task, **not verified OAuth scope
names**. The current tool inventory supports service/deploy/log/metric reads but no environment-variable, secret-file or external Aiven MySQL reads; OAuth consent scope names were not inspected. Render's MCP includes write capabilities, and workspace selection scopes its
actions; do not describe an unrestricted credential as read-only. If the integration
cannot expose environment/secret-mount configuration safely, the owner or an authorized
operator must verify it through the dashboard and provide only presence/validation results.
Never paste API keys or environment values into chat. See the official
[Render MCP documentation](https://render.com/docs/mcp-server).

Render account access alone does not provide access to external Aiven MySQL. The database
audit additionally needs an authorized TLS route plus a least-privilege metadata/SELECT
account supplied through a private secret mechanism, or an authorized operator can run
the reviewed read-only checks. Backup inspection/restore evidence requires appropriate
Aiven account access separately. Cloudflare needs read access to the existing Pages
project settings and deployment history; its repository is now owner-confirmed, but its
branch and deployment IDs remain unverified. No production write access is needed to
complete these remaining discovery checks.


## Release checklist and security disposition (2026-11-16)

Recommendation: **NO-GO** pending the unchecked production gates below. Existing AI source
hashes match the prior manifest: Hybrid RAG, owner-scoped tools, pagination/counts and
streaming were preserved. No production writes, commit, push, merge or deployment occurred.

- [x] Read-only Render identity/source/deploy discovery; auto-deploy disabled.
- [x] Complete working diff reviewed; exact file allowlist and worktree hashes in manifest.
- [x] Compatible `node-forge` patch applied in `frontend/package-lock.json` only.
- [x] Backend (191), frontend (104), Java (10), production export and Docker build rerun.
- [x] Docker allowlist includes agent modules, pinned SDK and all eight reviewed documents.
- [x] Current models match deployed model source; no new AI model DDL proposed.
- [ ] Independently confirm actual production database and full schema/constraints/collations.
- [ ] Verify retained production backup and successful isolated restore rehearsal.
- [ ] Review/resolve remaining `image-size` high and moderate/low findings before release.
- [ ] Secure operator verification of environment checklist, production quotas/spend limits,
      embeddings, Java connectivity and authenticated SSE/agent tests using a designated account.
- [ ] Approve setting existing Render HTTP health-check path to `/health`: MCP currently
      reports an empty path (TCP-only configured check), despite the blueprint's `/health`.
- [ ] Record Cloudflare production deployment ID/build settings and rollback artifact eligibility.
- [ ] Explicit approval for exact commit/push and deployment actions.

Security detail: npm resolved `node-forge@1.4.3` without changing direct dependency versions,
overrides, or other lockfile entries. It satisfies Expo CLI/code-signing `^1.3.3` requirements.
The remaining `image-size@1.2.1` is pulled by `metro@0.83.3` via Expo SDK54. The registry has
no patched 1.x version; fixed versions start at 2.0.3. Metro's `getAssetData` passes filesystem
paths to `image-size`, while v2 removes synchronous path input. Its default export still
exists, so the concrete compatibility obstacle is the path API, not just import syntax.
A forced override would risk asset export failures. Keep it unchanged until a separately
validated Metro/Expo upgrade or maintained backport is approved. SDK54's requested docs URL
redirects to latest; this audit relied on installed versioned source for this call contract.

The high advisories concern malformed ICNS/JXL/HEIF parsing causing unbounded loops:
[ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
[JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
The applicable attack surface is the build/development host processing untrusted assets.
The deployed Pages site serves static output and FastAPI does not load these Node packages;
this reduces runtime exposure but does not resolve the build vulnerability. Build only
reviewed source/assets; do not expose Metro or accept untrusted build assets. No risk
acceptance is implied. Registry recommends an Expo major upgrade for the remaining
moderate/low dependency paths (`glob`, `minimatch`, `deepmerge` and affected Expo ancestors);
these were not forced into an SDK54 patch release.

Production `/ai/health` returned 200 with `provider=gemini`, model `gemini-3.1-flash-lite`,
`enabled=true`, `model_ready=true`. Deployed source shows this readiness flag checks key
presence only, without a billable API call. Therefore API key presence is evidenced but
validity/model entitlement/quota is not. Current production commit has no new agent or
hybrid modules. Proposed production flags and embedding settings remain unverified.
Recent Render memory queries returned empty series; no measured production capacity claim
is made. A bounded error-log query was inspected without printing raw messages; it cannot
establish absence of errors outside its sampled window.

Required commit groups (exact paths/hashes in the manifest): runtime AI (`backend/ai`
changes plus `backend/main.py`), SDK constraint, frontend client/SSE/screen, patched frontend
lockfile, safe templates/blueprint, backend/frontend regressions, validation tools and release
reports. `.vscode`, environment files, databases, fixture staging, browser captures,
container logs, node_modules, Java build output and frontend export are excluded. Unchanged
Dockerfile, supervisor, model modules and eight knowledge documents are already committed
and must remain in the release tree; they need no redundant file changes.

Reproduce current container checks with `docker build -t zettaremit-review:local .` then
`python -B tools/test_release_container.py`. This runner uses synthetic production settings,
network isolation and temporary SQLite only; it verifies pip dependencies, agent imports/tools,
Java integration/security, knowledge files and Linux regressions. Evidence remains ignored.
Current build/functional checks passed; memory headroom is not approved.

## Explicit candidate file allowlist

Only these paths are proposed for review/commit; nothing was staged or committed.
Local launch/live-test helpers are optional developer tooling, not runtime dependencies.

```text
backend/ai/agent.py
backend/ai/agent_router.py
backend/ai/gemini_client.py
backend/ai/hybrid.py
backend/ai/rag_service.py
backend/ai/router.py
backend/main.py
backend/requirements-container.lock
backend/test_agent_history_offline.py
backend/test_hybrid_agent_offline.py
deployment/.env.example
docs/AI_UPGRADE.md
docs/LOCAL_AI_TESTING.md
docs/LOCAL_BROWSER_VERIFICATION.md
docs/PRODUCTION_DEPLOYMENT_READINESS.md
docs/PRODUCTION_RELEASE_MANIFEST.json
docs/PRODUCTION_ROLLBACK_PLAN.md
docs/RELEASE.md
frontend/lib/aiStream.js
frontend/lib/client.js
frontend/package-lock.json
frontend/screens/AIAssistantScreen.js
frontend/tests/ai_stream.test.cjs
render.yaml
tools/start_local_demo.py
tools/test_ai_offline.py
tools/test_local_ai_integration.py
tools/test_local_browser.cjs
tools/test_release_container.py
```
