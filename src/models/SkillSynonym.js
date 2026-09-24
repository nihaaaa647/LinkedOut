const mongoose = require("mongoose");

// Backs normalizeSkill() (Section 6): the union of `canonical` values across this
// collection is the maintained skills dictionary, and `aliases` map variant spellings
// ("JS", "ReactJS") back to their canonical form ("JavaScript", "React").
const skillSynonymSchema = new mongoose.Schema(
  {
    canonical: { type: String, required: true, unique: true, trim: true },
    aliases: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SkillSynonym", skillSynonymSchema);
