# Final dependency security review — 2026-11-23

Scope: the one high and 11 moderate **npm package entries** in the ZettaRemit
frontend lockfile. These are four distinct advisories, not 12 independent
vulnerabilities. Parent Expo package entries inherit the glob/minimatch findings.
This review is not a full OS, Python or Java CVE inventory.

## Result and applied change

Applied the compatible upstream **glob 13.0.6 → 13.0.7** security backport with
`npm update glob --ignore-scripts --no-audit --no-fund`. The reviewed
[upstream compare](https://github.com/isaacs/node-glob/compare/v13.0.6...v13.0.7)
contains the immediate-return cancellation repair. No dependency major version
was changed. package.json is byte-for-byte unchanged from the start of this
review. In package-lock.json, exactly one package entry changed: glob's version,
tarball URL and integrity. React 19.1.0, Expo 54.0.38, React Native 0.81.5,
FastAPI, Java, TiDB and both existing Gemini models remain unchanged.

A public-API regression test creates a bounded synthetic directory tree, aborts
after its first directory read, and verifies that traversal stops. It fails on an
isolated installation of unpatched 13.0.6 and passes on 13.0.7. No audit exclusions,
advisory suppressions, forced fixes, handwritten node_modules edits or major-version
overrides were used.

The post-update npm audit still reports **1 high + 11 moderate = 12 package
entries**, including with `--omit=dev`. Its broad glob range still includes
13.0.7 despite the independently verified backport. This does not make every
moderate entry a false positive: minimatch remains vulnerable and propagates
through the same dependency chain. The image-size advisories also remain open.
No risk acceptance is implied by this review.

## Advisory details and patched versions

| Key | Advisory / CVE | Affected installed code | Upstream patched version | Decision |
| --- | --- | --- | --- | --- |
| A | [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), CVE-2025-71329 | image-size 1.2.1: JXL/HEIF zero-size image boxes can cause an infinite loop | 2.0.3 | No compatible 1.x fix published; do not override Metro blindly |
| B | [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), CVE-2025-71330 | image-size 1.2.1: malformed ICNS image can cause an infinite loop | 2.0.3 | Same constraint as A |
| C | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), CVE-2026-118773 | glob 13.0.6: canceled traversal continues reading directories | Advisory names 14.0.2; upstream **13.0.7 backport independently verified and applied** | Cancellation defect repaired; scanner metadata still flags 13.0.7 |
| D | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), CVE-2026-118764 | minimatch 9.0.9 and 10.2.5: pattern amplification with optimizationLevel >= 2 | 11.0.1 | No patched 9.x/10.x version identified; defer unsupported major overrides |

Source evidence was retrieved from GitHub's advisory API and the upstream glob
repository, and checked against the published npm tarballs. image-size 2.0.3 is
now published; older reports that it was unpublished are not current evidence.
The currently published 1.x line ends at 1.2.1. minimatch 10.2.6 is published but
is explicitly described as vulnerable by D; updating to it would not resolve D.

## All 12 affected package entries

Versions below are the installed versions after this review; the glob change is
shown explicitly. A parent marked C/D has no independent advisory or meaningful
standalone "patched parent version": it needs patched leaf dependencies. npm
suggests Expo 58.0.26 for this chain, a major SDK change that was not applied or
validated. No same-SDK remediation was inferred from that recommendation.

| Package | Severity | Installed version(s) | Advisory IDs | Patched-version requirement | Actual use / applicability |
| --- | --- | --- | --- | --- | --- |
| image-size | High | 1.2.1 | A, B | 2.0.3 | Metro build/dev image parsing; crafted repository assets can hang a builder; absent from exported web code and Render image |
| glob | Moderate | 13.0.6 → **13.0.7** | C directly; D inherited | C: 13.0.7 backport applied; D: minimatch 11.0.1 | Expo build/dev filesystem discovery; cancellation repair tested; pattern-amplification exposure remains |
| minimatch | Moderate | 9.0.9 under Expo CLI; 10.2.5 at root | D | 11.0.1 | Build/dev matching; glob enables optimization level 2, so the vulnerable condition exists if patterns are attacker-controlled |
| @expo/cli | Moderate | 54.0.28 | C, D inherited | C: 13.0.7; D: 11.0.1; no tested SDK-54 parent fix | Build/dev commands; the export includes only its metro-require loader, not the vulnerable matching/traversal modules |
| @expo/config | Moderate | 12.0.14 | C, D inherited | C: 13.0.7; D: 11.0.1 | Node configuration/build discovery; not bundled in reviewed web export |
| @expo/config-plugins | Moderate | 54.0.6 | C, D inherited | C: 13.0.7; D: 11.0.1 | Native configuration/prebuild tooling; not bundled in reviewed web export |
| @expo/fingerprint | Moderate | 0.15.5 | C, D inherited | C: 13.0.7; D: 11.0.1 | Project fingerprinting/build tooling; not bundled in reviewed web export |
| @expo/metro-config | Moderate | 54.0.17 | C, D inherited | C: 13.0.7; D: 11.0.1 | Bundler configuration/discovery; not bundled in reviewed web export |
| @expo/prebuild-config | Moderate | 54.0.9 | C, D inherited | C: 13.0.7; D: 11.0.1 | Native prebuild tooling; not bundled in reviewed web export |
| expo | Moderate | 54.0.38 | C, D inherited | Patched leaves; npm suggests SDK 58.0.26 | Actual client SDK and build tools share the package tree; client code is present, vulnerable Node leaves are not |
| expo-asset | Moderate | 12.0.14 | C, D inherited via expo-constants/config | Patched leaves; no tested SDK-54 parent fix | Client-capable asset package with inherited Node tooling; its code is not present in this particular web export |
| expo-constants | Moderate | 18.0.14 | C, D inherited via @expo/config | Patched leaves; no tested SDK-54 parent fix | Client-capable constants package with Node build scripts; its code is not present in this particular web export |

The C/D version requirements refer to the leaf packages, not to versions of the
parent Expo package. C's backport is installed; D remains unresolved. This table
does not recommend overriding minimatch across major versions. Registry data
confirms the current installed Expo 54.0.38 is the latest published SDK-54 patch.
Native app binaries and Expo prebuild/run workflows were not rebuilt in this
review; web build success does not establish compatibility of a major override
with every native tool.

## Production versus development exposure

The frontend declares Expo under dependencies, not devDependencies. Therefore npm
classifies its transitive tools as production dependencies, and `npm audit
--omit=dev` still finds all 12 entries. Moving packages to devDependencies or
changing audit flags would not repair them and was not done.

Actual deployment boundaries are different:

- **Render backend:** the production image contains Python and Java, no Node/npm
  executable and no frontend dependency tree. These npm advisories are not
  reachable through FastAPI, authentication, TiDB operations or Gemini APIs.
- **Exported browser frontend:** a source-map-enabled production export was
  inspected across 556 source modules. image-size, glob and minimatch have zero
  source entries; the only @expo/cli source is
  `build/metro-require/require.js`. This loader does not bring the vulnerable
  Node libraries into the bundle. Runtime Expo client code is present. No Node
  build server is deployed for the static frontend.
- **Build machines and development:** the vulnerable code is installed and
  executable. Metro 0.83.3 calls image-size with a file path in
  [getAssetData](https://github.com/facebook/metro/blob/v0.83.3/packages/metro/src/Assets.js),
  while image-size 2 removes the synchronous file-path API. Expo CLI's
  anyMatchAsync uses globStream with cancellation, so C was applicable there.
  Glob enables minimatch optimization level 2, so D is not dismissed as dead
  code merely because application source does not import minimatch directly.

The public API accepts recipient/account strings, not glob expressions or image
buffers. Real government document entry/upload remains disabled. The web build
used the existing reviewed assets; a malicious JXL/HEIF/ICNS payload disguised
with a different extension could still threaten a builder if accepted into source.
An extension-only filter is not a reliable parser mitigation.

## Remaining risk and mitigation

**Unresolved:** A/B can hang a Node build process on crafted image data. D can
amplify attacker-controlled patterns into excessive CPU/memory work. These are
availability risks for development/build environments, not demonstrated remote
request vulnerabilities in this exported static frontend or Python/Java backend.
Repository/supply-chain inputs still matter; this is not a claim of universal
non-exploitability.

Until a compatible supported fix is available:

1. Build trusted, reviewed source/assets only. Do not run privileged builds of
   untrusted pull requests, downloaded template trees or user-uploaded assets.
2. Keep real uploads disabled and expose no Expo/Metro dev server publicly.
   Publish only the approved production web export; never node_modules, review
   source maps, npm tooling or ignored review exports.
3. Bound build time/memory and run builds with minimal privileges/secrets. Treat
   timeouts as process-level limits; do not assume in-process pattern processing
   can always be interrupted.
4. Track upstream SDK-54/Metro-compatible fixes. A future image-size major needs
   a deliberate file-path API adaptation and asset regression testing; a
   minimatch major needs matching/prebuild/fingerprint compatibility testing.
   An Expo SDK upgrade is a separate project, not an automatic security fix.
5. Remediate or explicitly accept this scoped residual build-tool risk before
   release. No advisory was hidden and no acceptance was recorded automatically.

## Validation

- Frontend: **122 tests passed**, including the unchanged security-disclosure
  assertion and the new cancellation regression. The original disclosure failure
  remains resolved; no security tests were removed or weakened.
- Web production export: passed after the update; source-map exposure check
  confirms the vulnerable leaf modules are absent from this export.
- All 122 frontend tests and the web export also passed under the deployment's
  Node 22 major, using an isolated npm-exec runtime rather than changing the
  system Node installation or application dependency declarations.
- Backend: **217 tests passed** after the lockfile update.
- Java: **10 tests passed**, with an explicit offline rerun.
- Post-update npm audit: 1 high, 11 moderate, no critical/low, both full and
  omit-dev audits. Source-verified C repair is distinguished from scanner counts.
- Clean isolated `npm ci --ignore-scripts`: 760 packages installed successfully
  from the updated lockfile; the cancellation regression passed against that
  clean installation as well. The unpatched negative control failed as expected.
- Production container rebuilt successfully. Runtime inspection confirmed no
  Node/npm or frontend dependency tree. The Linux release probe passed all 217
  tests, pip check, AI-module/Java integration, non-root/TLS/authentication checks
  and graceful shutdown. The real-HTTP container fixture passed 41 simulated
  transactions, owner isolation, idempotency and 80 concurrent calculator calls.
  No live Render configuration was changed.
- The release-test workload reached the 512 MiB limit (640 memory max events),
  with zero oom/oom_kill events and a clean shutdown. Real-HTTP fixture peak was
  about 358 MiB. These are test workloads, not a production capacity guarantee.

Ignored .local-backups/production-readiness and .local-backups/dependency-review
hold raw/sanitized audit evidence, upstream advisory/compare responses, the
unpatched negative-control test log and review exports. They are not release
files or deployment assets. Backend/TiDB/Gemini live tests from the completed
firewall verification remain unchanged; no new billable AI or database data
journey is needed to validate a Node build-tool-only patch.

## Exact release boundary and approval target

Target repository: **https://github.com/Revanth0701/Zettaremit**.
Deployment branch: **main**. Existing Render service:
**ZettaRemit-App / srv-dbdv8o3ncjis73dkflag**, Oregon; auto-deploy remains off.
The release worktree branch is release/tidb-reconciled-20261123, based on
canonical main 8ada74a. The original feature/gemini-ai-cleanup workspace is
preserved. Nothing has been committed or pushed by this review.

This security pass changes these source/review files:

- frontend/package-lock.json — glob 13.0.7 only relative to the pre-review lockfile.
- frontend/tests/dependency_security.test.cjs — behavioral cancellation regression.
- docs/DEPENDENCY_SECURITY_REVIEW.md — package/advisory/applicability review.
- docs/RENDER_RUNBOOK.md and docs/RELEASE.md — current results and approval gates.
- tools/prepare_release_manifest.py — include this review in the explicit inventory.
- docs/RELEASE_FILE_REVIEW.json — refreshed exact paths and content fingerprints.

The **complete** release candidate, including preserved existing application
work, is enumerated by path in docs/RELEASE_FILE_REVIEW.json. Its include/exclude
dispositions are the exact file boundary; the seven files above are only this
security pass, not a substitute for the full candidate. Optional generated
container evidence remains excluded. Run the inventory verifier before any
approved staging. No blanket add, commit, push, deployment or live Render update
is authorized by this report.

## Reconciled main-based verification ? 2026-11-23

The isolated release candidate is based on fetched canonical main 8ada74a and
preserves the upstream README/ignore/application improvements. Fresh audit still
reports one high and 11 moderate entries. Reconciled Node 22 frontend tests
122/122 and web export, backend 217, Java 10, Docker build/Linux 217-test probe
and real-HTTP fixture passed. The rebuilt image also passed all 19 restricted-
account live TiDB/Gemini checks. See RENDER_RUNBOOK.md for initial transient AI
check failure, memory limits, container shutdown probes and approval gates. No
additional dependency changes were introduced during reconciliation. The
remaining build-time image-size/minimatch risks require explicit owner acceptance;
this review does not accept them automatically.
