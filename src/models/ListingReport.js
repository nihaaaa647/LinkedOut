const mongoose = require("mongoose");

const REASONS = ["payment_request", "sensitive_info_request", "suspicious_contact", "fake_company", "other"];

const listingReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },
    reason: { type: String, enum: REASONS, required: true },
    description: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// One report per user per listing - repeat clicks don't inflate the count.
listingReportSchema.index({ userId: 1, internshipId: 1 }, { unique: true });

module.exports = mongoose.model("ListingReport", listingReportSchema);
module.exports.REASONS = REASONS;
