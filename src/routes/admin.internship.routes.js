const express = require("express");
const validate = require("../middleware/validate");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  createInternshipSchema,
  updateInternshipSchema,
  approveInternshipSchema,
} = require("../validation/internship.schema");
const {
  adminListInternships,
  adminCreateInternship,
  adminUpdateInternship,
  adminCloseInternship,
  adminListPending,
  adminApproveInternship,
  adminRejectInternship,
} = require("../controllers/internship.controller");

const router = express.Router();

router.use(verifyToken, ...requireRole("admin"));

router.get("/", adminListInternships);
router.post("/", validate(createInternshipSchema), adminCreateInternship);
router.get("/pending", adminListPending);
router.patch("/:id", validate(updateInternshipSchema), adminUpdateInternship);
router.patch("/:id/close", adminCloseInternship);
router.patch("/:id/approve", validate(approveInternshipSchema), adminApproveInternship);
router.patch("/:id/reject", adminRejectInternship);

module.exports = router;
