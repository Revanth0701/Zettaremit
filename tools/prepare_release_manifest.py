"""Review changed files without staging, committing, or copying private files.

Generate an explicit file list for the current coherent application candidate.
--verify checks fingerprints and rejects staged paths outside that list.
Existing runtime features are included explicitly, not silently discarded.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/RELEASE_FILE_REVIEW.json'
DOCS = {'README.md', 'docs/RELEASE.md', 'docs/RENDER_RUNBOOK.md',
        'docs/TIDB_MIGRATION.md', 'docs/AI_UPGRADE.md', 'docs/REGISTRATION_CONTRACT.md',
        'docs/DEPENDENCY_SECURITY_REVIEW.md'}
TOOLS = {'tools/test_ai_offline.py', 'tools/test_container_local.py',
         'tools/test_internal_e2e.py', 'tools/test_release_container.py',
         'tools/test_tidb_smoke.py', 'tools/prepare_release_manifest.py'}

# Already committed upstream: retain historical evidence and optional local workflows.
RETAINED_BASELINE = ('docs/LOCAL_AI_TESTING.md', 'docs/LOCAL_BROWSER_VERIFICATION.md', 'docs/PRODUCTION_DEPLOYMENT_READINESS.md', 'docs/PRODUCTION_RELEASE_MANIFEST.json', 'docs/PRODUCTION_ROLLBACK_PLAN.md', 'docs/REPOSITORY_UNIFICATION_INVENTORY.json', 'docs/REPOSITORY_UNIFICATION_PLAN.md', 'frontend/tests/approved_ux.browser.cjs', 'frontend/tests/navigation.browser.cjs', 'frontend/tests/registration.browser.cjs', 'frontend/tests/signup_inputs.browser.cjs', 'tools/start_local_demo.py', 'tools/test_local_ai_integration.py', 'tools/test_local_browser.cjs')


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8')


def classify(path):
    if (Path(path).name.startswith('.env') and not path.endswith('.env.example')) or Path(path).suffix in {'.pem','.key','.p12','.jks','.db','.sqlite','.sqlite3','.dump'}:
        raise ValueError('Private file is visible to Git; fix its exclusion before release: ' + path)
    if path.startswith('.vscode/'):
        return 'exclude_local_editor', 'Personal IDE configuration; no runtime dependency.'
    if path.startswith('docs/CONTAINER_'):
        return 'exclude_generated_evidence', 'Machine-specific test output; summarized in runbook.'
    if path == 'docs/RELEASE_FILE_REVIEW.json':
        return 'include_release_review', 'Explicit candidate inventory; self-hash intentionally omitted.'
    if path in DOCS:
        return 'include_release_documentation', 'Current application contract or release instructions.'
    if path.startswith('docs/'):
        return 'exclude_historical_or_local_documentation', 'Preserved locally; not needed for this TiDB/Render release.'
    if path in TOOLS or path.startswith('backend/test_'):
        return 'include_validation', 'Required backend, container or migration validation.'
    if path.startswith('tools/'):
        return 'exclude_local_helpers', 'Optional local demo/browser workflow; not required for this release.'
    if path.startswith('frontend/tests/'):
        if path.endswith('.test.cjs'):
            return 'include_validation', 'Part of the frontend npm test suite.'
        return 'exclude_optional_browser_workflows', 'Preserved optional browser checks; not part of npm test or runtime.'
    if path in {'.gitignore', 'Dockerfile', 'render.yaml', 'deployment/.env.example'}:
        return 'include_deployment', 'TiDB configuration, secret exclusion or container deployment.'
    if path.startswith('backend/') or path.startswith('frontend/'):
        return 'include_existing_application_work', 'Current runtime feature or dependency; preserves existing application functionality.'
    raise ValueError('Unclassified changed path: ' + path)


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    if args.verify:
        report = json.loads(MANIFEST.read_text(encoding='utf-8'))
        for item in report.get('retained_upstream_artifacts', []):
            assert digest(item['path']) == item['sha256'], 'Retained upstream artifact changed: ' + item['path']
        included = {item['path'] for item in report['files'] if item['disposition'].startswith('include_')}
        for item in report['files']:
            if item['sha256'] is not None:
                assert digest(item['path']) == item['sha256'], 'File changed after review: ' + item['path']
        current = set(filter(None, git('diff', '--name-only', '-z').split('\0'))) | set(filter(None, git('ls-files', '--others', '--exclude-standard', '-z').split('\0')))
        assert current <= {item['path'] for item in report['files']}, 'New unreviewed files exist; regenerate the inventory'
        staged = set(filter(None, git('diff', '--cached', '--name-only', '-z').split('\0')))
        assert staged <= included, 'Index contains paths excluded from this release review'
        print(json.dumps({'review_fingerprints_valid': True, 'staged_files': len(staged),
                          'unexpected_staged_files': 0}))
        return
    changed = set(filter(None, git('diff', '--name-only', '-z').split('\0')))
    untracked = set(filter(None, git('ls-files', '--others', '--exclude-standard', '-z').split('\0')))
    files = []
    for path in sorted(changed | untracked | {'docs/RELEASE_FILE_REVIEW.json'}):
        disposition, reason = classify(path)
        files.append(dict(path=path, status='untracked' if path in untracked else 'modified',
                          disposition=disposition, reason=reason,
                          sha256=None if path == 'docs/RELEASE_FILE_REVIEW.json' else digest(path)))
    report = dict(scope='Current coherent application plus TiDB/Render release preparation',
                  approval='Not approved; no files staged, committed or pushed by this tool',
                  existing_work='Existing AI, authentication and frontend changes are explicitly included as current application work. This is not a migration-only patch.',
                  private_exclusions=['backend/.env', 'backend/.env.cloud', 'backend/certs/',
                                      '.local-backups/', 'node_modules/', '.venv/', 'build/', 'dist/'],
                  target_repository='Revanth0701/Zettaremit', deployment_branch='main',
                  reviewed_base=git('rev-parse', 'HEAD').strip(),
                  retained_upstream_artifacts=[dict(path=p, action='retain_unchanged', sha256=digest(p),
                      reason='Dated historical evidence or optional local test/helper; not runtime assets. No removal authorized.')
                      for p in RETAINED_BASELINE if (ROOT/p).exists()],
                  files=files)
    MANIFEST.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    destination = ROOT / '.local-backups/release-review'
    destination.mkdir(parents=True, exist_ok=True)
    included = [item['path'] for item in files if item['disposition'].startswith('include_')]
    (destination / 'include-paths.txt').write_text('\n'.join(included) + '\n', encoding='utf-8')
    counts = {key: sum(item['disposition'] == key for item in files)
              for key in sorted({item['disposition'] for item in files})}
    print(json.dumps({'reviewed_changed_or_untracked_files': len(files), 'dispositions': counts}))


if __name__ == '__main__':
    main()
