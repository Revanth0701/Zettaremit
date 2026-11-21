# Local Git reconciliation evidence

Prepared November 20, 2026 (America/Chicago). Local only: no push, update to main,
Render/Cloudflare deployment, production database operation, or production configuration change.

## Recovery and history

- Original branch: `feature/gemini-ai-cleanup`, HEAD `5bbfde9446e0ea825a89f820832cfc74a3cf36a9`.
- Fetched remote baseline: `origin/main` at `78b2df3d9514f145c5ee48fb9e6f8a7bec4d24a8`.
- The roots are unrelated: 14 original local-only commits and five remote-only commits.
- Integration branch: `integration/reconcile-20261120`, in a separate worktree. The original dirty worktree is unchanged.
- Reviewed WIP commit: `8430c47371b60fc9f23528eca0a82aca5438dc10`, preserving 56 intended pending files. The local IDE preference is retained in the original worktree and backup, not committed.
- A restricted backup outside both worktrees preserves 186 hash-verified files, including ignored private configuration, original status/patches/refs, and all Git refs in a verified bundle. A bare recovery clone passed `git fsck --full`; a second verified bundle preserves the WIP commit. Backups are not publication artifacts.
- The owner explicitly requested preserving both histories. A normal two-parent merge therefore uses `--allow-unrelated-histories`, without force, reset, clean, stash, or rewriting existing commits. Earlier migration-plan advice against joining history is historical and superseded for this local reconciliation only.

## Conflict review and preservation

All 22 add/add conflicts were reviewed. Shared source snapshots were compared at the original
local HEAD, WIP, and fetched main; compatible non-overlapping hunks were combined rather than
applying an unreviewed whole-file ours/theirs preference. The two files absent from the original
snapshot (`agent.py` and its history test) were combined using their explicit greeting/test hunks.

- Registration, response schemas, client handling, password/OTP forms, navigation, country/KYC UI and AI behavior preserve the approved local source.
- The remote portfolio README and consolidated ignore rules are preserved; the README gains current contract/evidence links. Sensitive local files, reports, logs, dependency caches and IDE settings remain excluded.
- `render.yaml` retains the remote `ZettaRemit-App` identity, canonical repository, main branch, Docker context and review-only warnings. Its AI settings already contain the approved changes. No service is configured or deployed by this merge.
- The historical migration plan gains a supersession note. The registration browser check accepts `UX_TEST_ORIGIN`, allowing validation of the separate worktree rather than accidentally testing the original server.
- All original 186 backed-up file hashes and the exact 57-entry working status still match. All remote files remain present, with no unexpected edits outside the reviewed local scope.

## Focused validation

- 54 backend checks pass: registration 201/409/500 and atomic rollback, authentication, conversation routing, owner-scoped history, Gemini failures/streaming, and CORS. Databases are disposable SQLite; external database/model calls are blocked.
- 57 frontend checks pass: registration/client errors, tokens, login readiness, navigation restoration, AI streaming, existing dashboard behavior, and iOS/Android component event paths.
- Browser navigation checks pass at 1280px and 390px: fresh splash/Welcome, Back from Login with and without prior history, signup/login, refresh on Dashboard/Transactions/Assistant, invalid/expired sessions, logout, and no repeated internal splash. Fresh authenticated launch restores the validated session.
- Password/OTP browser checks pass at both widths: eye/placeholder styling, blur/refocus, automatic advancement, digit editing, backspace, full-code paste, numeric filtering, keyboard navigation and unchanged test-code validation.
- Registration browser checks pass at both widths against a separate loopback fixture backed by disposable SQLite: safe 5xx retry, retained values, rejection of ambiguous legacy 201, genuine creation, login in independent clean browser sessions, duplicate 409/Sign in, and unchanged original credentials. No production accounts are used.
- Production Expo web export succeeds with dotenv disabled and an explicit process-only Render API URL. Emitted `baseUrl` points to `https://zettaremit-app.onrender.com`; no local API target is emitted. Build artifacts remain outside the repository. Existing installed dependencies were reused through an ignored local junction for validation; a release should use `npm ci` in its clean build environment.
- Final staged/tree review checks secret patterns, sensitive filenames, merge markers, ignored artifacts, and whitespace. A historical token match was verified as the canonical jwt.io scrubber-test fixture, not a live credential. No active credentials were found by the targeted review.

## Remaining release boundaries

This evidence authorizes no push or deployment. Fetch again and verify the remote baseline before
any approved publication. Both original histories remain reachable; publication will also expose
the previously private history, so owner approval applies to the full merged ancestry, not just
the final tree. The targeted review is not a guarantee against every possible historical secret.

Production MySQL/schema, the original affected account, backup/restore readiness, container memory
headroom and existing dependency-risk gates remain unverified by these isolated checks. Explicit
registration 409 intentionally permits email enumeration while retaining existing abuse limits.
Frontend and backend must eventually release together because the client requires the new 201
`status: created` contract. Physical native-device testing is not included.

## Files changed relative to the fetched main baseline

- `README.md`
- `backend/ai/agent.py`
- `backend/ai/rag_service.py`
- `backend/ai/router.py`
- `backend/api_responses.py`
- `backend/main.py`
- `backend/test_agent_history_offline.py`
- `backend/test_ai_conversation_offline.py`
- `backend/test_cors_offline.py`
- `backend/test_registration_offline.py`
- `backend/test_transactions_offline.py`
- `docs/GIT_RECONCILIATION.md`
- `docs/REGISTRATION_CONTRACT.md`
- `docs/REPOSITORY_UNIFICATION_PLAN.md`
- `frontend/App.js`
- `frontend/components/CountrySelect.js`
- `frontend/components/FormFields.js`
- `frontend/components/TransferCalculatorPreview.js`
- `frontend/lib/client.js`
- `frontend/lib/navigationState.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/screens/AIAssistantScreen.js`
- `frontend/screens/DashboardScreen.js`
- `frontend/screens/LoginScreen.js`
- `frontend/screens/RegistrationWizard.js`
- `frontend/screens/SplashScreen.js`
- `frontend/tests/ai_assistant.test.cjs`
- `frontend/tests/approved_ux.browser.cjs`
- `frontend/tests/customer_journey_fixes.test.cjs`
- `frontend/tests/navigation.browser.cjs`
- `frontend/tests/navigation_state.test.cjs`
- `frontend/tests/registration.browser.cjs`
- `frontend/tests/registration.test.cjs`
- `frontend/tests/signup_inputs.browser.cjs`
- `frontend/tests/signup_native.test.cjs`
