// Platform-independent backend readiness polling helper for cold starts (e.g. Render Free)

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      return reject(new Error('Operation cancelled'));
    }
    const timer = setTimeout(() => {
      if (signal && signal.removeEventListener) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new Error('Operation cancelled'));
    }
    if (signal && signal.addEventListener) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Polls the backend health endpoint until it responds with a healthy status or max wait is reached.
 *
 * @param {Object} options
 * @param {Function} options.checkHealth - Function returning a promise that resolves if healthy
 * @param {number} [options.maxWaitMs=60000] - Maximum overall wait time in ms
 * @param {number} [options.pollIntervalMs=2000] - Delay between failed attempts in ms
 * @param {number} [options.healthTimeoutMs=6000] - Timeout per health check in ms
 * @param {number} [options.waitNoticeDelayMs=2500] - Delay before updating status to "This may take a moment."
 * @param {Function} [options.onStatusChange] - Callback receiving status string
 * @param {AbortSignal} [options.signal] - AbortSignal for unmount/cancellation
 * @returns {Promise<{ready: boolean, attempts: number, timedOut?: boolean, aborted?: boolean}>}
 */
async function waitForBackendReadiness({
  checkHealth,
  maxWaitMs = 60000,
  pollIntervalMs = 2000,
  healthTimeoutMs = 6000,
  waitNoticeDelayMs = 2500,
  onStatusChange = () => {},
  signal = null,
} = {}) {
  const startTime = Date.now();
  let attempts = 0;

  onStatusChange('Connecting to ZettaRemit...');

  let noticeTimer = null;
  if (waitNoticeDelayMs > 0) {
    noticeTimer = setTimeout(() => {
      onStatusChange('Connecting to ZettaRemit... This may take a moment.');
    }, waitNoticeDelayMs);
  }

  try {
    while (Date.now() - startTime < maxWaitMs) {
      if (signal && signal.aborted) {
        return { ready: false, attempts, aborted: true };
      }

      attempts++;
      try {
        const res = await checkHealth({ timeoutMs: healthTimeoutMs, signal });
        if (res && (res.status === 'ok' || res.simulation !== undefined || res.ok)) {
          return { ready: true, attempts };
        }
      } catch (err) {
        if (signal && signal.aborted) {
          return { ready: false, attempts, aborted: true };
        }
        // Health check failed or timed out — backend is likely sleeping.
        onStatusChange('Connecting to ZettaRemit... This may take a moment.');
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) break;

      const remaining = maxWaitMs - elapsed;
      const waitTime = Math.min(pollIntervalMs, remaining);
      try {
        await sleep(waitTime, signal);
      } catch (_) {
        return { ready: false, attempts, aborted: true };
      }
    }

    return { ready: false, attempts, timedOut: true };
  } finally {
    if (noticeTimer) clearTimeout(noticeTimer);
  }
}

let activeBackgroundWakeup = null;
let isKnownAwake = false;

/**
 * Initiates a non-blocking background GET /health request to wake up Render Free.
 * Ensures only one wake-up attempt runs concurrently and avoids duplicate loops.
 */
function triggerBackgroundWakeup({ checkHealth, timeoutMs = 15000, signal = null } = {}) {
  if (isKnownAwake) {
    return Promise.resolve({ ready: true, alreadyReady: true });
  }
  if (activeBackgroundWakeup) {
    return activeBackgroundWakeup;
  }
  if (typeof checkHealth !== 'function') {
    return Promise.resolve({ ready: false, error: 'No checkHealth function provided' });
  }

  activeBackgroundWakeup = (async () => {
    try {
      const res = await checkHealth({ timeoutMs, signal });
      if (res && (res.status === 'ok' || res.simulation !== undefined || res.ok)) {
        isKnownAwake = true;
        return { ready: true };
      }
      return { ready: false };
    } catch (_) {
      // Non-blocking wake-up timed out or failed while starting up
      return { ready: false };
    } finally {
      activeBackgroundWakeup = null;
    }
  })();

  return activeBackgroundWakeup;
}

function getBackendWakeupState() {
  return {
    isAwake: isKnownAwake,
    isWaking: activeBackgroundWakeup !== null,
  };
}

function markBackendAwake(val = true) {
  isKnownAwake = val;
}

module.exports = {
  waitForBackendReadiness,
  sleep,
  triggerBackgroundWakeup,
  getBackendWakeupState,
  markBackendAwake,
};
