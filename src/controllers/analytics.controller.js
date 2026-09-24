const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/apiResponse");
const { computeSkillGapLive, getLatestSnapshot } = require("../services/analytics");

// No branch/year filter -> fast path reading the precomputed rollup (Section 10).
// A filter -> computed live, since precomputing every branch/year combination upfront
// isn't worth it at this project's scale.
const getSkillGapAnalytics = asyncHandler(async (req, res) => {
  const { branch, year } = req.query;
  const rows = branch || year ? await computeSkillGapLive({ branch, year: year ? Number(year) : undefined }) : await getLatestSnapshot();
  return ok(res, rows, "Skill-gap analytics");
});

module.exports = { getSkillGapAnalytics };
