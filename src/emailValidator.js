'use strict';

require('dotenv').config();
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const logger = require('./logger');

const MILLIONVERIFIER_API_KEY = process.env.MILLIONVERIFIER_API_KEY;
const CATCH_ALL_IS_VALID = process.env.CATCH_ALL_IS_VALID === 'true';
const MV_URL = 'https://api.millionverifier.com/api/v3';
const MV_TIMEOUT = parseInt(process.env.MILLIONVERIFIER_TIMEOUT || '20', 10);

// Retry 429 rate-limit responses with exponential backoff (3 tries)
const mvAxios = axios.create({ timeout: (MV_TIMEOUT + 5) * 1000 });
axiosRetry(mvAxios, {
  retries: 3,
  retryDelay: (retryCount) => Math.pow(2, retryCount) * 1000,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status === 429)
    );
  },
});

/**
 * Map a MillionVerifier `result` string to an isValid boolean.
 *
 * MillionVerifier result values:
 *   "ok"          — deliverable; treat as valid
 *   "invalid"     — undeliverable
 *   "disposable"  — disposable/temporary address
 *   "catch_all"   — domain accepts all mail; deliverability uncertain
 *   "unknown"     — could not determine
 *
 * To accept catch_all addresses as valid, change the condition below.
 */
function resultToIsValid(result) {
  if (result === 'ok') return true;
  if (result === 'catch_all') return CATCH_ALL_IS_VALID;
  return false; // "invalid", "disposable", "unknown"
}

/**
 * Validate a single email address via MillionVerifier Single API.
 *
 * @param {string} email
 * @returns {Promise<{ email: string, isValid: boolean, raw?: object }>}
 */
async function validateEmail(email) {
  try {
    const { data } = await mvAxios.get(MV_URL, {
      params: {
        api: MILLIONVERIFIER_API_KEY,
        email,
        timeout: MV_TIMEOUT,
      },
    });

    // MillionVerifier returns error codes in the response body for auth/billing issues
    // error: 1 = invalid API key, 2 = blocked IP, 3 = insufficient credits
    if (data.error && data.error > 0) {
      throw new Error(
        `MillionVerifier fatal error (code ${data.error}): ${data.error_message || 'check MILLIONVERIFIER_API_KEY and account credits'}`
      );
    }

    const result = data.result || 'unknown';
    const isValid = resultToIsValid(result);

    logger.debug(`MillionVerifier [${email}]: ${result} → isValid=${isValid}`);

    return { email, isValid, raw: data };
  } catch (err) {
    // Fatal: bad API key or blocked IP
    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
      throw new Error(
        `MillionVerifier ${err.response.status} — check MILLIONVERIFIER_API_KEY and account status.`
      );
    }

    // Re-throw our own fatal errors (from the body error-code check above)
    if (err.message.startsWith('MillionVerifier fatal')) {
      throw err;
    }

    // Non-fatal: network errors, timeouts, unexpected responses
    logger.warn(`MillionVerifier validation failed for ${email}: ${err.message}`);
    const fallbackRaw =
      (err.response && err.response.data) || {
        result: 'unknown',
        error: 'request_failed',
        error_message: err.message,
      };
    return { email, isValid: false, raw: fallbackRaw };
  }
}

module.exports = { validateEmail };

// ─── Quick test ──────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const testEmail = process.argv[2] || 'test@example.com';
    console.log(`Validating: ${testEmail}`);
    const result = await validateEmail(testEmail);
    console.log(JSON.stringify(result, null, 2));
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
