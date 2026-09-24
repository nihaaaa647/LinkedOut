const mongoose = require("mongoose");

const eligibilitySchema = new mongoose.Schema(
  {
    branches: { type: [String], default: [] },
    minCgpa: { type: Number, min: 0, max: 10, default: 0 },
    years: { type: [Number], default: [] },
  },
  { _id: false }
);

const internshipSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    eligibility: { type: eligibilitySchema, required: true },
    location: { type: String, required: true, trim: true },
    deadline: { type: Date, required: true },
    stipend: { type: Number },
    requiredSkills: { type: [String], default: [] },
    workMode: { type: String, enum: ["remote", "hybrid", "onsite"] },
    duration: { type: String, trim: true },

    sourceType: { type: String, enum: ["scraped", "manual"], required: true },
    sourceUrl: { type: String },
    scrapedAt: { type: Date },

    trustScore: { type: Number, min: 0, max: 100 },
    eligibilityConfident: { type: Boolean, default: true },
    reportCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["published", "pending_review", "rejected", "closed"],
      required: true,
      default: "published",
    },
    // null = auto-decided by the trust-score system rather than a human (PRD's
    // reviewedBy: "system" sentinel, kept as a real ObjectId|null instead of a mixed
    // string/ObjectId type so the ref stays queryable/populatable).
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

internshipSchema.index({ deadline: 1 });
internshipSchema.index({ status: 1 });
internshipSchema.index({ company: 1 });
internshipSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Internship", internshipSchema);
