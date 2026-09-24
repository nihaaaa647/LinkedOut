const mongoose = require("mongoose");

// Six ingestion-time signals sum to the 0-100 trustScore (each contributes a sub-score
// in [0, weight]). Community reports are deliberately NOT one of these - a listing has
// zero reports at ingestion time; reports act as a separate live override afterward
// (Business Rule 10, via `reportThreshold` below), not a component of the initial score.
const DEFAULT_WEIGHTS = {
  sourceDomainReputation: 30,
  contactChannel: 15,
  descriptionQuality: 15,
  stipendRoleMismatch: 15,
  deadlinePlausibility: 10,
  duplicateScamPattern: 15,
};

const DEFAULT_CRITICAL_KEYWORDS = {
  paymentRequest: ["pay", "fee", "deposit", "refundable", "registration charge"],
  sensitiveInfoRequest: ["bank details", "aadhaar", "otp", "account number", "cvv"],
};

const trustScoreConfigSchema = new mongoose.Schema(
  {
    singleton: { type: Boolean, default: true, unique: true },
    weights: { type: Object, default: DEFAULT_WEIGHTS },
    criticalKeywords: { type: Object, default: DEFAULT_CRITICAL_KEYWORDS },
    reportThreshold: { type: Number, default: 3 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

async function getConfig() {
  let config = await mongoose.model("TrustScoreConfig").findOne({ singleton: true });
  if (!config) {
    config = await mongoose.model("TrustScoreConfig").create({ singleton: true });
  }
  return config;
}

trustScoreConfigSchema.statics.getConfig = getConfig;
trustScoreConfigSchema.statics.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
trustScoreConfigSchema.statics.DEFAULT_CRITICAL_KEYWORDS = DEFAULT_CRITICAL_KEYWORDS;

module.exports = mongoose.model("TrustScoreConfig", trustScoreConfigSchema);
