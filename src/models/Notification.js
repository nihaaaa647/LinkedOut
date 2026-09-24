const mongoose = require("mongoose");

const NOTIFICATION_TYPES = ["deadline_reminder", "match_alert"];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Dedup guard (Section 7): one notification per user+internship+type per run window,
// so a job re-running within the same window doesn't spam duplicates.
notificationSchema.index({ userId: 1, internshipId: 1, type: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
