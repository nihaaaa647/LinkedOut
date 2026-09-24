const fs = require("fs/promises");
const path = require("path");
const User = require("../models/User");
const SavedInternship = require("../models/SavedInternship");
const asyncHandler = require("../utils/asyncHandler");
const { ok, ApiError } = require("../utils/apiResponse");
const { normalizeSkills } = require("../services/normalizeSkill");
const { parseResumeSkills } = require("../services/resumeParser");

const updateProfile = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (updates.skills) {
    updates.skills = await normalizeSkills(updates.skills);
  }

  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, "User not found");
  return ok(res, user.toSafeJSON(), "Profile updated");
});

const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No resume file provided");

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const previousPath = user.resumeUrl;

  // Additive only (Section 6): parsed skills merge into skills[], nothing is removed,
  // and the student can still edit/remove any of them via PATCH /api/users/me.
  const parsedSkills = await parseResumeSkills(req.file.path, req.file.mimetype);
  const existing = new Set(user.skills.map((s) => s.toLowerCase()));
  const addedSkills = parsedSkills.filter((s) => !existing.has(s.toLowerCase()));

  user.resumeUrl = req.file.path;
  user.resumeOriginalName = req.file.originalname;
  user.resumeUploadedAt = new Date();
  user.skills = [...user.skills, ...addedSkills];
  await user.save();

  if (previousPath) {
    await fs.unlink(previousPath).catch(() => {});
  }

  return ok(res, { ...user.toSafeJSON(), addedSkills }, "Resume uploaded");
});

const deleteResume = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  if (user.resumeUrl) {
    await fs.unlink(user.resumeUrl).catch(() => {});
  }
  user.resumeUrl = null;
  user.resumeOriginalName = null;
  user.resumeUploadedAt = null;
  await user.save();

  return ok(res, user.toSafeJSON(), "Resume removed");
});

const downloadResume = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.resumeUrl) throw new ApiError(404, "No resume on file");

  // Served through this authenticated, ownership-checked route rather than a static
  // public directory (Section 16, File upload safety).
  return res.download(path.resolve(user.resumeUrl), user.resumeOriginalName || "resume");
});

const listSaved = asyncHandler(async (req, res) => {
  const saved = await SavedInternship.find({ userId: req.user.id })
    .sort({ savedAt: -1 })
    .populate("internshipId");
  return ok(res, saved, "Saved internships listed");
});

module.exports = { updateProfile, uploadResume, deleteResume, downloadResume, listSaved };
