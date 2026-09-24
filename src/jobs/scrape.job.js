const cron = require("node-cron");
const { scrapeInternshala } = require("../scrapers/internshala.scraper");
const { ingestScrapedListing } = require("../services/ingestListing");
const { scrapeCron } = require("../config/env");

// One adapter per source (Section 4) - add new sources here without touching
// ingestListing/trustScore. LinkedIn is deliberately not in this list (ToS risk,
// Section 4); it's admin-manual-entry only.
const SOURCES = [scrapeInternshala];

async function runScrapeJob() {
  console.log("[scrape.job] starting scrape run");
  let ingested = 0;
  let skippedDuplicates = 0;

  for (const scrape of SOURCES) {
    let rawListings = [];
    try {
      rawListings = await scrape();
    } catch (err) {
      console.error(`[scrape.job] source failed, continuing with remaining sources: ${err.message}`);
      continue;
    }

    for (const rawListing of rawListings) {
      try {
        const created = await ingestScrapedListing(rawListing);
        if (created) ingested++;
        else skippedDuplicates++;
      } catch (err) {
        console.warn(`[scrape.job] failed to ingest one listing: ${err.message}`);
      }
    }
  }

  console.log(`[scrape.job] run complete: ${ingested} ingested, ${skippedDuplicates} duplicates skipped`);
}

function scheduleScrapeJob() {
  cron.schedule(scrapeCron, () => {
    runScrapeJob().catch((err) => console.error("[scrape.job] unhandled error", err));
  });
  console.log(`[scrape.job] scheduled with cron "${scrapeCron}"`);
}

module.exports = { runScrapeJob, scheduleScrapeJob };
