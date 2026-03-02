'use strict';

require('dotenv').config();
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const pLimit = require('p-limit');
const logger = require('./logger');

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const MAX_CONCURRENT_PLACES = parseInt(process.env.MAX_CONCURRENT_PLACES || '5', 10);

// Configure axios-retry: 3 retries with exponential backoff
axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount) => axiosRetry.exponentialDelay(retryCount) * 1000,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status === 429);
  },
});

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

// Non-retryable fatal statuses
const FATAL_STATUSES = new Set(['REQUEST_DENIED', 'OVER_QUERY_LIMIT']);

/**
 * Pause execution for ms milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch one page of text search results.
 * Returns { results, nextPageToken }.
 */
async function textSearchPage(query, pageToken) {
  const params = { query, key: PLACES_API_KEY };
  if (pageToken) params.pagetoken = pageToken;

  const { data } = await axios.get(TEXT_SEARCH_URL, { params, timeout: 15000 });
  const status = data.status;

  if (FATAL_STATUSES.has(status)) {
    throw new Error(`Places API fatal error: ${status} — check API key and billing.`);
  }

  if (status !== 'OK' && status !== 'ZERO_RESULTS') {
    logger.warn(`Places text search unexpected status: ${status}`);
  }

  return {
    results: data.results || [],
    nextPageToken: data.next_page_token || null,
  };
}

/**
 * Collect all place IDs for a query, up to maxResults.
 */
async function collectPlaceIds(query, maxResults) {
  const seen = new Set();
  const placeIds = [];
  let pageToken = null;
  let page = 0;

  do {
    if (page > 0) {
      // Google requires a 2-second delay before using a next_page_token
      await sleep(2000);
    }

    logger.debug(`Fetching text search page ${page + 1} for "${query}"${pageToken ? ' (paginated)' : ''}`);
    const { results, nextPageToken } = await textSearchPage(query, pageToken);
    page++;

    for (const place of results) {
      if (!seen.has(place.place_id)) {
        seen.add(place.place_id);
        placeIds.push(place.place_id);
      }
      if (placeIds.length >= maxResults) break;
    }

    pageToken = placeIds.length < maxResults ? nextPageToken : null;
  } while (pageToken && placeIds.length < maxResults);

  return placeIds;
}

/**
 * Fetch details for a single place ID.
 * Returns a business object or null on failure.
 */
async function getPlaceDetails(placeId) {
  try {
    const { data } = await axios.get(PLACE_DETAILS_URL, {
      params: {
        place_id: placeId,
        fields: 'name,formatted_address,formatted_phone_number,website,url',
        key: PLACES_API_KEY,
      },
      timeout: 15000,
    });

    if (data.status !== 'OK') {
      logger.warn(`Place details non-OK status for ${placeId}: ${data.status}`);
      return null;
    }

    const r = data.result;
    return {
      placeId,
      name: r.name || '',
      address: r.formatted_address || '',
      phone: r.formatted_phone_number || '',
      website: r.website || '',
      mapsUrl: r.url || '',
    };
  } catch (err) {
    logger.warn(`Failed to fetch details for place ${placeId}: ${err.message}`);
    return null;
  }
}

/**
 * Search Google Places for businesses matching keyword + location.
 *
 * @param {string} keyword
 * @param {string} location
 * @param {number} maxResults
 * @returns {Promise<Array>}
 */
async function searchPlaces(keyword, location, maxResults) {
  const query = `${keyword} in ${location}`;
  logger.info(`Searching Places for: "${query}" (max ${maxResults} results)`);

  const placeIds = await collectPlaceIds(query, maxResults);
  logger.info(`Found ${placeIds.length} unique place IDs — fetching details…`);

  const limit = pLimit(MAX_CONCURRENT_PLACES);
  const detailPromises = placeIds.map((id) => limit(() => getPlaceDetails(id)));
  const details = await Promise.all(detailPromises);

  const businesses = details.filter(Boolean);
  logger.info(`Retrieved details for ${businesses.length} businesses`);
  return businesses;
}

module.exports = { searchPlaces, getPlaceDetails };

// ─── Quick test (run directly) ──────────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    const results = await searchPlaces('plumber', 'Austin, TX', 5);
    console.log(JSON.stringify(results, null, 2));
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
