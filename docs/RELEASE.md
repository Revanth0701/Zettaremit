# Release preparation

Render: one Free Docker Web Service; context/root repository root, Dockerfile ./Dockerfile,
health /health, auto-deploy off, no custom start command, provider-managed PORT.
APP_ENV=production; DATABASE_MODE=cloud; LOCAL_CREATE_TABLES=false;
SCHEMA_REVISION=20261023_01 only for an audited migrated database.
Supply AIVEN_HOST, AIVEN_PORT, AIVEN_DATABASE, restricted AIVEN_USER and AIVEN_PASSWORD
as provider secrets; AIVEN_CA_PATH=/etc/secrets/aiven-ca.pem with verified CA runtime file.
Use new independent JWT_SECRET_KEY and INTERNAL_SERVICE_TOKEN (32 random bytes each).
CORS_ORIGINS must contain the exact frontend HTTPS origin. No administrator credentials.
Java calculator uses authenticated loopback only; no second public service or Java database.

Cloudflare Pages: framework None, root frontend, npm ci && npm run build:web,
output dist, NODE_VERSION=22. Set EXPO_PUBLIC_API_URL to actual backend HTTPS root URL.
No secrets in EXPO_PUBLIC variables. Rebuild for URL changes.
Render Free has idle/capacity limits and is for a demo, not a financial production SLA.
Health is liveness only. No migration, ETL or service deployment occurs automatically.

Security review (2026-11-16): see PRODUCTION_DEPLOYMENT_READINESS.md for current evidence.
node-forge was patched compatibly to 1.4.3. Current npm audit reports one high
(image-size), 11 moderate and one low finding. image-size has no patched 1.x;
Metro 0.83.3 passes paths to its synchronous API, which v2 removes. Do not force
an incompatible override or Expo major upgrade. Resolve or explicitly review the
remaining build-tool risk before release. Build trusted source/assets only;
never publish a dev server or node_modules. Production schema/backup and memory
headroom verification remain release gates. No risk acceptance is implied.

Environment examples are placeholders. Preserve restricted runtime grants:
SELECT/INSERT users and transactions; INSERT user_verifications. Audit/migrate separately.
Do not copy legacy public repository history, environment files, reports or local databases.
