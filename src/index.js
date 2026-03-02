'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const pLimit = require('p-limit');

const logger = require('./logger');
const { searchPlaces } = require('./mapsSearch');
const { extractEmailsFromWebsite } = require('./websiteEmailExtractor');
const { validateEmail } = require('./emailValidator');
const { pushToGoogleSheets } = require('./sheetsExporter');

// ─── Required environment variables ─────────────────────────────────────────
const REQUIRED_ENV = [
  'GOOGLE_PLACES_API_KEY',
  'MILLIONVERIFIER_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SHEET_ID',
];

const MAX_CONCURRENT_WEBSITES = parseInt(process.env.MAX_CONCURRENT_WEBSITES || '3', 10);
const MAX_CONCURRENT_EMAIL_VALIDATION = parseInt(
  process.env.MAX_CONCURRENT_EMAIL_VALIDATION || '5',
  10
);
const MAX_RESULTS_PER_SEARCH = parseInt(process.env.MAX_RESULTS_PER_SEARCH || '20', 10);
const OUTPUT_JSON_PATH = path.resolve(process.env.OUTPUT_JSON_PATH || './results.json');

// ─── Phase 1: Environment validation ────────────────────────────────────────
function validateEnvironment() {
  logger.info('Phase 1: Validating environment…');
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Copy .env.example to .env and fill in all values.');
    process.exit(1);
  }

  const serviceAccountPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!fs.existsSync(serviceAccountPath)) {
    logger.error(`Service account file not found: ${serviceAccountPath}`);
    logger.error('Download it from Google Cloud Console and save as service-account.json.');
    process.exit(1);
  }

  logger.info('Environment OK.');
}

// ─── Phase 2: Get user inputs ────────────────────────────────────────────────
async function getInputs() {
  logger.info('Phase 2: Getting inputs…');

  // CLI args: node src/index.js "keyword" "location"
  if (process.argv[2] && process.argv[3]) {
    const keyword = process.argv[2].trim();
    const location = process.argv[3].trim();
    logger.info(`Using CLI args — keyword: "${keyword}", location: "${location}"`);
    return { keyword, location };
  }

  // Interactive readline prompt
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  const keyword = (await ask('Search keyword (e.g. "plumber"): ')).trim();
  const location = (await ask('Location (e.g. "Austin, TX"): ')).trim();
  rl.close();

  if (!keyword || !location) {
    logger.error('Keyword and location are required.');
    process.exit(1);
  }

  return { keyword, location };
}

// ─── Main pipeline ───────────────────────────────────────────────────────────
async function run() {
  const startTime = Date.now();

  // Phase 1
  validateEnvironment();

  // Phase 2
  const { keyword, location } = await getInputs();

  // Phase 3: Search Places
  logger.info('Phase 3: Searching Google Places…');
  const businesses = await searchPlaces(keyword, location, MAX_RESULTS_PER_SEARCH);
  logger.info(`Phase 3 complete — ${businesses.length} businesses found.`);

  if (businesses.length === 0) {
    logger.warn('No businesses found. Exiting.');
    process.exit(0);
  }

  // Phase 4: Extract emails from websites
  logger.info('Phase 4: Extracting emails from websites…');
  const websiteLimit = pLimit(MAX_CONCURRENT_WEBSITES);

  const emailsByBusiness = await Promise.all(
    businesses.map((biz) =>
      websiteLimit(async () => {
        const emails = await extractEmailsFromWebsite(biz.website);
        return { business: biz, emails };
      })
    )
  );

  const totalRawEmails = emailsByBusiness.reduce((sum, b) => sum + b.emails.length, 0);
  logger.info(`Phase 4 complete — ${totalRawEmails} raw email(s) extracted.`);

  // Phase 5: Global email deduplication
  logger.info('Phase 5: Deduplicating emails globally…');
  const globalSeen = new Set();
  const emailEntries = []; // [{ email, business }]

  for (const { business, emails } of emailsByBusiness) {
    for (const email of emails) {
      if (!globalSeen.has(email)) {
        globalSeen.add(email);
        emailEntries.push({ email, business });
      }
    }
  }
  logger.info(`Phase 5 complete — ${emailEntries.length} unique email(s) to validate.`);

  // Phase 6: Validate emails
  logger.info('Phase 6: Validating emails via NeverBounce…');
  const validationLimit = pLimit(MAX_CONCURRENT_EMAIL_VALIDATION);

  const validationResults = await Promise.all(
    emailEntries.map(({ email, business }) =>
      validationLimit(async () => {
        const validation = await validateEmail(email);
        return { ...validation, business };
      })
    )
  );

  const validatedCount = validationResults.filter((r) => r.isValid).length;
  logger.info(
    `Phase 6 complete — ${validatedCount}/${emailEntries.length} email(s) validated.`
  );

  // Phase 7: Filter, save, and push
  logger.info('Phase 7: Saving results and pushing to Google Sheets…');
  const scrapedAt = new Date().toISOString();

  // Build full result set (all emails, valid or not) for JSON backup
  const allResults = validationResults.map(({ email, raw, result, isValid, business }) => ({
    name: business.name,
    address: business.address,
    phone: business.phone,
    website: business.website,
    mapsUrl: business.mapsUrl,
    email,
    validationStatus: (raw && raw.result) || result,
    isValid,
    validation: raw,
    scrapedAt,
  }));

  // Save all results to JSON (backup regardless of Sheets outcome)
  try {
    fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(allResults, null, 2), 'utf8');
    logger.info(`All results saved to ${OUTPUT_JSON_PATH}`);
  } catch (err) {
    logger.error(`Failed to save JSON backup: ${err.message}`);
  }

  // Push only valid leads to Sheets
  const validLeads = allResults.filter((r) => r.isValid);

  try {
    await pushToGoogleSheets(validLeads);
  } catch (err) {
    logger.error(`Google Sheets push failed (JSON backup exists): ${err.message}`);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info('─────────────────────────────────────────');
  logger.info(`Businesses found  : ${businesses.length}`);
  logger.info(`Emails extracted  : ${totalRawEmails} raw → ${emailEntries.length} unique`);
  logger.info(`Emails validated  : ${validatedCount} valid`);
  logger.info(`Results JSON      : ${OUTPUT_JSON_PATH}`);
  logger.info(`Duration          : ${elapsed}s`);
  logger.info('─────────────────────────────────────────');
}

run().catch((err) => {
  logger.error(`Fatal error: ${err.message}`, err);
  process.exit(1);
});
