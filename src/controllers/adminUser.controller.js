const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { ok, ApiError } = require("../utils/apiResponse");

const revokeSessions = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $inc: { tokenVersion: 1 } }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  return ok(res, { id: user._id, tokenVersion: user.tokenVersion }, "User sessions revoked");
});

module.exports = { revokeSessions };
