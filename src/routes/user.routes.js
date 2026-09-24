const express = require("express");
const validate = require("../middleware/validate");
const { verifyToken, requireRole } = require("../middleware/auth");
const { uploadResume } = require("../middleware/upload");
const { updateProfileSchema } = require("../validation/user.schema");
const {
  updateProfile,
  uploadResume: uploadResumeHandler,
  deleteResume,
  downloadResume,
  listSaved,
} = require("../controllers/user.controller");

const router = express.Router();

router.use(verifyToken, ...requireRole("user"));

router.patch("/me", validate(updateProfileSchema), updateProfile);
router.post("/me/resume", uploadResume, uploadResumeHandler);
router.delete("/me/resume", deleteResume);
router.get("/me/resume", downloadResume);
router.get("/me/saved", listSaved);

module.exports = router;
