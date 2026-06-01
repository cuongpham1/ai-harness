'use strict';

/**
 * Exponential backoff retry utilities.
 */

/**
 * withRetry — retry async fn with exponential backoff.
 * @param {() => Promise<any>} fn
 * @param {{
 *   maxAttempts?: number,
 *   baseDelayMs?: number,
 *   maxDelayMs?: number,
 *   jitter?: boolean,
 *   retryOn?: (err: Error) => boolean
 * }} opts
 * @returns {Promise<any>}
 */
async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs  = 10000,
    jitter      = true,
    retryOn     = () => true,
  } = opts;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !retryOn(err)) {
        throw err;
      }
      const backoff = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const delay   = jitter ? backoff + Math.random() * baseDelayMs * 0.5 : backoff;
      process.stderr.write(`[retry] attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${Math.round(delay)}ms...\n`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw lastErr;
}

/**
 * withTimeout — wrap async fn with a timeout.
 * @param {() => Promise<any>} fn
 * @param {number} timeoutMs
 * @returns {Promise<any>}
 */
function withTimeout(fn, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fn().then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

module.exports = { withRetry, withTimeout };
