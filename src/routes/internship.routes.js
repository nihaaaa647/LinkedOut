const express = require("express");
const validate = require("../middleware/validate");
const { attachUserIfPresent, verifyToken, requireRole } = require("../middleware/auth");
const { listInternshipsQuerySchema } = require("../validation/internship.schema");
const { reportListingSchema } = require("../validation/user.schema");
const {
  listInternships,
  getInternship,
  saveInternship,
  unsaveInternship,
  reportInternship,
} = require("../controllers/internship.controller");

const router = express.Router();

router.get("/", validate(listInternshipsQuerySchema, "query"), listInternships);
router.get("/:id", attachUserIfPresent, getInternship);
router.post("/:id/save", verifyToken, ...requireRole("user"), saveInternship);
router.delete("/:id/save", verifyToken, ...requireRole("user"), unsaveInternship);
router.post("/:id/report", verifyToken, ...requireRole("user"), validate(reportListingSchema), reportInternship);

module.exports = router;
