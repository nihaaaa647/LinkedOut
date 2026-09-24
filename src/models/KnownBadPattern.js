const mongoose = require("mongoose");

// Populated when an admin rejects a listing (Section 5/9). Future scraped listings are
// fuzzy-matched against active (non-retired) entries here to lower their trustScore.
// Business Rule 11: approving a resubmission from the same company retires the entry
// instead of leaving it to suppress that company's listings forever.
const knownBadPatternSchema = new mongoose.Schema(
  {
    company: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    sourceInternshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Internship" },
    retired: { type: Boolean, default: false },
    retiredAt: { type: Date },
  },
  { timestamps: true }
);

knownBadPatternSchema.index({ company: 1, retired: 1 });

module.exports = mongoose.model("KnownBadPattern", knownBadPatternSchema);
