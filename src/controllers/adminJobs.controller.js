const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/apiResponse");
const { runScrapeJob } = require("../jobs/scrape.job");
const { runNotifyJob } = require("../jobs/notify.job");
const { runSkillGapSnapshotJob } = require("../jobs/skillGapSnapshot.job");

// Admin utility to trigger a scheduled job immediately instead of waiting for its cron
// window - useful for demos/grading and for the Postman collection, which otherwise has
// no way to make notification/analytics endpoints non-empty on a freshly seeded DB.
const runJob = (jobFn) =>
  asyncHandler(async (req, res) => {
    await jobFn();
    return ok(res, null, "Job run complete");
  });

module.exports = {
  runScrape: runJob(runScrapeJob),
  runNotify: runJob(runNotifyJob),
  runSkillGapSnapshot: runJob(runSkillGapSnapshotJob),
};
