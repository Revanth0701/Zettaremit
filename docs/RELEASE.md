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

Security review: PostCSS is overridden to patched 8.5.23. Five high npm package entries
remain in build tooling: expo, @expo/cli, @expo/code-signing-certificates, node-forge,
image-size. node-forge has no published patch at review; image-size fix needs a major
Metro integration. Owner must review/accept this scoped build risk or remediate before
public release. Build trusted source/assets only; never publish a dev server or node_modules.

Environment examples are placeholders. Preserve restricted runtime grants:
SELECT/INSERT users and transactions; INSERT user_verifications. Audit/migrate separately.
Do not copy legacy public repository history, environment files, reports or local databases.
