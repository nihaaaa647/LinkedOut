const express = require("express");
const rateLimit = require("express-rate-limit");
const validate = require("../middleware/validate");
const { verifyToken } = require("../middleware/auth");
const { registerSchema, loginSchema } = require("../validation/auth.schema");
const { register, login, logout, me } = require("../controllers/auth.controller");

const router = express.Router();

// Blunts brute-force login/registration attempts (NFR, Section 16).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later" },
});

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/logout", verifyToken, logout);
router.get("/me", verifyToken, me);

module.exports = router;
