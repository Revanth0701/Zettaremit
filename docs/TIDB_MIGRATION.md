# TiDB Cloud migration verification

The active Python cloud configuration uses DB_HOST, DB_PORT, DB_NAME, DB_USER,
DB_PASSWORD and DB_CA_PATH. Local development reads private backend/.env.cloud;
production reads host environment variables. Environment DB_* values take precedence.
Never copy private credentials into tracked examples. The deployment example contains
placeholders. If previously populated example credentials were shared, rotate them at
the provider. No credentials were committed or pushed during this work.

Local CA path: backend/certs/tidb-ca.pem (DB_CA_PATH=certs/tidb-ca.pem).
The prepared Render configuration expects /etc/secrets/tidb-ca.pem, which must be
provided before an approved deployment. Certificate validation, hostname validation
and TLS 1.2 minimum remain required; there is no insecure fallback.

Run backend/check_cloud_schema.py with the backend Python environment. It imports no
application models and executes only six fixed information_schema SELECT queries.
It does not issue START TRANSACTION READ ONLY, which TiDB rejects, or execute DDL,
DML, user-row queries or the historical migration SQL. It rolls back and disposes its
connection. Use a restricted account for auditing. Concurrent DDL can change metadata
between queries; audit while schema changes are paused.

All existing column, type, decimal capacity, nullability, primary key, identity,
foreign key/action, uniqueness and index checks remain. The users,
user_verifications and transactions tables are required. service_transactions is
optional: TransactionServiceApplication excludes datasource and Hibernate auto
configuration, and TransactionController is a stateless BigDecimal calculator with
no repository calls. The legacy entity/repository remain in source. If the legacy
table exists, all its existing checks still run; re-enabling Java persistence would
require making the table mandatory again and reviewing its DDL.

Verification on 2026-11-23: audit completed with exit 0, zero critical issues,
one minor additional-index finding on user_verifications, zero unverified issues.
service_transactions was absent and reported as informational. No tables were
created, deleted or changed. Defaults, collations, triggers, grants, backups and
application behavior against cloud data require separate review; this metadata
audit does not approve a release or prove data transfer from the prior provider.
The connection probe is also TiDB compatible but counts application rows; it is
not part of the metadata-only audit and was not needed for this verification.

The historical backend/migrations/20261023_01_review_only.sql remains unchanged
and must not be executed as part of this migration. No deployment, push or
architecture change is authorized by this verification.

Offline validation: tools/test_ai_offline.py passed 198 offline tests plus 18
additional security/rate integration tests (216 total). Authentication, financial
calculations and mocked Gemini behavior passed. New checker tests enforce SELECT-only
metadata access, connection cleanup and required versus optional tables. Java
gradlew test --offline --no-daemon --rerun-tasks passed with 10 tests.
Git diff --check passed. Container tests were updated but Docker execution and
cloud application writes were not performed.

Production preparation update (2026-11-23): this is an intentionally fresh
database. Historical provider data transfer/recovery is not a release requirement.
See RENDER_RUNBOOK.md for current production-mode live smoke tests, certificate
access, least-privilege account requirements and deployment sequence.
