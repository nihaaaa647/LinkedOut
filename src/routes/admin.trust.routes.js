const express = require("express");
const validate = require("../middleware/validate");
const { verifyToken, requireRole } = require("../middleware/auth");
const { updateTrustScoreConfigSchema } = require("../validation/trustScoreConfig.schema");
const { createLearningResourceSchema, updateLearningResourceSchema } = require("../validation/learningResource.schema");
const { getTrustScoreConfig, updateTrustScoreConfig } = require("../controllers/trustScoreConfig.controller");
const {
  listLearningResources,
  createLearningResource,
  updateLearningResource,
  deleteLearningResource,
} = require("../controllers/learningResource.controller");

const router = express.Router();

router.use(verifyToken, ...requireRole("admin"));

router.get("/trust-score-config", getTrustScoreConfig);
router.patch("/trust-score-config", validate(updateTrustScoreConfigSchema), updateTrustScoreConfig);

router.get("/learning-resources", listLearningResources);
router.post("/learning-resources", validate(createLearningResourceSchema), createLearningResource);
router.patch("/learning-resources/:id", validate(updateLearningResourceSchema), updateLearningResource);
router.delete("/learning-resources/:id", deleteLearningResource);

module.exports = router;
