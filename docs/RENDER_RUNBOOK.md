# Current publication authorization - 2026-11-24

The owner explicitly authorized **pushing the reviewed release branch and opening
its PR with documented backup limitations**, superseding the earlier requirement
that private provider backups be complete before pushing. This waiver applies only
to push/PR publication. **Merge, Render restart, provider changes and all deployments
remain prohibited without separate approval.** Residual dependency risks remain
accepted for the current prototype, subject to reviewed mitigations.

Pre-push review: fetched canonical main is still 8ada74a. Application commit
**ec402c726a956a33020caf4873c1b6bc191afe96** has that parent, exactly the 29 reviewed
changed paths, and its entire 170-file Git tree matches the preserved recovery
source archive after Git normalization. Recovery checksums and all 178 original
workspace files are unchanged. No application code is added by this follow-up.

Cloudflare controls are **owner-confirmed**: preview deployments None, automatic
production deployments disabled, production branch main, effective Node 22.23.4.
No independent Cloudflare API inspection is available. Render auto-deploy/PR
previews remain off; its reported live commit is still 8ada74a, not the TiDB release.
The checked remote baseline contains no repository .github workflows.

The private Render export is the **newly saved TiDB configuration**, not the old
Aiven baseline. It matches the locally tested DB host/port/database/runtime account
and password without disclosing them. The old 8ada74a code requires AIVEN_* and
cannot use DB-only settings; do not activate the saved configuration with that
build. /health returned 200/ok but does not establish DB readiness or active env.

Exact hosted-embedding settings for the reviewed implementation:

```dotenv
RAG_EMBEDDING_PROVIDER=gemini
RAG_EMBEDDING_MODEL=gemini-embedding-001
```

The export lacks both names. Provider defaults to none (BM25-only); model defaults
to gemini-embedding-001. Set both explicitly only during an approved configuration
change to preserve the reviewed Gemini embedding integration. Generation remains
GEMINI_MODEL=gemini-3.1-flash-lite, with GEMINI_API_KEY supplied privately.

**Documented backup/recovery limitations accepted for push/PR only:**

- Private backup remains partial: original Aiven environment and aiven-ca.pem
  content are not backed up; linked Render group completeness and full Pages
  environment/bindings backup completeness remain unconfirmed.
- Actual Render tidb-ca.pem mount/readability and pending configuration activation
  are unverified. These remain deployment checks; no secret file has been uploaded
  by the assistant. Keep DB_CA_PATH=/etc/secrets/tidb-ca.pem and strict TLS/hostname
  validation; never substitute the old Aiven certificate or an admin account.
- Render's existing Aiven-era deploy is not a verified TiDB rollback target. The
  local TiDB-compatible image passed live tests and archive reload, but cold-engine
  and provider rollback have not been exercised. A local image cannot be deployed
  from its unpublished local tag. First hosted cutover requires an approved
  TiDB-compatible redeploy/configuration recovery plan, not a database/data rollback.
- Pages deployment 06190243 identifies a prior production rollback candidate;
  its full ID/retention and compatibility must be checked before relying on it.

The provider backup status remains honestly marked incomplete. No waiver is
recorded as completion, and no provider setting or secret value is published.
The current authorization supersedes earlier pending-gate statements below;
those are preserved dated evidence. Record the actual PR URL/head SHA outside
this pre-publication commit once the authorized publication succeeds.

---

# Latest owner verification - 2026-11-24

The owner confirmed production build log **nodejs@22.23.4**. Pages preview controls
were previously All non-Production branches; the **owner changed them to None**.
Automatic production deployments remain disabled and production branch remains main.
The assistant made no hosting changes. These confirmations close the prior
Cloudflare preview/Node verification gaps.

**Do not push until private provider backups are complete and verified**, per the
owner's latest instruction. The protected folder now contains
`render/ZettaRemit-App.env`; safe parsing found 22 keys, no parse errors or
duplicate keys. The owner confirmed this is the **newly saved TiDB configuration**,
not the original Aiven baseline. Its DB host/port/database/user/password match the
locally tested restricted runtime configuration (values not disclosed). JWT and
internal secrets meet the checked length/independence requirements. It does not
establish which configuration is active in the existing process.

## Read-only Render save-impact check - 2026-11-24

- Render still reports commit **8ada74afe061a1eb21ba9718b2f33406b7c2399a**, deployment
  **dep-dc0f5bh7lnhs738fecsg**, status **live**, originally deployed November 21.
  No newer deployment is listed; no build/deploy is queued or running in the result.
  Auto-deploy and PR previews remain off; health-check path remains empty.
- Events returned no records since November 23. Runtime logs nevertheless show
  startup completion at 2026-11-23T22:44:29Z and 2026-11-24T05:03:11Z on different
  instances. Therefore no new deployment is observed, but a restart/Free-tier
  wakeup cannot be ruled out or attributed to the owner's save. Do not equate an
  empty event list with proof that no process ever restarted.
- Direct HTTPS GET /health returned **200**, status **ok**, in **0.47 seconds**.
  An earlier request inheriting environment proxy settings timed out after 90
  seconds; direct access succeeded. This does not establish a backend outage or
  prove DB connectivity/authentication. Health is liveness only.
- Source inspection proves **8ada74a requires AIVEN_*** and does not load DB_*.
  A DB-only environment is **incompatible with that build**. Saved values are not
  proof of runtime activation. Do not use Save and deploy / deploy latest main to
  activate them with the old Aiven build; coordinate any activation only with the
  separately approved TiDB-compatible release commit. No deployment/restart or
  hosting change was performed during this inspection.
- The export matches the reviewed non-secret DB/TLS-path/production/schema values
  and includes required private keys. Actual Render tidb-ca.pem availability remains
  unverified. Exported RAG_EMBEDDING_PROVIDER and RAG_EMBEDDING_MODEL are absent:
  the candidate defaults to provider **none** and model gemini-embedding-001. To
  preserve the reviewed hosted-embedding behavior, the planned approved configuration
  needs RAG_EMBEDDING_PROVIDER=gemini and explicit RAG_EMBEDDING_MODEL=gemini-embedding-001.
  No variables or Gemini models were changed during inspection.

The aiven-ca.pem content backup remains absent, as do confirmations of Render
linked-group and complete Pages environment/bindings backups. The newly saved
TiDB export is not a pre-change Aiven restoration point. No private values were
written into this documentation. Diagnostic summaries are stored only under the
ignored protected provider backup folder.

Application commit ec402c726a956a33020caf4873c1b6bc191afe96 and documentation commit
270b7680bedf3c4cee97118e7ac92375dc5fabff remain local. This follow-up is uncommitted;
no push or PR has occurred. Prior pending-preview statements below are dated evidence
superseded here; provider backup completion is still a mandatory publication gate.

---

# Release publication preparation - 2026-11-24

**Owner accepted the documented residual dependency risks for this prototype**, subject
to the reviewed mitigations. Permission now covers a separate documentation commit,
pushing release/tidb-reconciled-20261123 and opening a PR into main. It does **not**
authorize merge, provider configuration changes or any production/preview deployment.
Application commit remains ec402c726a956a33020caf4873c1b6bc191afe96.

A fresh fetch confirmed canonical origin/main is still
8ada74afe061a1eb21ba9718b2f33406b7c2399a. Read-only Render inspection reconfirmed
repo/main, Oregon Free, Docker context '.', ./Dockerfile, auto-deploy and PR
previews off, blank health-check path, and live deploy dep-dc0f5bh7lnhs738fecsg.
There are no repository .github workflows in the reviewed remote baseline.

Private backup location (ignored; current-user/SYSTEM ACL):
`.local-backups/provider-config-20261124/` in the original workspace.
Render service/recent-deployment metadata was saved from the connector; Cloudflare
public settings were saved from the owner's Dashboard verification. **This is a
partial backup**, not an environment/secret restore point. The available Render
connector cannot read/export environment values, linked-group values or secret-file
contents; no Cloudflare connection, authenticated CLI or provider API credentials
were available. Provider discovery returned no Cloudflare plugin. The owner was
asked to save those private exports directly into the protected local folder,
never paste credentials into chat, and confirm Pages preview controls/Node version.
No secret-bearing provider export or complete restoration was falsely asserted.

**Publication gate:** Cloudflare preview behavior and effective production Node 22
remain unconfirmed. Production auto-deploy being disabled does not establish that
release-branch pushes/PRs cannot deploy previews. Do not push/open the PR while this
could violate the owner's no-deployment instruction. If previews cover the release
branch, request a specific owner decision; do not change settings or rely on a
skip-ci bypass. Private provider backup completion also remains pending. The risk
acceptance closes the dependency-acceptance gate only, not these execution gates.

Existing recovery image/source archive checksums and the original 178-file working
state must remain unchanged. No application implementation changes or fresh live
DB/AI writes are part of this documentation/publication step. The earlier proposal
below is retained as dated planning; the current authorization/status above
supersedes its 'no push approval' and 'risk acceptance pending' statements.

---

# Controlled TiDB production release - owner verification 2026-11-24

**Status: local release commit created; no push, merge, hosting change or deployment approved.**
Application candidate: **ec402c726a956a33020caf4873c1b6bc191afe96**, branch
`release/tidb-reconciled-20261123`, parent **8ada74afe061a1eb21ba9718b2f33406b7c2399a**.
Exactly 29 reviewed files were committed. Original workspace and recovery snapshots
remain preserved. This November 24 documentation update is **uncommitted**, not a
change to that application commit; it needs separate commit approval if published.
The current section supersedes precommit status/uncaptured-setting statements and
proposed commit commands in the dated preparation record below.

## Owner-verified current hosting baseline

These are owner-reported Dashboard observations from 2026-11-24, not a new API
inspection or an applied configuration change. **There is no repository mismatch.**

| Setting | Existing Cloudflare Pages | Existing Render backend |
| --- | --- | --- |
| Project/service | zettaremit | ZettaRemit-App; srv-dbdv8o3ncjis73dkflag |
| Repository | Revanth0701/Zettaremit | Revanth0701/Zettaremit |
| Production branch | main | main |
| Current production commit | 8ada74a | 8ada74a |
| Current deployment URL | https://06190243.zettaremit.pages.dev | https://zettaremit-app.onrender.com |
| Stable production URL | https://zettaremit.pages.dev/ | https://zettaremit-app.onrender.com |
| Root/context | frontend | Repository root |
| Build | npm ci && npm run build:web | Dockerfile ./Dockerfile; default supervisor CMD |
| Output / build system | dist / Version 3 | Docker / Oregon / Free |
| Production auto-deploy | Disabled | Off |
| PR previews | Not supplied; verify before release-branch push or PR | Off |
| Frontend API | EXPO_PUBLIC_API_URL=https://zettaremit-app.onrender.com | Not applicable |
| Health check | Not applicable | Currently empty; set /health only after approval |
| Current database configuration | No database credentials belong here | AIVEN_*; existing secret file aiven-ca.pem |

The Pages URL identifies short deployment ID **06190243**, not its full API UUID.
Capture the full deployment ID/project ID and retention state privately before
release. Prior read-only Render baseline was dep-dc0f5bh7lnhs738fecsg at 8ada74a;
reconfirm the actual current deployment ID before any mutation. Preserve all
unrelated variables, domains, headers, redirects, bindings and existing URLs.
The older `zettaremit-app` Pages project remains untouched.

Version 3 alone does not confirm Node 22. The candidate was tested on Node 22;
check the effective production NODE_VERSION/build log and prepare **NODE_VERSION=22**
if needed, with configuration approval. Pages preview settings are separate from
production auto-deploy and remain a pre-push gate, not an assumed disabled setting.
[Pages branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/).

## Confirmed candidate configuration

Use the exact environment table in the dated record below. Non-secret values are:

```dotenv
APP_ENV=production
DATABASE_MODE=cloud
LOCAL_CREATE_TABLES=false
SCHEMA_REVISION=20261023_01
DB_PORT=4000
DB_NAME=zettaremit
DB_CA_PATH=/etc/secrets/tidb-ca.pem
CORS_ORIGINS=https://zettaremit.pages.dev,https://zettaremit-app.pages.dev
ENABLE_AI_ASSISTANT=true
ENABLE_AI_AGENT=true
GEMINI_MODEL=gemini-3.1-flash-lite
RAG_EMBEDDING_PROVIDER=gemini
RAG_EMBEDDING_MODEL=gemini-embedding-001
RAG_BM25_FALLBACK=true
RAG_FINAL_CHUNKS=3
RAG_SYNC_SECONDS=60
```

Preserve additional valid existing CORS origins. Copy **DB_HOST, full DB_USER and
DB_PASSWORD only from the private tested backend/.env.cloud into Render's secret
configuration**, without logging them. Use the DNS endpoint, never its IP. Local
safe comparison on November 24 confirmed port/database/runtime-account selection
and a parseable CA with certificate/hostname validation and minimum TLS 1.2; no
new live database or Gemini requests were needed for this documentation update.

Preserve existing valid JWT_SECRET_KEY, INTERNAL_SERVICE_TOKEN and GEMINI_API_KEY;
JWT/internal secrets must be independent and at least 32 bytes. Do not rotate
sessions accidentally. Never copy private configuration into Pages or Git. The
runtime account is `<instance-prefix>.zetta_runtime`, REQUIRE SSL, with only:
users SELECT/INSERT, user_verifications INSERT, transactions SELECT/INSERT.
No DDL, DELETE, global/admin or GRANT OPTION privileges; no Java database account.

Preserve existing bounded RAG/agent overrides. Template defaults, if absent:
RAG_BM25_CANDIDATES=5, RAG_VECTOR_CANDIDATES=5, RAG_RRF_K=60,
AGENT_MAX_TOOL_CALLS=8, AGENT_MAX_ITERATIONS=5, AGENT_TIMEOUT_SECONDS=45,
AGENT_TOOL_TIMEOUT_SECONDS=8, AGENT_RATE_PROVIDER=exchange_rate_api.
Render supplies PORT. Keep Docker CMD unchanged; the supervisor sets authenticated
Java loopback at 127.0.0.1:8082. Do not publish Java or supply a Java datasource.

Create **tidb-ca.pem** as a Render Secret File containing the complete verified
`backend/certs/tidb-ca.pem`; the runtime path must be **/etc/secrets/tidb-ca.pem**.
The existing aiven-ca.pem is not a substitute. No private key, build argument or
CA copied into an image layer. The committed Dockerfile adds UID 10001 to group
1000; local read-only CA/TLS tests passed. Verify actual runtime mount readability
after deployment. [Docker secret-file guidance](https://render.com/docs/docker-secrets).

Confirmed TiDB allowlist: **74.220.48.0/24 and 74.220.56.0/24**, both authorized;
public endpoint enabled, no allow-all rule. Preserve the authorized local rule.
Outbound DNS/TCP 4000 to DB_HOST and HTTPS 443 for rates/Gemini are required.
Browser-to-backend is HTTPS; /health is liveness, not proof of DB/AI readiness.

## Controlled sequence - plan only, separate approvals required

1. **Accept risk and capture recovery configuration.** Explicitly accept the
   remaining one high and 11 moderate npm entries (see DEPENDENCY_SECURITY_REVIEW.md).
   image-size 1.2.1 can hang a build on crafted images; minimatch 9.0.9/10.2.5 can
   amplify malicious patterns. glob 13.0.7's compatible repair passed its regression
   but remains scanner-flagged; inherited Expo entries are build-chain findings.
   Build trusted inputs in bounded isolated jobs; serve only dist, no tooling/dev
   server/source maps. These leaves were absent from the reviewed browser export
   and Python/Java image. No breaking upgrades or automatic acceptance.
   Privately back up Render service/group environment values and provenance,
   secret-file contents/references (including Aiven CA), IDs, commands, health path,
   domains and both providers' settings/deploy IDs. Store outside Git with restricted
   access. Preserve local image/source archives and checksum record; record timestamp.
   The hosting configuration backup has **not** been performed by this documentation
   update. Confirm Pages preview behavior/Node version and retained rollback artifact.
2. **Publish Git only after push approval.** No new application commit is required.
   This documentation follow-up may be committed separately only if approved;
   do not amend ec402c7 implicitly. From the isolated release worktree, verify clean
   reviewed source/index, repeat credential/inventory checks and fetch origin/main.
   If remote moved from 8ada74a, stop for renewed reconciliation. For the currently
   committed candidate, the proposed explicit push is:

   ```powershell
   git push origin ec402c726a956a33020caf4873c1b6bc191afe96:refs/heads/release/tidb-reconciled-20261123
   ```

   This publishes a review branch, not main. Check that Pages preview deployment is
   disabled for it or explicitly approved **before** pushing or creating a PR.
   Open a PR into canonical main; merge only with separate approval and required
   checks. No force-push or push to prod-remote. Record the actual merged main SHA
   as **RELEASE_SHA** and review its tree; both providers must use that same SHA.
3. **Prepare the existing Render service after configuration/deployment approval.**
   Confirm no queued deployment, unchanged repo/main/context/CMD and auto-deploy off.
   Prepare DB_*, runtime secrets, CORS/AI settings above and tidb-ca.pem, then /health.
   Use **Save only** for variables/secret files where offered; they activate on the
   next deploy. Do not choose Save and deploy with the old Aiven build. Inspect
   each save action: if it will deploy immediately, stop and coordinate that action
   within the explicitly approved release; never accidentally deploy old/new code
   with a partial configuration. No Blueprint import/new service/predeploy SQL.
   Preserve AIVEN_* and aiven-ca.pem through initial verification, or remove them
   only as an approved coordinated change after a secure backup; the new cloud
   loader ignores AIVEN_*. Later approved cleanup must not alter shared groups.
   [Render configuration save options](https://render.com/docs/configure-environment-variables).
4. **Deploy Render first, after deployment approval.** Manually deploy the specific
   approved RELEASE_SHA through the existing service; monitor its exact build and
   deployment ID to live status, not merely accepted/queued. Verify DB_*/CA/grants,
   /health, loopback authentication, synthetic auth/rates/quote/simulation/replay/
   history isolation and Gemini with unchanged generation/embedding models. Recheck
   CORS for canonical/retained legacy origins and rejection of an unrelated origin.
   No customer records or secrets in diagnostics. Keep the frontend baseline if
   backend acceptance fails. Free-tier memory/headroom remains an operational risk.
5. **Deploy canonical Pages only after backend acceptance and frontend approval.**
   Keep automatic production deployments disabled. Trigger a new Git-backed build
   of main at RELEASE_SHA, using the recorded root/command/dist/API URL and Node 22.
   The documented API route is POST /accounts/{account_id}/pages/projects/zettaremit/deployments
   with multipart field branch=main, using a privately authenticated Pages Write
   token. A supported Dashboard action that explicitly builds the same main SHA is
   also acceptable. Do not retry baseline 06190243 assuming it selects the new SHA.
   The API builds branch HEAD; commit_hash is associated metadata, not an assumed
   checkout pin. Verify main still equals RELEASE_SHA immediately before triggering
   and verify the returned source SHA, production environment, non-skipped state
   and terminal success. Stop on any mismatch. No API call or new token is needed
   now; authenticated deployment capability/account ID remain execution prerequisites.
   [Pages deployment API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/).
6. **Post-deployment acceptance.** Record both deployment IDs and common source SHA.
   Verify https://zettaremit.pages.dev/ in a normal browser, built API URL, security
   headers/HTTPS, canonical and legacy CORS, registration/login/auth rejection,
   live rates, signed quote/3% decimal fee, SIMULATED transaction, idempotent replay,
   owner history/isolation, identity-simulation disclosure and authenticated Gemini
   JSON/SSE completion. Keep synthetic records. Check real Render CA permissions,
   strict hostname validation, TiDB destination/runtime grants, memory/restarts,
   cold starts and model quota. /health alone cannot approve the release. Keep
   automatic deploys off and record configuration versions and acceptance results.
7. **Rollback on failed acceptance, only with recovery approval.** Frontend: use
   the retained successful production deployment corresponding to 06190243 /
   https://06190243.zettaremit.pages.dev after resolving its full ID; verify API
   compatibility. This is an identified candidate, not an executed rollback drill.
   [Pages rollback requirements](https://developers.cloudflare.com/pages/configuration/rollbacks/).
   Backend: do **not** assume native rollback to Aiven-era 8ada74a is TiDB-compatible.
   It can reuse old deploy environment/health/command settings; shared groups have
   separate state. [Render rollback configuration](https://render.com/docs/rollbacks).
   For first cutover use an approved standard redeploy/configuration repair of the
   tested TiDB RELEASE_SHA and preserved DB_*/CA/runtime settings. After the first
   hosted TiDB acceptance, record that deploy as the future verified baseline.
   The local recovery image passed live TiDB tests and archive reload on the same
   Docker engine; cold-engine and hosting-provider restoration remain untested.
   Do not switch back to Aiven, drop/recreate tables, restore old data, delete records,
   weaken TLS, use admin credentials or run historical SQL as application rollback.

No new tests were required for documentation-only edits. Earlier candidate evidence
remains: frontend 122, backend 217, Java 10, Linux-container 217, four container
scenarios and 19 live container smoke checks passed. One initial direct Gemini
failure followed by successful retry/full container run remains recorded below.
Deployment is not authorized or declared complete by these results.

---

# Historical preparation record - 2026-11-23

The following is retained dated evidence. Its precommit statements and formerly
missing hosting settings are superseded by the owner verification above.

# Render production preparation — 2026-11-23

**Current review: source reconciliation completed locally; release remains unapproved.**
The isolated worktree is `.local-backups/tidb-release-20261123` under the original
workspace, branch `release/tidb-reconciled-20261123`, based on fetched canonical
`origin/main` **8ada74afe061a1eb21ba9718b2f33406b7c2399a**. No commits or staged files.
The original feature branch, working files and private configuration remain intact;
an ACL-protected file backup, binary patch and Git bundle are retained locally.
The owner selected existing Cloudflare project `zettaremit`, URL
https://zettaremit.pages.dev/, and Revanth0701/Zettaremit main for both hosts.
Render already uses that repository/main. Leave `zettaremit-app` unchanged.
Earlier test/review sections below are dated evidence; the reconciliation section
and current inventory supersede the old 61-file proposal. Provider deployment
snapshots, Pages build/auto-deploy confirmation and explicit dependency-risk
acceptance are still required before publishing. No commit/push/deploy is authorized.

Release-blocker follow-up: a restricted TiDB account was created with user
authorization and the private local cloud configuration now uses it. No live
Render configuration update, commit, push, historical migration or deployment
was performed. Preserve all existing working
tree edits when selecting a release. This is a fresh TiDB database; historical
Aiven data recovery or transfer is not required.

## Verified target and container

Read-only Render inspection in the user-confirmed My Workspace identified:

- Existing service: `ZettaRemit-App`, `srv-dbdv8o3ncjis73dkflag`, Oregon, Free.
- URL: `https://zettaremit-app.onrender.com`.
- Repository: `https://github.com/Revanth0701/Zettaremit`, branch `main`.
- Root directory empty; Docker context `.`, Dockerfile `./Dockerfile`, no command
  override. Auto-deploy is off. Actual health-check path is currently empty.
- Local render.yaml now matches the existing name/region and specifies `/health`.
  Do not create a second service or assume importing a Blueprint adopts the existing
  service. Prefer updating this existing service after approval; inspect any
  Blueprint plan before approving its application.

The image runs Python 3.12 and Java 21 in one container, as before. FastAPI owns
TiDB persistence; Java is an authenticated stateless loopback calculator on 8082.
The supervisor starts Java, binds FastAPI to `0.0.0.0:$PORT`, uses one worker,
propagates shutdown and exits if either child fails. No predeploy migration or
startup DDL is configured. Docker's CMD remains the supervisor. Render performs
HTTP health checks; there is no Docker HEALTHCHECK instruction. `/health` is
liveness only and does not establish database, rates or Gemini readiness.

Built and tested image: `zettaremit-review:local`, image ID
`sha256:7ace11387477cc90523c5ebf96b486eeea67f0239d10b01c4a6d2d717788de3c`
(approximately 861 MB reported by Docker). Java's 10 tests ran during the image
build. Dependencies are constrained by backend/requirements-container.lock.
Base image tags remain mutable; this ID identifies the actual local tested build.

## Exact environment changes for the existing service

Set values in Render's Environment panel, retaining unrelated settings. Never
paste private values into this document, Git, a command transcript or a ticket.

| Key | Value or source |
| --- | --- |
| `APP_ENV` | `production` |
| `DATABASE_MODE` | `cloud` |
| `LOCAL_CREATE_TABLES` | `false` |
| `SCHEMA_REVISION` | `20261023_01`, acknowledging the audited existing schema; this does not authorize historical SQL |
| `DB_HOST` | Exact TiDB public endpoint DNS hostname from the private tested configuration; do not substitute its IP |
| `DB_PORT` | `4000` for the currently tested endpoint |
| `DB_NAME` | `zettaremit` |
| `DB_USER` | Configured `<instance-prefix>.zetta_runtime`; read its full name only from private backend/.env.cloud |
| `DB_PASSWORD` | New runtime account password, provided only as a Render secret |
| `DB_CA_PATH` | `/etc/secrets/tidb-ca.pem` |
| `JWT_SECRET_KEY` | Strong independent secret, at least 32 bytes; preserve an existing valid production secret unless deliberately rotating sessions |
| `INTERNAL_SERVICE_TOKEN` | Different strong secret, at least 32 bytes |
| `CORS_ORIGINS` | Add `https://zettaremit.pages.dev`; retain existing approved HTTPS origins, including `https://zettaremit-app.pages.dev` during cutover to preserve the unchanged legacy site's API access. Prepared example: `https://zettaremit.pages.dev,https://zettaremit-app.pages.dev`. Never replace unrelated valid origins blindly. |
| `ENABLE_AI_ASSISTANT` | `true` |
| `ENABLE_AI_AGENT` | `true` |
| `GEMINI_API_KEY` | Existing valid Gemini key through Render secret configuration |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite`, unchanged |
| `RAG_EMBEDDING_PROVIDER` | `gemini`, matching the existing working integration |
| `RAG_EMBEDDING_MODEL` | `gemini-embedding-001`, unchanged |
| `RAG_BM25_FALLBACK` | `true` |
| `RAG_FINAL_CHUNKS` | `3` |
| `RAG_SYNC_SECONDS` | `60` |

Keep existing bounded agent settings or the defaults in deployment/.env.example.
Let Render supply `PORT`. Do not add Java database configuration, publish 8082,
or override `INTERNAL_SERVICE_URL`: the supervisor sets authenticated loopback.
Remove obsolete `AIVEN_HOST`, `AIVEN_PORT`, `AIVEN_DATABASE`, `AIVEN_USER`,
`AIVEN_PASSWORD`, `AIVEN_CA_PATH` and any unused old database URL from the target
service and relevant environment groups after confirming they are not shared
with another application. The cloud loader accepts only DB_*; production does
not read backend/.env.cloud. A new offline test verifies that isolation.

For existing services, Blueprint `sync: false` does not update secret values.
Omitted Blueprint variables are not automatically deleted. Populate/remove keys
explicitly in the existing service. [Render Blueprint reference](https://render.com/docs/blueprint-spec).

## Certificate availability

Create the Render Secret File named **tidb-ca.pem** with the complete contents
of the verified local backend/certs/tidb-ca.pem. Do not upload a private key.
Render mounts it at `/etc/secrets/tidb-ca.pem` for Docker runtimes. The CA is a
trust certificate, not a password; it is nevertheless excluded from Git and
the Docker context. It is not copied into any image layer. No certificate is
needed at image build time. [Render secret-file documentation](https://render.com/docs/configure-environment-variables#secret-files).

Dockerfile now adds application UID 10001 to supplementary group 1000, following
[Render's Docker runtime permission guidance](https://render.com/docs/docker-secrets#accessing-secret-files-at-runtime).
A local container test proved that this UID can parse a CA owned by root:1000
with mode 0640. A read-only mount of the actual CA also supported successful
TiDB application operations from the built image. TLS requires trusted CA and
hostname verification and minimum TLS 1.2; there is no insecure fallback.

Secret-file Save Changes can start a deploy. Do not upload/save the file until
the deployment action is approved and all environment/network settings are ready.
Use **Save only** for environment-variable preparation when available; it does
not activate changes until deployment. The actual Render-mounted file and its
permissions still need verification during the approved release.

## Network requirements

Allow outbound DNS resolution and TCP 4000 to the exact TiDB DB_HOST endpoint.
Allow outbound HTTPS 443 to `open.er-api.com` for reference rates and
`generativelanguage.googleapis.com` for Gemini generation/embeddings. Browser
clients reach only the public HTTPS API. Java port 8082 remains loopback-only.

In the existing service's **Connect > Outbound** panel, obtain **every** current
Oregon outbound range and allow those ranges in TiDB's Networking firewall.
Render can use any address in its region's ranges; allowlisting one observed
egress address is insufficient. For TiDB Starter/Essential, translate each CIDR
to its inclusive start/end IP range if the firewall UI requires ranges. Keep a
local test IP only as long as needed, and remove a broad allow-all rule after
validating the narrow rules. Do not permit all cloud-provider addresses merely
because the database happens to be hosted there.

The owner copied these exact ranges from the existing service's Connect > Outbound
panel on 2026-11-23. This is owner-confirmed Dashboard evidence; the connector
does not expose outbound ranges for independent API verification.

| Render outbound CIDR | TiDB inclusive start | TiDB inclusive end |
| --- | --- | --- |
| `74.220.48.0/24` | `74.220.48.0` | `74.220.48.255` |
| `74.220.56.0/24` | `74.220.56.0` | `74.220.56.255` |

The owner confirmed the active TiDB firewall rules on 2026-11-23:

| Rule | Allowed addresses |
| --- | --- |
| `Render_Backend_1` | `74.220.48.0` through `74.220.48.255` |
| `Render_Backend_2` | `74.220.56.0` through `74.220.56.255` |
| `Local_Development` | `73.37.253.52` only |

The public endpoint remains enabled and `Allow_all_public_connections` has been
removed. This is owner-confirmed Dashboard state; SQL access cannot enumerate
TiDB Cloud firewall rules. After the change, the local restricted account
successfully authenticated with a negotiated TLS cipher, required certificate
validation and hostname verification. The metadata audit completed with zero
critical findings. Local API smoke results after this change are recorded below.
This agent did not change network rules. Render-origin connectivity still needs
an approved deployed smoke test; local connectivity does not prove Render egress.
Render's public HTTP inbound `0.0.0.0/0` setting is not its database egress range.
[Render outbound ranges](https://render.com/docs/outbound-ip-addresses),
[TiDB Starter/Essential firewall](https://docs.pingcap.com/tidbcloud/configure-serverless-firewall-rules-for-public-endpoints/).

## Database permissions and index finding

Created `<instance-prefix>.zetta_runtime` through the authorized admin connection
with a generated high-entropy password and REQUIRE SSL. SHOW GRANTS on the runtime
connection verified exactly the following table privileges, no role grants, no
administrative/global privileges and no GRANT OPTION. Global USAGE grants no
privileges. SHOW CREATE USER verified the server-side REQUIRE SSL setting.
The original administrator account was neither altered nor removed.

Verified runtime grants:

| Table | Runtime privileges | Application need |
| --- | --- | --- |
| `zettaremit.users` | `SELECT, INSERT` | Authentication, registration and user lookup |
| `zettaremit.user_verifications` | `INSERT` | Atomic simulated verification registration |
| `zettaremit.transactions` | `SELECT, INSERT` | History, idempotency lookup and simulated inserts |

Do not grant UPDATE, DELETE, DDL, global privileges or GRANT OPTION. Use a separate
admin/audit identity for schema and grant inspection; do not put it on Render.
The full runtime name and password are now in ignored backend/.env.cloud. The
admin configuration was preserved in ignored
.local-backups/tidb-private/admin-env-before-runtime.bak. That directory and the
new cloud configuration have Windows ACLs limited to the current user and SYSTEM.
Keep the backup, pending credential file and provisioning helper private and local.
No interactive password entry or account Dashboard action was necessary.
Host and container live smoke tests now pass with the restricted account. SELECT
on mysql.user and user_verifications was denied with MySQL 1142, as expected;
application registration still inserts the simulated verification successfully.
Do not expand these grants for the old row-count connection probe, which requests
SELECT on user_verifications even though the application does not require it.
[TiDB privilege management](https://docs.pingcap.com/tidb/stable/privilege-management/).

The extra `fk_1` index on user_verifications.user_id is **non-unique** and supports
the foreign key/lookups. It introduces no extra uniqueness restriction or write
failure condition. Keep it. The existing primary and verification_id index were
also visible. Schema audit still returns 0 critical, 1 minor, 0 unverified.
service_transactions is not required by the stateless Java runtime.

## Test evidence and release limits

Host production-mode and built-container TiDB smoke tests passed registration,
login, wrong-password rejection, missing/invalid JWT rejection, live rates,
Java-backed quotes, decimal 3% fees, persisted SIMULATED transactions, idempotent
replay, owned history, cross-account isolation and authenticated AI. Live Gemini
generation succeeded with the unchanged model. A separate live Gemini embedding
request also passed with gemini-embedding-001 and 3072 dimensions. The current
restricted-account host and container runs retained four new synthetic accounts,
four simulated verification records and two simulated transactions. Earlier
synthetic records were preserved. No existing rows or schema were deleted or
changed by these tests.
FastAPI was exercised through its ASGI TestClient with the real Java HTTP service
and real TiDB/rate/Gemini connections. Separate isolated HTTP container probes
exercise the actual running Uvicorn/supervisor.

All remaining container probes passed on the same image:

| Probe | Result |
| --- | --- |
| Isolated ASGI integration | 41 synthetic transfers, 80 concurrent Java calculations; graceful exit 0 |
| Real Uvicorn HTTP + ephemeral SQLite fixture | 41 synthetic transfers, 80 concurrent calculations; graceful exit 0 |
| Java child failure | Supervisor stopped the other child and exited 1 as expected |
| API child failure | Supervisor stopped the other child and exited 1 as expected |
| Release probe | Linux regression suite, pip check, security and AI module checks passed; graceful exit 0 |

No probe was OOM-killed. Ordinary isolated load peaks were approximately 300?307
MiB. Evidence is in docs/CONTAINER_RESULTS.json, CONTAINER_HTTP_RESULTS.json,
CONTAINER_JAVA_FAILURE_RESULTS.json and CONTAINER_API_FAILURE_RESULTS.json.
Ignored .local-backups/production-readiness contains safe host/container live
smoke summaries, the release-container summary and detailed test logs.

Host backend regression runner passed **199 + 18 = 217 tests**. The release
container runner also passed **217 Linux tests**, pip check, eight approved
knowledge documents / 39 chunks, Java integration, password hashing and security
checks. The image build passed 10 Java tests. The loopback integration helper
passed after updating its fixture to request the required accepted quote.

Credential checks found no tracked private env/certificate/key files, no tracked
matches for configured private passwords/keys, and no common Google/GitHub/AWS
token/private-key signatures. Staging was empty. Environment examples contain
placeholders. This verifies the current tracked working tree/index, not every
historical commit or external log. Production files and the actual current
Render secret configuration remain inaccessible through the connected tools.

Frontend `npm test`: **122 passed, 0 failed**, including the new dependency-security
regression. Root cause of the earlier disclosure failure: the UI copy
revision removed the explicit non-storage statement while retaining simulated
verification and disabled document inputs. Restored the complete non-collection,
non-verification and non-storage disclosure at document selection. The existing
step-seven wording and all security tests remain unchanged. Existing UI/AI work
was preserved. `npm run build:web` passed. The generated local dist is excluded
from the release inventory; rebuild with
EXPO_PUBLIC_API_URL=https://zettaremit-app.onrender.com for an approved frontend
release instead of publishing an export built from local development settings.
The restored disclosure was also visibly verified in a headless browser at
1280px and 390px. Both checks confirmed no document/file input and made zero API
writes. The version-specific Expo documentation URL now redirects to newer docs;
this change only restores UI text and introduces no SDK or framework API changes.
Final dependency review: [DEPENDENCY_SECURITY_REVIEW.md](DEPENDENCY_SECURITY_REVIEW.md)
lists all 12 affected package entries, installed and patched versions, four
advisories and their applicability. Applied the compatible glob 13.0.6 to 13.0.7
cancellation backport; exactly one lockfile package changed, with no major upgrade.
The new behavioral regression fails on unpatched 13.0.6 and passes on 13.0.7.
The audit still reports one high and 11 moderate entries: its glob range includes
the source-verified backport, and image-size/minimatch remain unresolved. No
advisory was suppressed. Vulnerable leaf modules are absent from the reviewed
exported web bundle and the Python/Java container, but build/dev exposure remains.
The residual build-tool risks need remediation or explicit release acceptance;
this review does not record acceptance. Keep uploads disabled and build trusted
assets/source only. Exact parent-package and production/development distinctions
are documented in the linked review, rather than inferred from npm's prod label.

Render CLI is not installed. render.yaml passed validation against Render's
current public JSON Schema, but platform-aware CLI validation remains unrun.
No deployed health/readiness or real Render secret-file/allowlist test has run.
Free-plan availability and memory limits remain relevant: isolated load probes
fit 512 MiB, but the combined Linux regression workload reached the 512 MiB cgroup
limit in one run without a container OOM kill. This includes separate test
processes and is not steady-state application load. A serial rerun with
memory.events evidence is recorded below. Do not assume ample capacity on Free.
This is not a sustained production capacity or availability SLA.
In-process throttling/state and proxy client-IP behavior also require validation
on Render before exposing the service to broad traffic.

Earlier follow-up verification: 217 backend tests passed on the host and in the
Linux release container, 10 Java tests passed with an offline rebuild, and all
121 frontend tests plus the web export passed. The restricted-account schema
audit completed with 0 critical, 1 minor and 0 unverified findings. Both restricted
live smoke runs passed all 19 checks. All four isolated container probes passed,
including graceful exit 0 and expected exit 1 after Java/API child termination.
The serial release rerun peaked at 469344256 bytes (about 448 MiB), with every
memory.events counter, including max, oom and oom_kill, equal to zero.
The preceding concurrent run's 512 MiB peak remains recorded as capacity evidence,
not hidden by the rerun. No production capacity guarantee is inferred.

Final secret scans across tracked and nonignored untracked files found no matches
for the configured runtime/admin credentials or API/signing secrets, no common
credential/private-key signatures, and no tracked private environment/key/CA
files. All private backups/configurations remain ignored. Git diff --check passed;
the index is empty. Actual Render settings were reconfirmed read-only: repository
Revanth0701/Zettaremit, branch main, Oregon Docker service, no command override,
auto-deploy off and health-check path still blank. Configure /health only in the
approved deployment step. Actual runtime secret-file availability and a public
HTTPS smoke test remain post-approval verification tasks.

After removal of allow-all access, a fresh local production-mode smoke run using
the restricted account passed all 19 checks: Java startup, health, authentication
rejection, two registrations/logins, wrong-password rejection, live reference
rates, Java-backed quotes, decimal fees, a persisted SIMULATED transaction,
idempotent replay, owned history/isolation, live unchanged-model Gemini generation
and the authenticated AI endpoint. This run retained two additional synthetic
accounts, two simulated verification records and one simulated transaction.
No existing records or tables were deleted or changed. The schema audit again
reported 0 critical, 1 minor and 0 unverified findings.

Local technical preparation is complete and the firewall-confirmation blocker is
closed. Approval review must still cover the explicit full application candidate,
the documented dependency findings and Free-plan capacity limits. Applying Render
environment/secret-file/health settings, deploying the approved commit and testing
the public HTTPS service from Render remain explicitly approval-gated actions.
No deployed health/readiness claim is implied by these local checks.

Final dependency-pass validation: 122 frontend tests, production web export,
217 host backend tests and 10 Java tests passed. A clean isolated npm ci installed
760 packages from the updated lockfile, and the security regression passed on
that installation. The rebuilt production image above passed runtime inspection
(no Node/npm/frontend tree), the Linux release probe (217 tests and pip check)
and real-HTTP fixture (41 simulations and 80 concurrent calculations). The current
release-test workload reached 512 MiB with 640 memory max events but zero oom or
oom_kill events and graceful exit 0; the HTTP fixture peak was about 358 MiB.
Earlier serial capacity evidence remains recorded above. Do not treat a passing
test run as capacity acceptance for the Free plan.
The frontend test suite and web export also passed under an isolated Node 22
runtime matching the configured deployment major; the system Node installation
and application package declarations were not changed.

The final approval target remains https://github.com/Revanth0701/Zettaremit,
branch main, service ZettaRemit-App / srv-dbdv8o3ncjis73dkflag in Oregon. Read-only
inspection reconfirmed these values, auto-deploy off and the still-blank health
path. The exact complete candidate file list is docs/RELEASE_FILE_REVIEW.json;
the dependency review also lists the seven files changed by this security pass.
No staging, commit, push, live Render configuration change or deployment occurred.

## File review and release boundary

docs/RELEASE_FILE_REVIEW.json records each modified/untracked file, disposition,
reason and SHA-256 fingerprint. tools/prepare_release_manifest.py generates this
inventory and an ignored .local-backups/release-review/include-paths.txt; neither
operation stages, commits, pushes or deploys anything. Its --verify mode rejects
fingerprint drift, newly unreviewed paths and staged files outside the allowlist.

The candidate preserves the existing AI agent/hybrid modules, authentication,
registration, API response and frontend navigation/streaming functionality.
Many files that were untracked on the original feature branch are already tracked
on remote main and are therefore unchanged baseline files in this release worktree.
They remain included in the repository and build; the changed-path inventory is
not an exhaustive list of runtime dependencies.

Do not stage local .vscode settings or generated CONTAINER JSON evidence. Keep
private environment/certificate files, credential backups/provisioning scripts,
databases, logs, node_modules, build outputs and dist out of Git. Historical
reports and optional local browser/demo helpers already tracked upstream remain
unchanged, as individually reviewed below. Excluding their old local edits does
not remove them from the target repository. The original feature/gemini-ai-cleanup
branch and working state are preserved. The isolated release branch is
release/tidb-reconciled-20261123; both hosts deploy canonical main only after the
separately approved release/PR process. Both Git indexes remain empty.

## Final pre-release source and artifact review

This section supersedes earlier assumptions about the production frontend.
The owner selected the **existing zettaremit Pages project**, connected to
Revanth0701/Zettaremit, with intended production URL https://zettaremit.pages.dev/.
Keep the separate zettaremit-app Pages project and its existing URL/configuration
untouched. Do not reconnect, migrate, rename or recreate either project. Do not
use Revanth0701/ZettaRemit-App as a release repository.

| Item | Verified current evidence | Intended release target / action |
| --- | --- | --- |
| Render backend | Connector: ZettaRemit-App, srv-dbdv8o3ncjis73dkflag; repository Revanth0701/Zettaremit, main, Oregon, root context, Dockerfile ./Dockerfile, auto-deploy off | Keep the existing service, repo, branch and https://zettaremit-app.onrender.com |
| Render live baseline | dep-dc0f5bh7lnhs738fecsg, commit 8ada74afe061a1eb21ba9718b2f33406b7c2399a | Capture this baseline; its TiDB rollback compatibility is not established |
| Canonical Pages frontend | Owner verified existing zettaremit project is connected to Revanth0701/Zettaremit | Keep this project and https://zettaremit.pages.dev/; main is the chosen production branch |
| Legacy Pages frontend | Owner verified zettaremit-app is connected to Revanth0701/ZettaRemit-App | Leave project, URL and settings unchanged; never push this release to that repository |
| GitHub canonical main | GitHub API: 8ada74afe061a1eb21ba9718b2f33406b7c2399a | Base the release on current origin/main, not the old local branch base |
| Local working branch | feature/gemini-ai-cleanup at 5bbfde9446e0ea825a89f820832cfc74a3cf36a9, with uncommitted work | Seven commits behind canonical main; preserve this worktree while preparing a target-relative candidate after approval |
| Pages production branch/build controls | Chosen target is main; actual branch/build/output/auto-deploy values were not independently available through the account connection | Confirm in existing zettaremit project before any push; desired root frontend, build npm ci && npm run build:web, output dist, Node 22 |

Cloudflare's current API documents in-place source updates, and its Git guide
documents Wrangler publishing to an existing Git-integrated project with automatic
builds disabled. Neither procedure is needed here: the owner identified an
already correctly connected canonical project. No new hosting service or source
reconnection is proposed. These capability checks do not establish the project's
current branch/build settings. [Project edit API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/edit/),
[Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/).

### CORS and frontend API alignment

- Backend application code already reads CORS_ORIGINS, requires explicit HTTPS
  origins in production, and allows Authorization, Content-Type and Idempotency-Key.
  No application-code change is needed. The prepared environment example adds the
  canonical origin while retaining the legacy origin during cutover. Preserve any
  other existing approved HTTPS origins rather than replacing the entire list.
- After initial cold-start timeouts, read-only public OPTIONS probes returned
  **200 with the exact matching Access-Control-Allow-Origin for both**
  https://zettaremit.pages.dev and https://zettaremit-app.pages.dev. Current live
  CORS therefore already permits both tested origins; avoid a needless provider
  change if the actual configuration matches. No browser credentials or customer
  request bodies were sent.
- frontend/lib/api.js already has production fallback
  https://zettaremit-app.onrender.com. Set EXPO_PUBLIC_API_URL to that same URL in
  the canonical Pages production build. Never point the frontend at a pages.dev
  URL as its API, and never put database/Gemini/signing credentials in EXPO_PUBLIC
  variables. Preserve existing unrelated project environment variables/bindings.
- Public Render /health returned 200. An automated GET to the canonical frontend
  returned **403**; this is an incomplete frontend access check, not proof that
  the app renders correctly or that a particular Cloudflare policy caused it.
  Verify normal-browser access and the project's current deployment/access settings
  before release acceptance. Do not weaken access/bot/security policies just to
  make an automated probe pass.
- A local FastAPI/Starlette preflight check using the prepared example returned
  200 for both approved origins and 400 for an unrelated origin. The restricted
  TiDB account and strict certificate/hostname verification remain configured.

### Historical input review: 61 included files and 19 excluded artifacts

All inventory fingerprints matched before this review. All 61 included paths
were checked against their role and the current application: backend database,
AI/authentication and schema validation; frontend screens, shared fields,
navigation/streaming and package/lock dependencies; deployment templates; tests;
and current release documentation. Required relative frontend runtime imports
resolve within tracked baseline files plus the included paths. The prior clean
install, frontend export, Java build and container validation establish packaging
for the tested local tree. They do not validate a future reconciled commit.

The 19 excluded paths are one editor configuration, four generated container
reports, seven historical/local reports, four optional browser workflows and
three local helpers. A critical limitation was found: **14 of these paths are
already tracked in canonical remote main**. They are the seven historical/local
reports, four optional browser workflows and three helpers. Exclusion means
"do not stage their local changes as part of this release", not "erase them from
GitHub". No removal of already tracked files is authorized or performed. The
editor file and four generated container JSON reports are not in that target tree.
Docker's allowlist excludes docs, frontend and tools from the runtime image;
Pages must publish only frontend/dist, never a repository/archive or review export.

The entire local tracked baseline and canonical main tree were checked for private
environment/certificate/key/database/CSV/dump/log file types and known configured
secret values. No such files or matching credentials were found. Synthetic test
fixtures and the baseline Gradle wrapper JAR are deliberate source/build inputs,
not customer records or compiled application output. Private env files, TiDB CA,
credential backups, local databases, generated logs/maps/exports and installed
dependencies remain excluded. This does not certify every historical commit or
every external provider log. No existing database record was read or changed by
this final repository review.

### Reconciled source and retained upstream artifacts - 2026-11-23

Fetched origin/main at 8ada74a and inspected all seven upstream commits:
412fae4 (initial application), b4dbfaf (professional README/ignore cleanup),
f2b5b76 (Gemini/RAG/streaming), 2a6f4af (integration merge), 78b2df3 (unified
Hybrid RAG), 8430c47 (approved registration/AI/frontend), 8ada74a (reconciliation
merge). This is merged history, not seven patches to replay onto the old branch.
The isolated branch starts at main, preserving every upstream commit.

Per-file three-way comparison used original base 5bbfde9, the backed-up reviewed
working files and fetched main. Identical upstream application changes were
retained without reapplying them. Nine overlapping/new-file differences were
reviewed manually: registration backend/frontend tests, login/registration screens,
deployment env example, render.yaml, release documentation and container probe.
Upstream README sections and stronger ignore rules remain; README changes are
limited to current TiDB/Gemini provider labels, canonical URL and release links.
Render repo/main/dockerContext fields were explicitly preserved. No main merge,
rebase, reset, commit, push, deletion or provider update was performed.

The current `RELEASE_FILE_REVIEW.json` is regenerated relative to this main-based
worktree. It lists **29 included changed/new release paths**, **four excluded generated
container reports**, and content fingerprints;
unchanged upstream runtime files remain part of the full Git tree. Its separate
`retained_upstream_artifacts` list fingerprints all 14 previously excluded paths:

- Historical reports: LOCAL_AI_TESTING.md, LOCAL_BROWSER_VERIFICATION.md,
  PRODUCTION_DEPLOYMENT_READINESS.md, PRODUCTION_RELEASE_MANIFEST.json,
  PRODUCTION_ROLLBACK_PLAN.md, REPOSITORY_UNIFICATION_INVENTORY.json and
  REPOSITORY_UNIFICATION_PLAN.md under docs/.
- Optional mocked/local browser workflows: approved_ux.browser.cjs,
  navigation.browser.cjs, registration.browser.cjs and signup_inputs.browser.cjs
  under frontend/tests/.
- Local helpers: tools/start_local_demo.py, tools/test_local_ai_integration.py
  and tools/test_local_browser.cjs.

Decision: **retain all 14 unchanged**. The dated/proposed reports are historical
and superseded by this runbook; they are not deployment instructions or current
approval evidence. The workflows/helpers are opt-in local validation, not runtime
assets. Content/credential scanning found no configured secrets or customer records
requiring sanitation. None requires removal for application functionality. Any
future removal from tracking needs separate owner approval; no deletion is included.
The remaining five former exclusions (editor settings and four generated reports)
are not introduced into the candidate. Generated test reports may appear locally
but are excluded explicitly by the inventory and Docker allowlist.

### Validation of the reconciled candidate

- Clean frontend installation: 760 packages; Node 22 tests **122/122**, including
  the unchanged security-disclosure assertion and cancellation regression.
  Node 22 production web export passed with the intended Render API URL.
- Backend synthetic runner: **199 + 18 = 217 passed**. Java offline rerun and
  bootJar: **10 tests passed**. Required frontend relative imports resolve within
  the candidate Git tree; package.json is unchanged from main.
- Production Docker build passed, including Java tests. Linux release probe:
  **217 tests**, pip check, non-root/strict TLS, auth and Java/AI module checks,
  graceful stop all passed. Image ID:
  `sha256:0881be47d2d8f94dc453e89fdb66e92a66ec63b392ebb808105c98ec0adf1118`.
- Container real-HTTP SQLite fixture passed **41 simulated transactions and 80
  concurrent calculator calls**, including owner isolation and idempotency.
  Peak memory 381.91 MiB; no OOM kill, graceful exit 0. Linux full-suite workload
  reached 512 MiB with 780 memory-max events, zero oom/oom_kill events. Capacity
  under real hosting traffic remains unproven; monitor Free-tier headroom.
- All four isolated container scenarios passed: ordinary synthetic lifecycle,
  real-HTTP fixture, Java-child failure and API-child failure. Graceful normal
  shutdown returned 0; either child failure caused supervisor exit 1 as designed.
  No OOM kills occurred. Generated reports are excluded from release staging.
- Reconciled-source metadata-only TiDB audit passed: **0 critical, 1 minor,
  0 unverified**. The extra nonunique index is informational for functionality;
  no index/table DDL was performed. Stateless Java requires no service_transactions.
- Host live journey passed 18/19 initially: direct Gemini generation returned
  GeminiServiceError while authenticated AI succeeded. The exact cause was not
  established; a targeted unchanged-model retry passed. The **rebuilt production
  container then passed all 19 live checks**, including generation and authenticated
  AI, restricted-account registration/login/auth, live rates/quote/3% decimal fee,
  simulation/idempotency/history isolation. This supersedes the initial partial
  run but does not promise provider availability. Synthetic rows are retained.
- Container CA access passed as UID 10001 in group 1000 with a root:1000 0640
  test copy; strict TLS/hostname checks remain on. Actual Render mount/network
  connectivity must still be verified after approved provider configuration.
- Credential review scanned all candidate tracked/nonignored source against five
  configured private secret values and key/token/private-key signatures: no
  matches or private env/certificate/database/CSV/log artifacts. Original backup
  validation found **178/178 files unchanged**, including four private files;
  neither worktree has staged files. This is current-tree scanning, not a claim
  about all historical Git objects. Private backup contents are never release inputs.
- Fresh npm audit still reports **1 high, 11 moderate, 0 low/critical**. Explicit
  release-risk acceptance is required for image-size 1.2.1 and minimatch 9.0.9 /
  10.2.5 build/development exposure and inherited Expo findings. glob 13.0.7's
  compatible repair is tested but still scanner-flagged. See the package/advisory
  table in DEPENDENCY_SECURITY_REVIEW.md. No breaking upgrade or suppression.
  Mitigate with trusted code/assets/patterns, reviewed lockfile, bounded isolated
  builds and no published dev server, Node tooling or source maps.

## Exact commit, push and deployment procedure — not executed

Commit, push, merge, provider configuration and deployment are distinct approvals.
Do not infer permission for later actions from an earlier approval. First confirm
the canonical zettaremit Pages project's production branch and both production and
preview automatic-build behavior. A branch push or PR can publish a preview even
when production auto-deploy is off. Obtain approval before pausing any integration;
leave the legacy project alone. Render already has auto-deploy off.

Local reconciliation is already complete. Run subsequent commands **inside the
isolated worktree**, not the original feature workspace:

```powershell
Set-Location 'C:\Users\Admin\OneDrive\Desktop\ZettaRemit\.local-backups\tidb-release-20261123'
git branch --show-current # release/tidb-reconciled-20261123
git remote get-url origin # https://github.com/Revanth0701/Zettaremit.git
git fetch origin main
$reviewedBase = '8ada74afe061a1eb21ba9718b2f33406b7c2399a'
if ((git rev-parse origin/main).Trim() -ne $reviewedBase) {
    throw 'Remote main moved: refresh reconciliation, inventory and tests first.'
}
git diff --check
```

Do not recreate the worktree, copy the original files wholesale, transplant old
branch history or force-push. The main-based candidate is uncommitted so there is
no final candidate commit SHA yet.

Only after review of that reconciled candidate and explicit commit approval:

```powershell
python -B tools/prepare_release_manifest.py
python -B tools/prepare_release_manifest.py --verify
git add --pathspec-from-file=.local-backups/release-review/include-paths.txt
git diff --cached --check
git diff --cached --name-status
git diff --cached
python -B tools/prepare_release_manifest.py --verify
# Stop for the final staged-diff/secret review before the following command.
git commit -m "Prepare verified ZettaRemit TiDB production release"
$candidate = (git rev-parse HEAD).Trim()
```

Then, only after explicit push approval and verification that no unapproved
production/preview deployment will be triggered:

```powershell
git push origin HEAD:refs/heads/release/tidb-reconciled-20261123
```

Open a review PR from release/tidb-reconciled-20261123 to **main** in
**Revanth0701/Zettaremit**. Merge only after explicit merge approval and required
checks. Respect branch protection; do not bypass it or push to prod-remote.
Record the actual merged main SHA, which can differ from the candidate SHA.
Both providers must deploy that same approved merged main SHA.

Before approved provider changes, capture current service/project IDs, production
deployment IDs/SHAs, build settings and private environment/group/secret-file
references securely. Cloudflare canonical production deployment ID and actual
build/branch settings remain uncaptured. Preserve unrelated settings and every
existing live URL. Existing services/projects only; no Blueprint import or
project recreation.

For the approved Render release, keep the current repo/main and existing Docker
root/context/CMD. Use the DB_* and least-privilege account table above, verified
CA Secret File tidb-ca.pem mounted at /etc/secrets/tidb-ca.pem, UID 10001 with group
1000, certificate/hostname checks enabled, DATABASE_MODE=cloud and
LOCAL_CREATE_TABLES=false. Do not upload a private key or admin credentials.
Preserve valid JWT/internal/Gemini secrets and the existing Gemini models. Keep
Java loopback-only. Set health-check path **/health**; it is currently blank in
Render, although the application endpoint exists and responds. Do not add a
predeploy SQL command. Save-only env preparation does not activate changes;
secret-file or other saves can trigger a deploy, so coordinate these only after
deployment approval. [Environment configuration](https://render.com/docs/configure-environment-variables),
[Docker secret files](https://render.com/docs/docker-secrets).

Deploy the exact merged SHA through the existing Render service's manual
"Deploy a specific commit" flow. Monitor that deploy ID until live; a trigger
response is not readiness. A restart does not activate newly saved configuration.
Keep auto-deploy off. [Render deploys](https://render.com/docs/deploys).

For the existing canonical **zettaremit** Pages project, verify branch main,
root frontend, build npm ci && npm run build:web, output dist, Node 22 and
EXPO_PUBLIC_API_URL=https://zettaremit-app.onrender.com. Preserve other environment
variables, bindings, domains, headers and redirects. Publish an approved build of
the same main SHA only after the backend passes verification. Confirm the project
and deployment IDs and the resulting https://zettaremit.pages.dev/ URL. Never
publish local dist built with development env values or ignored source-map exports.
No change to zettaremit-app is part of this sequence.

## Rollback procedure and compatibility gate

Capture and verify a rollback target **before** deploying. The live Render
baseline is dep-dc0f5bh7lnhs738fecsg / 8ada74a. It predates the TiDB configuration
changes and is **not yet a verified TiDB-compatible rollback**. Native Render
rollback can reuse the target deploy's environment variables, commands and health
path; it can consequently revive Aiven-era configuration. Environment groups and
other external state have separate behavior. Do not click an old rollback target
and assume the current DB_* configuration will be retained.
[Render rollback behavior](https://render.com/docs/rollbacks).

1. On auth, calculation, persistence, isolation or TLS failure, stop the release
   and further synthetic/user acceptance writes. Retain safe diagnostics without
   credentials, tokens or customer payloads. Do not retry publishes blindly.
2. For a frontend-only defect, roll back **the zettaremit project** to its recorded
   prior successful retained production deployment. Verify its API compatibility
   and URL after rollback. Preview deployments and deployment IDs from the legacy
   zettaremit-app project are not rollback targets for this project. Keep the legacy
   project untouched. [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).
3. For backend failure, use only a previously verified TiDB-compatible source/build
   and configuration. If none exists for this first TiDB cutover, pause and obtain
   approval for a standard redeploy of a verified TiDB-compatible commit with the
   preserved runtime account, CA, DB_* and /health settings. A forward configuration
   repair may be safer than an unverified Aiven-era rollback. This gate is not
   satisfied merely because a historical build artifact exists.
4. Never roll back database tables/records, apply the historical migration, restore
   old provider data, weaken TLS, or replace the restricted account with an admin
   account as application rollback. New TiDB data must remain intact. Historical
   Aiven data recovery is not required for this intentionally fresh database.
5. Recheck provider source/branch and automatic-deploy state after recovery.
   Retest /health, strict database connectivity, auth, rates/quotes, simulation
   idempotency/history and AI. Record recovery deploy IDs/SHAs and the outcome.

Verified local recovery checkpoint: `zettaremit-rollback:tidb-reconciled-20261123`
points to the exact image ID above, which passed the full restricted-account live
TiDB journey. The ACL-protected original-workspace backup directory
`.local-backups/reconciliation-20261123-e3f22051/` holds the pre-reconciliation
working-state snapshot/Git bundle and the reconciled image archive
`tidb-reconciled-image.tar`. A reconciled source archive and checksum record are
retained there after final inventory generation. The original working snapshot
is preservation evidence, not a verified deployable rollback build.

The image's application/TiDB behavior and local tag are verified. Archive reload
into the existing local Docker engine passed and restored the same image ID;
a clean-engine restore (without cached layers), Render native rollback, actual
Render secret-file permissions/egress and Pages rollback are **untested**. The image is local, unpublished;
Render cannot use this local tag/archive directly. If needed locally, verify the
archive checksum, `docker image load --input <private-archive-path>`, inspect the
loaded image ID and run it with privately supplied DB_*/CA/secrets. The local reload test used an engine that already held the image; it is not
a cold-host or hosting-provider restore drill.

For the first Render cutover, there is no previously successful TiDB Render
deployment to roll back to. After approved commit/push/merge, the reviewed
TiDB-compatible source SHA plus securely preserved configuration is the standard
redeploy checkpoint. Use that SHA with verified DB_*, runtime grants, CA mount and
/health; do not revive an old Aiven environment. After its first successful hosted
acceptance, record that TiDB deploy ID/configuration as the native rollback baseline.
Until then, outage recovery is an approved standard redeploy/configuration repair,
not a verified native rollback. Capture actual provider deployment/configuration
snapshots and canonical Pages deployment ID before any hosting changes.

## Post-deployment acceptance checklist

- Confirm both deployments identify the approved Revanth0701/Zettaremit main SHA,
  the existing Render service and canonical zettaremit Pages project; keep both
  canonical URLs and the untouched legacy project as recorded.
- Verify normal-browser frontend access (the automated pre-release GET was 403),
  expected built API URL, HTTPS redirects/headers and no mixed-content/localhost
  or development-server references. Confirm backend /health returns 200; separately
  check DB, Java, rates and AI readiness because health is only liveness.
- Verify the actual non-root CA mount and negotiated TLS/hostname validation,
  the runtime account and exact grants, and correct TiDB destination without
  logging values. Do not print /proc environment, tokens or connection URLs.
- Verify canonical-origin and retained legacy-origin CORS preflights, rejection
  of an unrelated origin, and Authorization/Content-Type/Idempotency-Key support.
- With bounded synthetic data: register (201), login (200), reject wrong password
  and missing/invalid JWT (401), get rates, issue/accept a quote, verify 3% fee and
  decimal amounts, create SIMULATED transaction, replay the same idempotency key,
  and verify owned history plus cross-user isolation. Retain synthetic records;
  no cleanup deletion is authorized.
- Check authenticated Gemini JSON/SSE behavior, final stream completion, fixed
  existing generation/embedding models and failure handling; do not expose keys,
  prompts with customer data or internal filenames. Confirm disclosure and disabled
  real document inputs remain visible in the rendered registration flow.
- Check memory/restarts/cold start, client-IP/throttling behavior behind Render,
  quotas and safe error responses. Local test results validate the reconciled working tree, not a future provider
  deployment. Record and verify the approved merged SHA before claiming release success.
- Record final deployment IDs, source SHA, configuration version references,
  dependency-risk disposition and explicit acceptance. One high and 11 moderate
  npm entries remain; source-verified glob repair and residual build-only exposure
  are detailed in DEPENDENCY_SECURITY_REVIEW.md. Build trusted inputs only, publish
  no Node tooling/source maps and expose no dev server. No breaking upgrades or
  automatic risk acceptance are included in this review.

## Deployment sequence after explicit approval

1. Review the now-passing disclosure fix, restricted-account evidence and existing
   dependency/release risks. Record a recovery procedure for new data. No historical
   data transfer or historical SQL migration is needed.
2. Review docs/RELEASE_FILE_REVIEW.json: it explicitly includes current coherent
   application work and excludes unrelated local artifacts. Run
   tools/prepare_release_manifest.py --verify to reject fingerprint drift or
   unexpected staged paths, and repeat the secret scan. Commit and push only after explicit approval, to the
   confirmed repository/branch used by the existing Render service. Do not use
   an unreviewed blanket add or push unrelated history.
3. Keep auto-deploy off. Confirm the existing service ID, root/context `.`,
   Dockerfile `./Dockerfile`, no custom Docker command, and health path `/health`.
   Set the environment keys above with Save only where possible. Do not import
   a Blueprint blindly or create a second web service.
4. Preserve the owner-confirmed three-rule TiDB allowlist above and the enabled
   public endpoint; do not reintroduce allow-all access. Prepare the complete CA
   file. After deployment approval, save the secret
   file and activate the prepared environment as one coordinated release. Its
   save may itself trigger deployment; avoid accidentally starting two releases.
5. Deploy the approved source commit; monitor its specific build/deploy to a
   terminal live status. No predeploy command, SQL migration or table recreation.
6. Verify `/health`, non-root secret-file readability, TLS/hostname verification,
   DB account/grants and the intended endpoint without logging private values.
   Run a bounded synthetic HTTPS journey against the deployed API: registration,
   login, auth rejection, rates, quote, simulated transfer, replay and history;
   then authenticated Gemini request/stream and frontend-origin CORS.
7. Confirm the frontend uses the intended public API URL, check memory/restarts,
   rate limits/client-IP behavior and Gemini quota. Keep rollback source/image and
   configuration references; do not drop tables or restore an old schema as an
   application rollback. Leave auto-deploy off unless separately approved.
