const mongoose = require("mongoose");

const STATUSES = ["Applied", "Shortlisted", "Rejected", "Selected", "Withdrawn"];

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },
    status: { type: String, enum: STATUSES, default: "Applied" },
    // Mirrors (status !== "Withdrawn"). MongoDB partial-index filters only support a
    // narrow operator set ($eq/$exists/$gt/$gte/$lt/$lte/$type, plus top-level $and) -
    // $ne isn't one of them - so uniqueness is scoped via this plain equality-checkable
    // flag instead of comparing status directly.
    isActive: { type: Boolean, default: true },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
    appliedAt: { type: Date, default: Date.now },
    withdrawnAt: { type: Date },
  },
  { timestamps: true }
);

// Business Rule 2: a user can only have one non-Withdrawn application per internship.
// A partial unique index (scoped to isActive: true) lets them re-apply after withdrawing
// - the old doc drops out of the index once isActive is false - without colliding with it.
applicationSchema.index(
  { userId: 1, internshipId: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model("Application", applicationSchema);
module.exports.STATUSES = STATUSES;
