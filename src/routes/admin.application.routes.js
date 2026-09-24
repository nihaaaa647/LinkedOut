const express = require("express");
const validate = require("../middleware/validate");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  adminUpdateStatusSchema,
  adminListApplicationsQuerySchema,
} = require("../validation/application.schema");
const { adminListApplications, adminUpdateStatus } = require("../controllers/application.controller");

const router = express.Router();

router.use(verifyToken, ...requireRole("admin"));

router.get("/", validate(adminListApplicationsQuerySchema, "query"), adminListApplications);
router.patch("/:id/status", validate(adminUpdateStatusSchema), adminUpdateStatus);

module.exports = router;
