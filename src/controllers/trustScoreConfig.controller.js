const TrustScoreConfig = require("../models/TrustScoreConfig");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/apiResponse");

const getTrustScoreConfig = asyncHandler(async (req, res) => {
  const config = await TrustScoreConfig.getConfig();
  return ok(res, config, "Trust score configuration");
});

const updateTrustScoreConfig = asyncHandler(async (req, res) => {
  const config = await TrustScoreConfig.getConfig();
  Object.assign(config, req.body, { updatedBy: req.user.id });
  await config.save();
  return ok(res, config, "Trust score configuration updated");
});

module.exports = { getTrustScoreConfig, updateTrustScoreConfig };
