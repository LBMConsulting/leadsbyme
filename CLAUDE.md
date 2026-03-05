# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Build production bundle (requires DATABASE_URL)
npm run start        # Run production server
npm run worker       # Run background worker process (separate service)

npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Create and apply migrations (dev)
npm run db:push      # Push schema to DB without migration file
npm run db:studio    # Open Prisma Studio GUI
```

No lint or test scripts are configured.

## Git workflow

Commit and push to GitHub after every meaningful unit of work — a working feature, a bug fix, a config change. Never leave significant work uncommitted.

```bash
git add <files>
git commit -m "Short imperative summary

Optional body explaining why, not what."
git push origin master
```

Commit message rules: imperative mood ("Add X", "Fix Y", "Remove Z"), under 72 chars on the first line. Group related changes into one commit rather than committing file by file. The remote is `https://github.com/LBMConsulting/leadsbyme` — `gh` is configured as the credential helper so push works without a password.

## Architecture

**LeadsByMe** is a Next.js 14 SaaS app that finds B2B leads from Google Maps. Two independent processes run on Railway:

- **Web** (`npm run start`) — Next.js App Router, handles UI and API
- **Worker** (`npm run worker`) — Node.js polling loop that processes searches

### End-to-end flow

1. User submits a search (keyword + location) → POST `/api/searches` creates a `Search` row with `status=PENDING`
2. Worker polls for `PENDING` searches every 5s using `FOR UPDATE SKIP LOCKED` (safe for multiple worker instances), claims one, sets `status=RUNNING`
3. Worker runs `worker/pipeline.js` — 7-phase pipeline: Google Places API → website crawling → email extraction → deduplication → MillionVerifier validation → lead records saved to DB
4. Web UI subscribes to `/api/searches/{id}/progress` SSE stream, which polls DB every 2s and sends a heartbeat every 30s (prevents Railway's 60s timeout). Stream closes when search reaches `DONE` or `FAILED`.

### Split NextAuth config (critical)

Two auth config files exist because `bcryptjs` crashes in the Edge Runtime:

- `lib/auth.ts` — Full config with Credentials provider + bcrypt. Used by API route handlers only.
- `lib/auth.config.ts` — Edge-safe config (no providers). Used by `middleware.ts` only.

**`middleware.ts` must import from `lib/auth.config.ts`**, not `lib/auth.ts`.

### Key architectural details

- `worker/` and `legacy/` are plain JavaScript (excluded from TypeScript in `tsconfig.json`)
- `legacy/` contains the original CLI code (mapsSearch.js, websiteEmailExtractor.js, emailValidator.js) — copied verbatim, not modified
- `p-limit` is pinned to v3.x (CommonJS) — v4+ is ESM-only and breaks the worker
- The SSE route (`app/api/searches/[id]/progress/route.ts`) requires `X-Accel-Buffering: no` header for Railway nginx
- Prisma client is a singleton in `lib/prisma.ts` to survive Next.js dev hot-reload

### Database models

- `Search` — Core job record: `status` (PENDING/RUNNING/DONE/FAILED), `currentPhase`, `phaseDetail`, `keyword`, `location`
- `Lead` — Results linked to a search: `businessName`, `email`, `isValid`, `validationStatus`, `validationRaw`
- `User`, `Account`, `Session`, `VerificationToken` — Standard NextAuth tables

## Environment variables

See `.env.example`. Required vars:

```
DATABASE_URL
NEXTAUTH_URL
NEXTAUTH_SECRET          # openssl rand -base64 32
GOOGLE_PLACES_API_KEY
MILLIONVERIFIER_API_KEY
```

Railway deployment: the web service runs `npx prisma migrate deploy` as its `releaseCommand` (see `railway.json`). The worker service needs a separate Railway service with start command `node worker/index.js`.
