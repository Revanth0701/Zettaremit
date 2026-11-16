# Production deployment and rollback runbook

Status: proposed, not executed. Render service/deploy baseline is now verified; database
identity and verified backup/restore evidence must be filled in before release approval.

## Record before release

- Existing Render service ID, repository, production branch, deployed SHA/deployment ID,
  runtime/start commands, health path, plan and auto-deploy behavior.
- Existing Pages project ID, production deployment ID, source SHA, build settings and origins.
- Secure provider-side configuration snapshot including env-group references and secret
  mount configuration. Do not copy values into Git, reports or chat. Preserve valid JWT
  and internal tokens, rather than rotate them as part of this release.
- Confirmed Aiven service/database identity, schema fingerprint, aggregate baseline row
  counts, backup ID/time/retention/encryption and successful isolated restore evidence.
- Approved candidate SHA/image digest, container checks and dependency risk disposition.

## Backup and database gate

No backup has been taken or verified in this audit. Confirm provider-native backup/PITR
availability for the actual Aiven service/plan and test restoration into an approved
isolated target, with access restrictions and cost approval where applicable.

For a separately authorized logical backup, use a MySQL client compatible with the actual
server, least-privilege backup account and validated TLS hostname/CA. Put credentials in
an ACL-restricted option file **outside the repository and OneDrive**, with `ssl-mode=VERIFY_IDENTITY`
and verified CA. Do not place passwords in command arguments, shell history or process logs.
An operator-reviewed example (placeholders only; not executed):

```text
mysqldump --defaults-extra-file=<private-option-file> --single-transaction --quick --no-tablespaces --routines --events --triggers --set-gtid-purged=OFF --result-file=<private-backup-file> zettaremit
```

Confirm InnoDB engines and required privileges/options for the installed client/server.
Do not weaken TLS or silently omit routines/events/triggers if access fails. Coordinate
a DDL freeze during the dump: a transactional snapshot does not isolate concurrent table
DDL. Nontransactional tables need a separately reviewed consistency strategy. Verify exit
status, encrypted storage, checksum, restricted access and retention. A file existing is
not proof of recoverability: restore privately to a fresh, approved isolated server and
compare schema, constraints and aggregate counts. No restore is authorized by this plan.
See [MySQL 8.4 mysqldump documentation](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html).

No schema migration is proposed by the AI upgrade itself. If the existing production
schema is incompatible, pause this release and create a separately approved data-aware
migration. The review-only legacy SQL must not be applied to unknown financial history.

## Exact release sequence after gates and explicit approval

1. Confirm provider mapping and final file allowlist from the manifest. Obtain commit
   approval, create the reviewed release commit without local secrets/data, then obtain
   approval for the exact remote/branch push after checking its deployment integrations.
   Never assume `origin` is production. Do not import the blueprint to create a new service.
2. In the existing Render service, stage the reviewed nonsecret configuration from the
   readiness checklist and retain valid production secrets. Choose a provider save/deploy
   flow only after its restart/deployment effects have been reviewed and approved.
3. Trigger a manual deploy of the approved exact commit in the existing service. Root
   context, `./Dockerfile`, provider PORT, `/health`; no migration/start override. Java
   runs inside this container. Creating a separate paid Java service is not authorized.
   [Render supports deploying a specific commit](https://render.com/docs/deploys).
4. Verify public health, secure headers, auth failure behavior and exact-origin CORS,
   production TLS database connectivity/schema, Java loopback authentication/calculation,
   and sanitized index logs. Use designated test-account checks only within approved scope.
   Stop if accounts, transactions, simulation direction or totals are inconsistent.
5. In the confirmed existing Pages project, deploy the same approved source with root
   `frontend`, framework None, `npm ci && npm run build:web`, output `dist`, Node 22 and
   confirmed production `EXPO_PUBLIC_API_URL`. Never upload local environment files or
   blindly publish the ignored local export. Provider settings affect the build:
   [Cloudflare build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).
6. Verify live desktop/mobile loading, login, history and total/page distinctions, streaming,
   ownership isolation, simulation language and unsupported support behavior. Compare
   baseline integrity with expected explicitly approved test writes. Record actual IDs,
   URLs and results. Keep release unavailable for approval until both layers are verified.

## Rollback triggers and actions

Triggers: failed startup, persistent 5xx, failed login/ownership checks, database/schema
errors, broken quote/Java contract, wrong API origin, misleading financial results,
unexpected provider spend, or resource exhaustion.

1. Pause further release actions and preserve sanitized diagnostics. Do not retry writes
   with new idempotency keys or modify historical rows to make checks pass.
2. Roll Pages back to the **recorded successful production deployment ID** if its UI is
   broken. Preview deployments are not rollback targets. Verify old frontend/backend
   contract compatibility. [Pages rollback documentation](https://developers.cloudflare.com/pages/configuration/rollbacks/).
3. Roll Render back to the **recorded known-good deployment/artifact**, following its
   service configuration rules. Render reuses target-deploy env values for rollback;
   shared env groups can differ and current settings are not overwritten for future
   standard deploys. Compare privately, preserve signing continuity, verify mounts and
   validate health/auth/Java before declaring recovery. Do not print configuration.
   [Render rollback details](https://render.com/docs/rollbacks).
4. An emergency AI flag change is a production configuration/deployment action and needs
   appropriate explicit authorization; disabling AI does not fix schema or auth failures.
5. An application rollback does **not** restore external MySQL data. No data/schema changes
   are authorized in this release. If an unexpected data incident occurs, stop writes
   through an approved operational response and escalate. Restoring a backup over live
   data can lose subsequent transactions and requires a separate approved recovery plan.

Automatic from this workstation: source review, synthetic tests, isolated frontend export,
public GET probes, manifest preparation. Requires access: provider discovery, read-only
production metadata, backup verification. Requires explicit approval: commits/pushes under
the owner's rule, production deployment/config changes that trigger deploys, production
data/schema writes, secret rotation, paid resources, and any recovery restore.


## Verified target and gated actions (2026-11-16)

- Workspace `My Workspace` (`tea-d8d35lmk1jcs738i7n2g`); existing service `ZettaRemit-App`
  (`srv-dbdv8o3ncjis73dkflag`), repo `Revanth0701/ZettaRemit-App`, branch `main`,
  auto-deploy disabled, Docker context `.`, `./Dockerfile`, no custom Docker command.
- Baseline live deploy `dep-dbr7a46c6qcc73d225r0`, commit
  `6c6881547e265ac9a7f5de416dd768f571afec31`. Reconfirm this ID is an eligible rollback
  artifact immediately before release; listing a deploy is not proof of retained artifact
  availability. Do not deploy latest main blindly.
- No provider mutations were performed. After all gates pass and exact approval is given:
  commit the manifest allowlist, push only to the approved private repository/branch,
  configure only approved environment changes and `/health`, manually deploy the exact
  approved SHA on this existing service, validate backend, then deploy the approved Pages
  artifact/source on the existing project. A restart alone does not pick up pending settings.
- Backend failure: stop rollout and perform an approved rollback to the verified retained
  baseline deploy/artifact; verify configuration, database compatibility, auth/Java and
  safe account checks. Keep auto-deploy disabled. Do not restore a database automatically.
- Frontend failure: use the separately recorded previous successful Pages production
  deployment ID; that ID remains unknown and is a release gate. Verify endpoint/contract.
- Backup existence, retention, restoration test and actual Aiven schema remain UNKNOWN.
  No Render Postgres backup assumption applies to this external MySQL database.
