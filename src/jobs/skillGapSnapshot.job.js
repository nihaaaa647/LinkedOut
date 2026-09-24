const cron = require("node-cron");
const { snapshotSkillGap } = require("../services/analytics");
const { scrapeCron } = require("../config/env");

async function runSkillGapSnapshotJob() {
  console.log("[skillGapSnapshot.job] starting run");
  const count = await snapshotSkillGap();
  console.log(`[skillGapSnapshot.job] run complete: ${count} skill rows snapshotted`);
}

// Rides the same cadence as the scrape job - the underlying data (listings/profiles)
// only meaningfully shifts on that timescale anyway.
function scheduleSkillGapSnapshotJob() {
  cron.schedule(scrapeCron, () => {
    runSkillGapSnapshotJob().catch((err) => console.error("[skillGapSnapshot.job] unhandled error", err));
  });
  console.log(`[skillGapSnapshot.job] scheduled with cron "${scrapeCron}"`);
}

module.exports = { runSkillGapSnapshotJob, scheduleSkillGapSnapshotJob };
