const mongoose = require("mongoose");

const savedInternshipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: "Internship", required: true },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

savedInternshipSchema.index({ userId: 1, internshipId: 1 }, { unique: true });

module.exports = mongoose.model("SavedInternship", savedInternshipSchema);
