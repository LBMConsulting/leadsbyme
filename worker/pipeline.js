'use strict';

require('dotenv').config();
const pLimit = require('p-limit');

const logger = require('./logger');
const { searchPlaces } = require('../legacy/mapsSearch');
const { extractEmailsFromWebsite } = require('../legacy/websiteEmailExtractor');
const { validateEmail } = require('../legacy/emailValidator');

const MAX_CONCURRENT_WEBSITES = parseInt(process.env.MAX_CONCURRENT_WEBSITES || '3', 10);
const MAX_CONCURRENT_EMAIL_VALIDATION = parseInt(
  process.env.MAX_CONCURRENT_EMAIL_VALIDATION || '5',
  10
);
const MAX_RESULTS_PER_SEARCH = parseInt(process.env.MAX_RESULTS_PER_SEARCH || '20', 10);

/**
 * Run the lead generation pipeline for a given search.
 *
 * Phases (1 & 2 removed — env always valid, inputs come from DB):
 *   Phase 3: Search Google Places
 *   Phase 4: Extract emails from websites
 *   Phase 5: Deduplicate emails
 *   Phase 6: Validate emails
 *   Phase 7: Build result set
 *
 * @param {{ id: string, keyword: string, location: string }} search
 * @param {(progress: { phase: number, detail: string }) => void} onProgress
 * @returns {Promise<Array>} Array of lead objects ready for DB insert
 */
async function runPipeline(search, onProgress) {
  const { keyword, location } = search;

  // Phase 3: Search Places
  onProgress({ phase: 3, detail: `Searching Google Places for "${keyword}" in "${location}"…` });
  const businesses = await searchPlaces(keyword, location, MAX_RESULTS_PER_SEARCH);
  logger.info(`[${search.id}] Phase 3 complete — ${businesses.length} businesses found.`);
  onProgress({ phase: 3, detail: `Found ${businesses.length} businesses.` });

  if (businesses.length === 0) {
    logger.warn(`[${search.id}] No businesses found. Returning empty result.`);
    return [];
  }

  // Phase 4: Extract emails from websites
  onProgress({ phase: 4, detail: `Extracting emails from ${businesses.length} websites…` });
  const websiteLimit = pLimit(MAX_CONCURRENT_WEBSITES);
  let websitesDone = 0;

  const emailsByBusiness = await Promise.all(
    businesses.map((biz) =>
      websiteLimit(async () => {
        const emails = await extractEmailsFromWebsite(biz.website);
        websitesDone++;
        // Fire-and-forget progress updates inside pLimit loop
        onProgress({
          phase: 4,
          detail: `Crawled ${websitesDone}/${businesses.length} websites…`,
        });
        return { business: biz, emails };
      })
    )
  );

  const totalRawEmails = emailsByBusiness.reduce((sum, b) => sum + b.emails.length, 0);
  logger.info(`[${search.id}] Phase 4 complete — ${totalRawEmails} raw email(s) extracted.`);

  // Phase 5: Global email deduplication
  onProgress({ phase: 5, detail: 'Deduplicating emails…' });
  const globalSeen = new Set();
  const emailEntries = [];

  for (const { business, emails } of emailsByBusiness) {
    for (const email of emails) {
      if (!globalSeen.has(email)) {
        globalSeen.add(email);
        emailEntries.push({ email, business });
      }
    }
  }
  logger.info(`[${search.id}] Phase 5 complete — ${emailEntries.length} unique email(s) to validate.`);
  onProgress({ phase: 5, detail: `${emailEntries.length} unique email(s) to validate.` });

  // Phase 6: Validate emails
  onProgress({ phase: 6, detail: `Validating ${emailEntries.length} email(s)…` });
  const validationLimit = pLimit(MAX_CONCURRENT_EMAIL_VALIDATION);
  let validatedDone = 0;

  const validationResults = await Promise.all(
    emailEntries.map(({ email, business }) =>
      validationLimit(async () => {
        const validation = await validateEmail(email);
        validatedDone++;
        onProgress({
          phase: 6,
          detail: `Validated ${validatedDone}/${emailEntries.length} email(s)…`,
        });
        return { ...validation, business };
      })
    )
  );

  const validatedCount = validationResults.filter((r) => r.isValid).length;
  logger.info(
    `[${search.id}] Phase 6 complete — ${validatedCount}/${emailEntries.length} valid.`
  );

  // Phase 7: Build result set
  onProgress({ phase: 7, detail: 'Saving results…' });

  const leads = validationResults.map(({ email, raw, isValid, business }) => ({
    placeId: business.placeId || null,
    businessName: business.name || '',
    address: business.address || null,
    phone: business.phone || null,
    website: business.website || null,
    mapsUrl: business.mapsUrl || null,
    email,
    isValid,
    validationStatus: (raw && raw.result) || null,
    validationRaw: raw || null,
  }));

  logger.info(`[${search.id}] Phase 7 complete — ${leads.length} lead(s) ready.`);
  onProgress({ phase: 7, detail: `Done — ${leads.length} lead(s) found (${validatedCount} valid).` });

  return leads;
}

module.exports = { runPipeline };
