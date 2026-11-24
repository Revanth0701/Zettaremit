# Release preparation

Current TiDB/Render preparation and exact configuration: see
[RENDER_RUNBOOK.md](RENDER_RUNBOOK.md). Earlier dated reviews below remain historical.
Final source: Revanth0701/Zettaremit main for both hosts. Use existing Cloudflare
project zettaremit at https://zettaremit.pages.dev/; retain zettaremit-app untouched.
The isolated release candidate is reconciled against remote main 8ada74a.
See the runbook for target-relative review, validation and approval gates.

Render: one Free Docker Web Service; context/root repository root, Dockerfile ./Dockerfile,
health /health, auto-deploy off, no custom start command, provider-managed PORT.
APP_ENV=production; DATABASE_MODE=cloud; LOCAL_CREATE_TABLES=false;
SCHEMA_REVISION=20261023_01 only after the schema and release gates have been reviewed.
Do not apply the historical review-only SQL to TiDB; see TIDB_MIGRATION.md.
Supply DB_HOST, DB_PORT, DB_NAME, restricted DB_USER and DB_PASSWORD
as provider secrets; DB_CA_PATH=/etc/secrets/tidb-ca.pem with verified CA runtime file.
Use new independent JWT_SECRET_KEY and INTERNAL_SERVICE_TOKEN (32 random bytes each).
CORS_ORIGINS must include https://zettaremit.pages.dev and preserve existing approved
origins during cutover, including https://zettaremit-app.pages.dev for legacy access.
No administrator credentials.
Java calculator uses authenticated loopback only; no second public service or Java database.

Existing Cloudflare Pages project zettaremit: intended settings are framework None,
root frontend, npm ci && npm run build:web, output dist, NODE_VERSION=22.
Set EXPO_PUBLIC_API_URL=https://zettaremit-app.onrender.com.
Confirm the project's actual branch/build/automatic deployment settings before pushing.
No secrets in EXPO_PUBLIC variables. Rebuild for URL changes.
Render Free has idle/capacity limits and is for a demo, not a financial production SLA.
Health is liveness only. No migration, ETL or service deployment occurs automatically.

Security review refreshed 2026-11-23: see DEPENDENCY_SECURITY_REVIEW.md and
RENDER_RUNBOOK.md for package-level evidence and approval gates.
node-forge was patched compatibly to 1.4.3. Current npm audit reports one high
(image-size), 11 moderate and no low findings. The affected image-size range
extends through 2.0.2. Applied the compatible glob 13.0.7 cancellation backport;
the scanner still includes it in a broad affected range, and minimatch remains
unresolved. Metro 0.83.3 passes paths to image-size's synchronous API, which v2 removes. Do not force
an incompatible override or Expo major upgrade. Resolve or explicitly review the
remaining build-tool risk before release. Build trusted source/assets only;
never publish a dev server or node_modules. Production schema/backup and memory
headroom verification remain release gates. No risk acceptance is implied.

Environment examples are placeholders. Preserve restricted runtime grants:
SELECT/INSERT users and transactions; INSERT user_verifications. Audit/migrate separately.
Do not copy legacy public repository history, environment files, reports or local databases.
