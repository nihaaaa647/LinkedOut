const mongoose = require("mongoose");

const skillGapSnapshotSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true },
    demandCount: { type: Number, required: true },
    supplyCount: { type: Number, required: true },
    missingForEligibleCount: { type: Number, required: true },
    snapshotAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

skillGapSnapshotSchema.index({ snapshotAt: -1 });

module.exports = mongoose.model("SkillGapSnapshot", skillGapSnapshotSchema);
