const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { listNotifications, markRead } = require("../controllers/notification.controller");

const router = express.Router();

router.use(verifyToken, ...requireRole("user"));

router.get("/", listNotifications);
router.patch("/:id/read", markRead);

module.exports = router;
