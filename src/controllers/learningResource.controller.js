const LearningResource = require("../models/LearningResource");
const { normalizeSkill } = require("../services/normalizeSkill");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created, ApiError } = require("../utils/apiResponse");

const listLearningResources = asyncHandler(async (req, res) => {
  const items = await LearningResource.find().sort({ skill: 1 });
  return ok(res, items, "Learning resources listed");
});

const createLearningResource = asyncHandler(async (req, res) => {
  const skill = await normalizeSkill(req.body.skill);

  const existing = await LearningResource.findOne({ skill });
  if (existing) throw new ApiError(409, `A resource mapping for "${skill}" already exists`);

  const resource = await LearningResource.create({
    skill,
    resources: req.body.resources,
    updatedBy: req.user.id,
  });
  return created(res, resource, "Learning resource mapping created");
});

const updateLearningResource = asyncHandler(async (req, res) => {
  const resource = await LearningResource.findByIdAndUpdate(
    req.params.id,
    { resources: req.body.resources, updatedBy: req.user.id },
    { new: true, runValidators: true }
  );
  if (!resource) throw new ApiError(404, "Learning resource mapping not found");
  return ok(res, resource, "Learning resource mapping updated");
});

const deleteLearningResource = asyncHandler(async (req, res) => {
  const resource = await LearningResource.findByIdAndDelete(req.params.id);
  if (!resource) throw new ApiError(404, "Learning resource mapping not found");
  return ok(res, null, "Learning resource mapping removed");
});

module.exports = {
  listLearningResources,
  createLearningResource,
  updateLearningResource,
  deleteLearningResource,
};
