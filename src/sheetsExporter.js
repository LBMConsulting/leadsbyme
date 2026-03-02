'use strict';

require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A1';
const SERVICE_ACCOUNT_PATH = path.resolve(
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON || './service-account.json'
);

// Singleton auth client — initialized once, reused across calls
let _authClient = null;

async function getAuthClient() {
  if (_authClient) return _authClient;

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(
      `Service account file not found: ${SERVICE_ACCOUNT_PATH}\n` +
        'Set GOOGLE_SERVICE_ACCOUNT_JSON in .env and ensure the file exists.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _authClient = await auth.getClient();
  return _authClient;
}

/**
 * Push validated leads to Google Sheets.
 * Column order: Business Name | Address | Phone | Website | Maps URL | Email | Validation Status | Scraped At
 *
 * @param {Array<{
 *   name: string,
 *   address: string,
 *   phone: string,
 *   website: string,
 *   mapsUrl: string,
 *   email: string,
 *   validationStatus: string,
 *   scrapedAt: string
 * }>} leads
 */
async function pushToGoogleSheets(leads) {
  if (!leads || leads.length === 0) {
    logger.info('No leads to push to Google Sheets.');
    return;
  }

  const authClient = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const rows = leads.map((lead) => [
    lead.name || '',
    lead.address || '',
    lead.phone || '',
    lead.website || '',
    lead.mapsUrl || '',
    lead.email || '',
    lead.validationStatus || '',
    lead.scrapedAt || '',
  ]);

  logger.info(`Pushing ${rows.length} row(s) to Google Sheets (${SHEET_ID})…`);

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });

    const updates = response.data.updates || {};
    logger.info(
      `Google Sheets: appended ${updates.updatedRows || rows.length} row(s) ` +
        `to range ${updates.updatedRange || SHEET_RANGE}`
    );
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 403) {
        throw new Error(
          'Google Sheets 403 Forbidden — share the sheet with the service account email (Editor).'
        );
      }
      if (status === 404) {
        throw new Error(
          `Google Sheets 404 Not Found — check GOOGLE_SHEET_ID (${SHEET_ID}).`
        );
      }
    }
    throw err;
  }
}

module.exports = { pushToGoogleSheets };

// ─── Quick test ──────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const testLead = {
      name: 'Test Business',
      address: '123 Main St, Austin, TX',
      phone: '(512) 555-1234',
      website: 'https://example.com',
      mapsUrl: 'https://maps.google.com/?cid=test',
      email: 'test@example.com',
      validationStatus: 'valid',
      scrapedAt: new Date().toISOString(),
    };
    await pushToGoogleSheets([testLead]);
    console.log('Test row pushed successfully.');
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
