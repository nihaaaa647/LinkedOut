const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, enum: ["course", "article", "doc"], required: true },
  },
  { _id: false }
);

const learningResourceSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true, unique: true, trim: true },
    resources: { type: [resourceSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LearningResource", learningResourceSchema);
