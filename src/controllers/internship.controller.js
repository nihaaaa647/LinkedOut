const Internship = require("../models/Internship");
const SavedInternship = require("../models/SavedInternship");
const ListingReport = require("../models/ListingReport");
const KnownBadPattern = require("../models/KnownBadPattern");
const TrustScoreDecisionLog = require("../models/TrustScoreDecisionLog");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created, ApiError } = require("../utils/apiResponse");
const { reportThreshold } = require("../config/env");
const { computeMatch } = require("../services/matchScore");

// --- Public / student browse ---

const listInternships = asyncHandler(async (req, res) => {
  const { page, limit, location, domain, workMode, minStipend, deadlineBefore } = req.query;

  const filter = { status: "published" };
  if (location) filter.location = new RegExp(location, "i");
  if (domain) filter.$text = { $search: domain };
  if (workMode) filter.workMode = workMode;
  if (minStipend !== undefined) filter.stipend = { $gte: minStipend };
  if (deadlineBefore) filter.deadline = { ...filter.deadline, $lte: deadlineBefore };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Internship.find(filter).sort({ deadline: 1 }).skip(skip).limit(limit),
    Internship.countDocuments(filter),
  ]);

  return ok(res, { items, page, limit, total, pages: Math.ceil(total / limit) }, "Internships listed");
});

const getInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findOne({ _id: req.params.id, status: "published" });
  if (!internship) throw new ApiError(404, "Internship not found");

  // Match score + recommended learning are computed only for authenticated users (Section 6).
  const payload = internship.toObject();
  if (req.user) {
    const user = await User.findById(req.user.id);
    const match = await computeMatch(user, internship);
    Object.assign(payload, match);
  }

  return ok(res, payload, "Internship detail");
});

// --- Save / unsave ---

const saveInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findOne({ _id: req.params.id, status: "published" });
  if (!internship) throw new ApiError(404, "Internship not found");

  await SavedInternship.updateOne(
    { userId: req.user.id, internshipId: req.params.id },
    { $setOnInsert: { savedAt: new Date() } },
    { upsert: true }
  );
  return ok(res, null, "Internship saved");
});

const unsaveInternship = asyncHandler(async (req, res) => {
  await SavedInternship.deleteOne({ userId: req.user.id, internshipId: req.params.id });
  return ok(res, null, "Internship unsaved");
});

// --- Community reporting ---

const reportInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id);
  if (!internship) throw new ApiError(404, "Internship not found");

  const existing = await ListingReport.findOne({ userId: req.user.id, internshipId: req.params.id });
  if (existing) throw new ApiError(409, "You have already reported this listing");

  await ListingReport.create({
    userId: req.user.id,
    internshipId: req.params.id,
    reason: req.body.reason,
    description: req.body.description,
  });

  internship.reportCount += 1;

  // Business Rule 10: a community signal can override an automated pass - a published
  // listing crossing the report threshold is force-moved back to review regardless of
  // its original trustScore.
  if (internship.status === "published" && internship.reportCount >= reportThreshold) {
    internship.status = "pending_review";
  }
  await internship.save();

  return created(res, { reportCount: internship.reportCount, status: internship.status }, "Report submitted");
});

// --- Admin management ---

const adminListInternships = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const pageNum = Number(page) || 1;
  const limitNum = Math.min(Number(limit) || 50, 100);
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Internship.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Internship.countDocuments(filter),
  ]);

  return ok(res, { items, page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }, "Internships listed");
});

const adminCreateInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.create({
    ...req.body,
    sourceType: "manual",
    status: "published",
    reviewedBy: req.user.id,
    reviewedAt: new Date(),
  });
  return created(res, internship, "Internship created");
});

const adminUpdateInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!internship) throw new ApiError(404, "Internship not found");
  return ok(res, internship, "Internship updated");
});

const adminCloseInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findByIdAndUpdate(
    req.params.id,
    { status: "closed" },
    { new: true }
  );
  if (!internship) throw new ApiError(404, "Internship not found");
  return ok(res, internship, "Internship closed");
});

// --- Admin review queue ---

const adminListPending = asyncHandler(async (req, res) => {
  const items = await Internship.find({ status: "pending_review" }).sort({ createdAt: 1 });
  const reportsById = await ListingReport.aggregate([
    { $match: { internshipId: { $in: items.map((i) => i._id) } } },
    { $group: { _id: "$internshipId", reasons: { $push: "$reason" } } },
  ]);
  const reportsMap = new Map(reportsById.map((r) => [r._id.toString(), r.reasons]));

  const enriched = items.map((item) => ({
    ...item.toObject(),
    reportReasons: reportsMap.get(item._id.toString()) || [],
  }));

  return ok(res, enriched, "Pending review queue");
});

const adminApproveInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id);
  if (!internship) throw new ApiError(404, "Internship not found");
  if (internship.status !== "pending_review") {
    throw new ApiError(400, `Cannot approve a listing in status "${internship.status}"`);
  }

  const hasEdits = req.body && Object.keys(req.body).length > 0;
  if (hasEdits) Object.assign(internship, req.body);

  internship.status = "published";
  internship.reviewedBy = req.user.id;
  internship.reviewedAt = new Date();
  await internship.save();

  // Business Rule 11: approving a resubmission retires any known-bad pattern entry
  // that previously matched this company, so a one-time false rejection doesn't
  // permanently poison that company's future listings.
  await KnownBadPattern.updateMany(
    { company: new RegExp(`^${internship.company}$`, "i"), retired: false },
    { $set: { retired: true, retiredAt: new Date() } }
  );

  await TrustScoreDecisionLog.create({
    internshipId: internship._id,
    trustScore: internship.trustScore,
    signalsFired: [],
    adminDecision: hasEdits ? "edited_approved" : "approved",
    decidedBy: req.user.id,
    decidedAt: new Date(),
  });

  return ok(res, internship, "Internship approved");
});

const adminRejectInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id);
  if (!internship) throw new ApiError(404, "Internship not found");
  if (internship.status !== "pending_review") {
    throw new ApiError(400, `Cannot reject a listing in status "${internship.status}"`);
  }

  internship.status = "rejected";
  internship.reviewedBy = req.user.id;
  internship.reviewedAt = new Date();
  await internship.save();

  await KnownBadPattern.create({
    company: internship.company,
    title: internship.title,
    sourceInternshipId: internship._id,
  });

  await TrustScoreDecisionLog.create({
    internshipId: internship._id,
    trustScore: internship.trustScore,
    signalsFired: [],
    adminDecision: "rejected",
    decidedBy: req.user.id,
    decidedAt: new Date(),
  });

  return ok(res, internship, "Internship rejected");
});

module.exports = {
  listInternships,
  getInternship,
  saveInternship,
  unsaveInternship,
  reportInternship,
  adminListInternships,
  adminCreateInternship,
  adminUpdateInternship,
  adminCloseInternship,
  adminListPending,
  adminApproveInternship,
  adminRejectInternship,
};
