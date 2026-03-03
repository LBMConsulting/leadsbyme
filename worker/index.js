'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { runPipeline } = require('./pipeline');
const logger = require('./logger');

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = 5000;

/**
 * Atomically claim the next PENDING search using FOR UPDATE SKIP LOCKED.
 * Returns the claimed Search row or null if none available.
 */
async function claimNextSearch() {
  const result = await prisma.$queryRaw`
    UPDATE "Search"
    SET status = 'RUNNING', "startedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = (
      SELECT id FROM "Search"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  return result.length > 0 ? result[0] : null;
}

/**
 * Update search progress in the DB.
 */
async function updateProgress(searchId, phase, detail) {
  try {
    await prisma.search.update({
      where: { id: searchId },
      data: {
        currentPhase: phase,
        phaseDetail: detail,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    logger.warn(`Failed to update progress for ${searchId}: ${err.message}`);
  }
}

/**
 * Process a single search: run pipeline, save leads, mark done/failed.
 */
async function processSearch(search) {
  logger.info(`Processing search ${search.id} — "${search.keyword}" in "${search.location}"`);

  try {
    const onProgress = ({ phase, detail }) => {
      logger.info(`[${search.id}] Phase ${phase}: ${detail}`);
      // Fire-and-forget DB update (don't await in hot path)
      updateProgress(search.id, phase, detail).catch(() => {});
    };

    const leads = await runPipeline(search, onProgress);

    // Save leads to DB
    if (leads.length > 0) {
      await prisma.lead.createMany({
        data: leads.map((lead) => ({
          ...lead,
          searchId: search.id,
        })),
        skipDuplicates: true,
      });
      logger.info(`[${search.id}] Saved ${leads.length} lead(s) to database.`);
    }

    // Mark search as DONE
    await prisma.search.update({
      where: { id: search.id },
      data: {
        status: 'DONE',
        currentPhase: 7,
        phaseDetail: `Completed — ${leads.length} lead(s) found.`,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info(`[${search.id}] Search completed successfully.`);
  } catch (err) {
    logger.error(`[${search.id}] Pipeline failed: ${err.message}`);

    // Mark search as FAILED
    try {
      await prisma.search.update({
        where: { id: search.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (updateErr) {
      logger.error(`[${search.id}] Failed to mark search as FAILED: ${updateErr.message}`);
    }
  }
}

/**
 * Main worker loop — poll for PENDING searches and process them.
 */
async function workerLoop() {
  logger.info('Worker started. Polling for pending searches…');

  while (true) {
    try {
      const search = await claimNextSearch();

      if (search) {
        await processSearch(search);
      } else {
        // No pending work — wait before polling again
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      logger.error(`Worker loop error: ${err.message}`);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully…');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully…');
  await prisma.$disconnect();
  process.exit(0);
});

workerLoop().catch((err) => {
  logger.error(`Fatal worker error: ${err.message}`);
  process.exit(1);
});
