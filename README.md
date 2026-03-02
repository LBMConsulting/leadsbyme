# LeadsByMe

A production-ready Node.js CLI that:
1. Searches Google Places for businesses matching a keyword + location
2. Crawls their websites to extract email addresses
3. Validates each email via MillionVerifier
4. Appends only valid leads to a Google Sheet

---

## Prerequisites

- Node.js ≥ 16
- Google Cloud project with **Places API** and **Google Sheets API** enabled
- MillionVerifier account with API credits

---

## Google Cloud Setup

### 1. Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services → Library**
4. Enable **Places API**
5. Enable **Google Sheets API**

### 2. Create API Key (for Places)

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → API Key**
3. (Recommended) Restrict key to **Places API**
4. Copy key → paste into `.env` as `GOOGLE_PLACES_API_KEY`

### 3. Create Service Account (for Sheets)

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → Service Account**
3. Give it a name, click **Create and Continue**, skip optional fields
4. On the service account page, go to **Keys → Add Key → Create new key → JSON**
5. Download the JSON file → save as `service-account.json` in the project root
6. Set `GOOGLE_SERVICE_ACCOUNT_JSON=./service-account.json` in `.env`

### 4. Set Up Google Sheet

1. Create a new Google Sheet at [sheets.google.com](https://sheets.google.com)
2. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```
3. Paste it into `.env` as `GOOGLE_SHEET_ID`
4. Add headers to **row 1** (columns A–H):
   ```
   Business Name | Address | Phone | Website | Maps URL | Email | Validation Status | Scraped At
   ```
5. Share the sheet with the **service account email** (found in the JSON file under `client_email`) — grant **Editor** access

---

## Installation

```bash
cd leadsbyme-dev
npm install
```

---

## Configuration

Copy `.env` and fill in your keys:

```bash
cp .env .env.local   # optional — .env is already gitignored
```

| Variable | Description |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Google Maps / Places API key |
| `MILLIONVERIFIER_API_KEY` | MillionVerifier API key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Path to service account JSON file |
| `GOOGLE_SHEET_ID` | Google Sheet ID (from URL) |
| `GOOGLE_SHEET_RANGE` | Target range, default `Sheet1!A1` |
| `MAX_CONCURRENT_PLACES` | Parallel Place Details requests (default 5) |
| `MAX_CONCURRENT_WEBSITES` | Parallel website fetches (default 3) |
| `MAX_CONCURRENT_EMAIL_VALIDATION` | Parallel email validation checks (default 5) |
| `MAX_RESULTS_PER_SEARCH` | Max businesses per search (default 20) |
| `OUTPUT_JSON_PATH` | JSON backup file path (default `./results.json`) |
| `LOG_LEVEL` | Winston log level: `error`, `warn`, `info`, `debug` |
| `CATCH_ALL_IS_VALID` | Treat `catch_all` results as valid when set to `"true"` (default `false`) |

---

## Usage

### CLI arguments (non-interactive)

```bash
node src/index.js "plumber" "Austin, TX"
```

### Interactive prompt

```bash
node src/index.js
# → Search keyword: plumber
# → Location: Austin, TX
```

### Dev mode (auto-restart on file changes)

```bash
npm run dev -- "plumber" "Austin, TX"
```

---

## Module Testing

Test each module individually before a full run:

```bash
# 1. Places API
node src/mapsSearch.js

# 2. Email extraction (pass any URL)
node src/websiteEmailExtractor.js https://example.com

# 3. MillionVerifier validation (pass any email)
node src/emailValidator.js test@example.com

# 4. Google Sheets (writes a test row)
node src/sheetsExporter.js
```

---

## Pipeline Phases

| Phase | What happens |
|---|---|
| 1 | Validate all env vars + service account file exists |
| 2 | Read keyword + location from CLI args or prompt |
| 3 | Google Places Text Search → Place Details |
| 4 | Crawl each website for email addresses |
| 5 | Deduplicate emails globally |
| 6 | Validate each unique email via MillionVerifier |
| 7 | Save all results to `results.json`; push valid leads to Google Sheets |

---

## Output

**`results.json`** — full backup of every email found (valid and invalid):

```json
[
  {
    "name": "Austin Plumbing Co.",
    "address": "123 Main St, Austin, TX 78701",
    "phone": "(512) 555-0100",
    "website": "https://austinplumbing.com",
    "mapsUrl": "https://maps.google.com/?cid=...",
    "email": "info@austinplumbing.com",
    "validationStatus": "valid",
    "isValid": true,
    "scrapedAt": "2026-03-01T12:00:00.000Z"
  }
]
```

**Google Sheet** — one row per validated (`isValid: true`) lead, columns A–H.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Missing env var or service account file | `process.exit(1)` before any API calls |
| Places `REQUEST_DENIED` / `OVER_QUERY_LIMIT` | Fatal — check API key and billing |
| Single place detail fetch fails | Skipped (non-fatal) |
| Website 4xx / timeout / ECONNREFUSED | Returns no emails (non-fatal) |
| NeverBounce 401 / 402 | Fatal — check key and credits |
| NeverBounce 429 | Retried 3× with exponential backoff |
| Google Sheets push fails | Logged as error; JSON backup is preserved |

Logs are written to:
- `logs/combined.log` — all levels
- `logs/error.log` — errors only

---

## Project Structure

```
├── src/
│   ├── index.js                  # 7-phase orchestrator
│   ├── logger.js                 # Winston logger singleton
│   ├── mapsSearch.js             # Google Places Text Search + Details
│   ├── websiteEmailExtractor.js  # Website crawl + email extraction
│   ├── emailValidator.js         # MillionVerifier single-check
│   └── sheetsExporter.js         # Google Sheets API v4 append
├── .env                          # API keys (gitignored)
├── service-account.json          # GCP service account (gitignored)
├── results.json                  # Output backup (gitignored)
└── package.json
```
