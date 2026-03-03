'use strict';

require('dotenv').config();
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const cheerio = require('cheerio');
const logger = require('../worker/logger');

// Retry on network errors only — not on 4xx responses
const websiteAxios = axios.create({ timeout: 15000 });
axiosRetry(websiteAxios, {
  retries: 2,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => axiosRetry.isNetworkError(error),
});

// RFC-5321-ish email regex (intentionally permissive — filtering happens after)
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Domain suffixes that indicate false positives (image/script references)
const IGNORED_TLDS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'js', 'css', 'json', 'xml', 'map', 'woff', 'woff2', 'ttf',
]);

// Domains commonly used as placeholder / transactional noise
const IGNORED_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net',
  'sentry.io', 'sentry-cdn.com',
  'schema.org', 'w3.org', 'googleapis.com',
  'cloudflare.com', 'amazon.com', 'amazonaws.com',
]);

/**
 * Deduplicate, lowercase, and remove obvious false positives.
 *
 * @param {string[]} raw
 * @returns {string[]}
 */
function filterEmails(raw) {
  const seen = new Set();
  const result = [];

  for (const email of raw) {
    const lower = email.toLowerCase().trim();
    if (seen.has(lower)) continue;
    seen.add(lower);

    const [, domain] = lower.split('@');
    if (!domain) continue;

    const tld = domain.split('.').pop();
    if (IGNORED_TLDS.has(tld)) continue;
    if (IGNORED_DOMAINS.has(domain)) continue;

    result.push(lower);
  }

  return result;
}

/**
 * Extract email addresses from a website URL.
 * Never throws — returns [] on any failure.
 *
 * @param {string} url
 * @returns {Promise<string[]>}
 */
async function extractEmailsFromWebsite(url) {
  if (!url) return [];

  let html = '';

  try {
    const response = await websiteAxios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LeadScraper/1.0; +https://github.com/leadsbyme)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 5,
    });
    html = typeof response.data === 'string' ? response.data : '';
  } catch (err) {
    logger.debug(`Website fetch failed for ${url}: ${err.message}`);
    return [];
  }

  const emails = [];

  // Strategy 1: cheerio mailto links
  try {
    const $ = cheerio.load(html);
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (email) emails.push(email);
    });
  } catch (err) {
    logger.debug(`Cheerio parse failed for ${url}: ${err.message}`);
  }

  // Strategy 2: regex over raw HTML
  const regexMatches = html.match(EMAIL_REGEX) || [];
  emails.push(...regexMatches);

  const filtered = filterEmails(emails);
  if (filtered.length > 0) {
    logger.debug(`Extracted ${filtered.length} email(s) from ${url}`);
  }
  return filtered;
}

module.exports = { extractEmailsFromWebsite };

// ─── Quick test ──────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const testUrl = process.argv[2] || 'https://example.com';
    console.log(`Extracting emails from: ${testUrl}`);
    const emails = await extractEmailsFromWebsite(testUrl);
    console.log('Emails found:', emails);
  })();
}
