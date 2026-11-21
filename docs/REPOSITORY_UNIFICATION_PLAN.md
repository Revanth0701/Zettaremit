# Unified ZettaRemit repository migration plan

> Historical planning snapshot. The owner's November 20, 2026 instructions now authorize
> a local integration branch preserving both histories after backup and review. The earlier
> prohibition on an unrelated-history merge is superseded for that local reconciliation only.
> No push, update to main, or deployment is authorized. See [reconciliation evidence](GIT_RECONCILIATION.md).

Prepared 2026-11-16. Canonical destination: **Revanth0701/Zettaremit**, branch `main`.
Status: source snapshot prepared locally; no commit, push, merge or hosting change authorized.
This decision supersedes older release documents' proposed private-repository destination.
Their production observations and outstanding safety gates remain applicable.

## Repository comparison

| Item | Official destination | Previous development/production source |
| --- | --- | --- |
| Repository | `Revanth0701/Zettaremit` | `Revanth0701/ZettaRemit-App` |
| Visibility | Public | Private |
| Default branch | `main` | `main` |
| Current remote main | `2a6f4af917a71c0964c70ca191fbd7ee75031719` | `87f1f66729f208bf55ad6ceb02f98202923c1ad5` |
| Local remote | `origin` | `prod-remote` |
| Full monorepo directories | Already present | Already present |

Local HEAD is `5bbfde9446e0ea825a89f820832cfc74a3cf36a9` on
`feature/gemini-ai-cleanup`, tracking `prod-remote/feature/gemini-ai-cleanup`.
Its committed tree matches private main; the latest AI upgrade is uncommitted.
Local `main` is stale and tracks the private remote. Do not switch to it or push it
as the unified release by assumption. Other local/remote feature branches remain untouched.

The complete, non-shallow local repository has **no merge base** between the two mains.
There are four public-main-only commits and fifteen private-main-only commits. This is
not a routine fast-forward. Do not merge with `--allow-unrelated-histories`, force-push,
replace public main, or import private Git history into a public repository.

Both repositories already contain frontend, FastAPI, Java, models, tests, Docker and
deployment files. This is source reconciliation, not moving only an AI folder. The
comparison inventory gives every unchanged, added, updated and proposed-retired path.

## Conflicts and preservation decisions

1. **README:** destination has a 267-line portfolio/application README; local private
   source has a 14-line release README. Preserve the destination structure and useful
   content. The candidate updates stale Ollama, test-count, safety and setup guidance;
   its diff must be reviewed before committing. The original remains in public history.
2. **Ignore rules:** retain destination's stronger rules, including `.vscode`, logs,
   OS caches and Python build caches; add any missing current protection. Do not replace
   them with the weaker private version. Keep the tracked Gradle wrapper JAR.
3. **Docker context:** use the already tested current allowlist that includes all agent
   modules and eight knowledge documents while excluding environment files and data.
4. **Legacy AI:** compared `backend/ai/index_knowledge.py`, `backend/ai/ollama_client.py`
   and `backend/test_ai_providers_offline.py` against destination versions (259, 396 and
   233 lines). They are retired by the tested Gemini/BM25/hybrid implementation and
   absent locally. Their proposed removal is explicit, not an accidental bulk delete.
   Original source remains in public Git history; no removal has been executed there.
5. **Current functionality:** copy all current application files and reviewed tests,
   not just the nine original tracked AI edits. Preserve owner-derived transaction
   queries, total/page counts, streaming, session checks, Decimal arithmetic, quotes,
   idempotency, schema models, Java auth and knowledge refresh. No runtime code is
   rewritten as part of this repository preparation.
6. **Production configuration:** candidate Blueprint explicitly targets the canonical
   repo/main and uses existing service display name `ZettaRemit-App`. It is review-only;
   importing it does not establish safe adoption of the existing service ID. Keep live
   infrastructure unchanged and do not create a replacement service by accident.
7. **Private-to-public boundary:** the snapshot contains selected source, not `.git`,
   dotenv files, dumps, runtime data, logs, screenshots, caches or editor settings.
   Scan both snapshot and eventual staged diff before any public push. Pattern and
   exact-known-secret scans do not establish that old public history has no secrets.

## Proposed structure

```text
Zettaremit/
  README.md
  .gitignore
  .dockerignore
  Dockerfile
  render.yaml
  frontend/                       # Expo/React Native web app, assets, tests, lockfile
  backend/                        # FastAPI, auth, SQLAlchemy models, tests
    ai/                           # Gemini, tools, Hybrid RAG, SSE adapters
      knowledge_base/             # eight reviewed Markdown documents
    migrations/                   # review-only history; never run automatically
  services/transaction-service/   # Spring Boot stateless calculator, Gradle, tests
  deployment/                    # supervisor and placeholder-only env example
  tools/                         # safe offline/release checks and local helpers
  docs/                          # architecture, release evidence, migration plan
```

No CI workflows or Wrangler project configuration were found in either inspected main
tree. GitHub Actions will not appear automatically. A later workflow should use the safe
offline test runner, frontend tests/export and Java tests with synthetic configuration;
do not add automatic deploys or copy private repository secrets. Existing hosting Git
integrations are independent of files in the repository.

## Prepared artifacts

- `.local-backups/repository-unification/candidate/`: complete sanitized source snapshot,
  including merged documentation/ignore rules and proposed canonical Blueprint.
- `docs/REPOSITORY_UNIFICATION_INVENTORY.json`: exact per-path comparison and hashes.
- `.local-backups/repository-unification/apply_snapshot.py`: reviewed application helper;
  defaults to dry-run. It rejects a dirty target, wrong base commit and altered snapshot.
  `--apply` is for a separately approved future migration worktree only.

No existing application files were overwritten to create the candidate. The active
working tree, branches, remotes and both remote repositories remain intact. Snapshot
hash verification, path exclusion and config validation are preparation checks; existing
development suites were not repeated because runtime source did not change. Prior release
test evidence remains in `PRODUCTION_DEPLOYMENT_READINESS.md`.

## Exact safe Git procedure — proposed only, not executed

Run from the current repository after approval for a local migration worktree. Recheck
remote heads first; if public main advanced, stop and refresh the comparison/snapshot.
The helper requires the exact compared public base and will not overwrite a changed base.

```powershell
$sourcePath = 'C:\Users\Admin\OneDrive\Desktop\ZettaRemit'
$reviewPath = 'C:\Users\Admin\OneDrive\Desktop\Zettaremit-unified-review'
$migrationBranch = 'migration/unified-20261116'
git -C $sourcePath status --short
git -C $sourcePath remote -v
git -C $sourcePath fetch origin main
git -C $sourcePath rev-parse origin/main
# STOP unless this is 2a6f4af917a71c0964c70ca191fbd7ee75031719.
# STOP if the review path or branch already exists; never reset/reuse it blindly.
git -C $sourcePath worktree add -b $migrationBranch $reviewPath origin/main
python -B "$sourcePath\.local-backups\repository-unification\apply_snapshot.py" --target $reviewPath
# Review the dry-run and inventory. Only after approval to apply compared file changes:
python -B "$sourcePath\.local-backups\repository-unification\apply_snapshot.py" --target $reviewPath --apply
git -C $reviewPath status --short
git -C $reviewPath diff --check
git -C $reviewPath diff --stat
git -C $reviewPath diff -- README.md .gitignore render.yaml
```

No stash, checkout, reset or clean is needed in the active dirty checkout. The helper
copies only compared files and removes only the three explicitly reviewed retired files
in the new worktree; it never touches a database or runs Git mutations itself.

After review, stage explicit inventory paths rather than `git add .`:

```powershell
$inventory = Get-Content -Raw -LiteralPath "$sourcePath\docs\REPOSITORY_UNIFICATION_INVENTORY.json" | ConvertFrom-Json
$writePaths = @($inventory.files | Where-Object { $_.action -in @('add','update') } | ForEach-Object { $_.path })
$retirePaths = @($inventory.retirements | ForEach-Object { $_.path })
git -C $reviewPath add -- $writePaths
git -C $reviewPath add -u -- $retirePaths
git -C $reviewPath diff --cached --check
git -C $reviewPath diff --cached --stat
# Stop for staged secret/content review and explicit commit/push approval.
```

Only after separate approval of the exact staged content and remote branch:

```powershell
git -C $reviewPath commit -m "Unify ZettaRemit application with Hybrid RAG and Gemini agent"
git -C $reviewPath push --set-upstream origin $migrationBranch
# Open a PR in Revanth0701/Zettaremit: base main, compare migration/unified-20261116.
# Review and merge only with separate explicit approval. Never force-push main.
```

Before even a feature-branch push, inspect hosting preview/build triggers: public branch
pushes may trigger Cloudflare preview deployments. Disabled Render main auto-deploy does
not prevent other automation. No remote rename is required: `origin` is already correct.
After migration is approved and merged, new development should clone the canonical repo
or explicitly track its main; retain `prod-remote` read-only for rollback until retirement
is separately approved. Do not delete the old repository or branches.

## Required hosting changes — not executed

**Render:** retain workspace `My Workspace`, existing service `srv-dbdv8o3ncjis73dkflag`,
URL, secrets, CA mount, database destination and Free plan unless separately approved.
Proposed source is `https://github.com/Revanth0701/Zettaremit`, branch `main`, Docker
context `.`, `./Dockerfile`, image CMD/no custom start command. Proposed HTTP health path
is `/health` (currently empty). Keep auto-deploy disabled. AI enablement remains a separate
approved configuration/deployment action; preserve valid production signing keys.

**Important deployment gate:** Render's Settings > Build > Source > Edit can change the
existing service's repository, but **submitting the change automatically triggers a deploy**.
Do not treat reconnection as a harmless metadata edit, even with auto-deploy disabled.
Make this change only after production readiness and explicit deployment approval.
[Official Render source-change documentation](https://render.com/changelog/change-your-services-backing-repo-or-image-in-the-render-dashboard).

**Cloudflare Pages:** grant its GitHub app access to the canonical repo; desired production
branch `main`, root `frontend`, framework None, build `npm ci && npm run build:web`, output
`dist`, `NODE_VERSION=22`, public API root `https://zettaremit-app.onrender.com`. Do not
copy `.env.local` or server secrets. Preserve current origin/CORS until a separately
approved change is verified. Capture current Pages deployment ID and rollback eligibility.

An in-place Pages repository change is **not verified**. Official GitHub integration docs
describe app installation permissions; “Manage Git Repository” is not proof of a project
source switch. Inspect the actual project/support options before choosing a procedure.
If a new project or alternate deployment integration is required, prepare it in parallel
under separate approval, preserve the existing project/site, validate first, and approve
any domain/CORS cutover. Do not delete/recreate the live project to reuse its name.
[Official Pages GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/).

## Remaining release gates and data preservation

Repository consolidation does not resolve production Aiven identity/schema compatibility,
backup/restore evidence, model/quota/embedding verification, remaining high `image-size`
finding or measured 512 MiB memory pressure. No production migration is proposed. Existing
models match deployed source but actual production metadata remains unverified.

Current application source and local uncommitted AI improvements are preserved byte-for-byte
in the candidate, except the explicitly reconciled README, ignore rules and Blueprint.
Database records are outside Git: neither `instaremit_db`, `zettaremit_ai_dev` nor Aiven
was accessed or changed. No accounts, transactions or schemas were copied or removed.
Both GitHub repositories and their histories remain unchanged. Final cutover integrity
must still be verified after authorized migration/deployment; it cannot be guaranteed
from a source snapshot alone.


## Preparation verification

The candidate has **148 files**: **105 unchanged**, **21 updated**, **22 added** relative
 to the compared public main, with **three explicitly reviewed retirements**. Exact hashes
 and paths are in the inventory. Candidate Blueprint validation passed against the current
 Render draft-2020-12 JSON schema (format checks disabled; canonical repo URL/branch also
 checked directly). This structural check does not apply a Blueprint or validate existing
 service adoption. The first validator attempt used an incompatible schema dialect; the
 subsequent draft-2020-12 validation passed. No application dependency was changed for
 validation; the validator ran from temporary npm tooling cache.

All current application and test source in the candidate matches the active worktree;
 only README, stronger ignore rules and proposed Blueprint are reconciled. Existing local
 secrets are absent by exact-match scan; environment/data/editor/build paths are excluded.
 Full private history is not copied. No development test suites were rerun.
