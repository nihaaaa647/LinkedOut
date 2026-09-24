const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    tokenVersion: { type: Number, default: 0 },

    branch: { type: String, trim: true },
    year: { type: Number },
    cgpa: { type: Number, min: 0, max: 10 },
    locationPreference: { type: String, trim: true },
    certifications: { type: [String], default: [] },

    skills: { type: [String], default: [] },

    resumeUrl: { type: String, default: null },
    resumeOriginalName: { type: String, default: null },
    resumeUploadedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
