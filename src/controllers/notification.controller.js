const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const { ok, ApiError } = require("../utils/apiResponse");

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .populate("internshipId", "title company deadline");
  return ok(res, notifications, "Notifications listed");
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification || notification.userId.toString() !== req.user.id) {
    throw new ApiError(404, "Notification not found");
  }
  notification.read = true;
  await notification.save();
  return ok(res, notification, "Notification marked as read");
});

module.exports = { listNotifications, markRead };
