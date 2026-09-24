const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { getSkillGapAnalytics } = require("../controllers/analytics.controller");
const { revokeSessions } = require("../controllers/adminUser.controller");
const { runScrape, runNotify, runSkillGapSnapshot } = require("../controllers/adminJobs.controller");

const router = express.Router();

router.use(verifyToken, ...requireRole("admin"));

router.get("/analytics/skill-gaps", getSkillGapAnalytics);
router.patch("/users/:id/revoke-sessions", revokeSessions);

// Trigger a scheduled job immediately instead of waiting for its cron window
// (demo/grading convenience - see Section "Running the background jobs" in the README).
router.post("/jobs/scrape/run", runScrape);
router.post("/jobs/notify/run", runNotify);
router.post("/jobs/skill-gap-snapshot/run", runSkillGapSnapshot);

module.exports = router;
