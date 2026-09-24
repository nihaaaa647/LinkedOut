const Application = require("../models/Application");
const Internship = require("../models/Internship");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created, ApiError } = require("../utils/apiResponse");

const WITHDRAWABLE_STATUSES = ["Applied", "Shortlisted"];

// --- Student ---

const apply = asyncHandler(async (req, res) => {
  const { internshipId } = req.body;

  const internship = await Internship.findById(internshipId);
  if (!internship) throw new ApiError(404, "Internship not found");

  // Business Rule 5: only published, not-yet-expired listings accept applications.
  if (internship.status !== "published") {
    throw new ApiError(400, "This internship is not currently accepting applications");
  }
  if (internship.deadline < new Date()) {
    throw new ApiError(400, "This internship's application deadline has passed");
  }

  // Business Rule 2: the partial unique index on (userId, internshipId) where
  // status != "Withdrawn" is the source of truth for the no-duplicate rule; a collision
  // here surfaces as a Mongo code-11000 error, normalized to 409 by the central errorHandler.
  const application = await Application.create({
    userId: req.user.id,
    internshipId,
    status: "Applied",
    statusHistory: [{ status: "Applied", changedBy: req.user.id }],
  });

  return created(res, application, "Application submitted");
});

const listMyApplications = asyncHandler(async (req, res) => {
  const { page, limit, sort } = req.query;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Application.find({ userId: req.user.id })
      .populate("internshipId", "title company deadline status")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Application.countDocuments({ userId: req.user.id }),
  ]);

  return ok(res, { items, page, limit, total, pages: Math.ceil(total / limit) }, "Applications listed");
});

const getMyApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id).populate(
    "internshipId",
    "title company deadline status"
  );
  // 404 (not 403) on another user's application id, so existence isn't leaked (Section 15).
  if (!application || application.userId.toString() !== req.user.id) {
    throw new ApiError(404, "Application not found");
  }
  return ok(res, application, "Application detail");
});

const withdraw = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application || application.userId.toString() !== req.user.id) {
    throw new ApiError(404, "Application not found");
  }

  if (!WITHDRAWABLE_STATUSES.includes(application.status)) {
    throw new ApiError(400, `Cannot withdraw an application in status "${application.status}"`);
  }

  application.status = "Withdrawn";
  application.isActive = false;
  application.withdrawnAt = new Date();
  application.statusHistory.push({ status: "Withdrawn", changedBy: req.user.id });
  await application.save();

  return ok(res, application, "Application withdrawn");
});

// --- Admin ---

const adminListApplications = asyncHandler(async (req, res) => {
  const { page, limit, sort, internshipId, userId, status } = req.query;
  const filter = {};
  if (internshipId) filter.internshipId = internshipId;
  if (userId) filter.userId = userId;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Application.find(filter)
      .populate("internshipId", "title company deadline")
      .populate("userId", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  return ok(res, { items, page, limit, total, pages: Math.ceil(total / limit) }, "Applications listed");
});

const adminUpdateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const application = await Application.findById(req.params.id);
  if (!application) throw new ApiError(404, "Application not found");

  // Business Rule 3: once Rejected or Selected, the outcome is final.
  if (["Rejected", "Selected", "Withdrawn"].includes(application.status)) {
    throw new ApiError(400, `Cannot change status: application is already "${application.status}"`);
  }

  application.status = status;
  application.statusHistory.push({ status, changedBy: req.user.id });
  await application.save();

  return ok(res, application, "Application status updated");
});

module.exports = {
  apply,
  listMyApplications,
  getMyApplication,
  withdraw,
  adminListApplications,
  adminUpdateStatus,
};
