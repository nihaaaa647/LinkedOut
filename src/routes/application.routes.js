const express = require("express");
const validate = require("../middleware/validate");
const { verifyToken, requireRole } = require("../middleware/auth");
const { applySchema, listApplicationsQuerySchema } = require("../validation/application.schema");
const {
  apply,
  listMyApplications,
  getMyApplication,
  withdraw,
} = require("../controllers/application.controller");

const router = express.Router();

router.use(verifyToken, ...requireRole("user"));

router.post("/", validate(applySchema), apply);
router.get("/me", validate(listApplicationsQuerySchema, "query"), listMyApplications);
router.get("/:id", getMyApplication);
router.patch("/:id/withdraw", withdraw);

module.exports = router;
