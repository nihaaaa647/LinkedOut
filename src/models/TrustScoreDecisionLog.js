const mongoose = require("mongoose");

const trustScoreDecisionLogSchema = new mongoose.Schema(
  {
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },
    trustScore: { type: Number, required: true },
    signalsFired: { type: [String], default: [] },
    adminDecision: {
      type: String,
      enum: ["approved", "edited_approved", "rejected", "auto_published", "auto_rejected"],
      required: true,
    },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

trustScoreDecisionLogSchema.index({ internshipId: 1 });

module.exports = mongoose.model("TrustScoreDecisionLog", trustScoreDecisionLogSchema);
