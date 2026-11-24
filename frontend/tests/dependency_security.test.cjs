const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { glob } = require('glob');

test('glob cancellation stops directory reads after an aborted traversal step', async () => {
  const fixtures = path.resolve(__dirname, '../../.local-backups/dependency-review/fixtures');
  fs.mkdirSync(fixtures, { recursive: true });
  const directory = fs.mkdtempSync(path.join(fixtures, 'abort-'));
  assert(directory.startsWith(fixtures + path.sep));
  const controller = new AbortController();
  let reads = 0;
  try {
    for (let first = 0; first < 4; first++) {
      for (let second = 0; second < 4; second++) {
        fs.mkdirSync(path.join(directory, `a${first}`, `b${second}`, 'nested'), { recursive: true });
      }
    }
    const filesystem = {
      ...fs,
      readdir(location, options, callback) {
        reads++;
        fs.readdir(location, options, (error, entries) => {
          // Cancel at the first completed directory read, while entries remain.
          if (!controller.signal.aborted) controller.abort(new Error('synthetic cancellation'));
          callback(error, entries);
        });
      },
    };
    await assert.rejects(glob('**/*', {
      cwd: directory, fs: filesystem, signal: controller.signal,
    }), /synthetic cancellation/);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(reads, 1, 'An aborted walk must not continue reading child directories');
  } finally {
    // Remove only this test-created directory beneath the verified fixture root.
    assert(directory.startsWith(fixtures + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
