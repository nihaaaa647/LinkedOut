const cron = require("node-cron");
const Application = require("../models/Application");
const SavedInternship = require("../models/SavedInternship");
const Internship = require("../models/Internship");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { computeMatch } = require("../services/matchScore");
const { notifyWindowHours, notifyCron, matchAlertThreshold } = require("../config/env");

let io = null;
function attachSocketServer(socketServer) {
  io = socketServer;
}

async function pushRealtime(notification) {
  if (!io) return;
  io.to(`user:${notification.userId}`).emit("notification:new", notification);
}

// One notification per (user, internship, type) for its whole lifecycle - deadlines and
// match-worthiness don't need re-announcing every job run once the student's seen it once.
async function notifyOnce(userId, internshipId, type) {
  const existing = await Notification.findOne({ userId, internshipId, type });
  if (existing) return null;
  const notification = await Notification.create({ userId, internshipId, type });
  await pushRealtime(notification);
  return notification;
}

// deadline_reminder: for every internship a user applied to or saved, deadline within
// the configurable window (Section 7).
async function runDeadlineReminders() {
  const windowEnd = new Date(Date.now() + notifyWindowHours * 60 * 60 * 1000);
  const now = new Date();

  const upcoming = await Internship.find({ deadline: { $gte: now, $lte: windowEnd }, status: "published" }).select(
    "_id"
  );
  if (upcoming.length === 0) return 0;
  const internshipIds = upcoming.map((i) => i._id);

  const [applicants, savers] = await Promise.all([
    Application.find({ internshipId: { $in: internshipIds }, isActive: true }).select("userId internshipId"),
    SavedInternship.find({ internshipId: { $in: internshipIds } }).select("userId internshipId"),
  ]);

  const pairs = new Map();
  for (const a of [...applicants, ...savers]) {
    pairs.set(`${a.userId}:${a.internshipId}`, { userId: a.userId, internshipId: a.internshipId });
  }

  let sent = 0;
  for (const { userId, internshipId } of pairs.values()) {
    const created = await notifyOnce(userId, internshipId, "deadline_reminder");
    if (created) sent++;
  }
  return sent;
}

// match_alert: for saved internships whose computed match score crosses a high
// threshold - a "worth applying to" nudge, independent of deadline proximity (Section 7).
async function runMatchAlerts() {
  const saved = await SavedInternship.find().populate("internshipId").populate("userId");
  let sent = 0;

  for (const record of saved) {
    const internship = record.internshipId;
    const user = record.userId;
    if (!internship || !user || internship.status !== "published") continue;

    const { matchScore } = await computeMatch(user, internship);
    if (matchScore < matchAlertThreshold) continue;

    const created = await notifyOnce(user._id, internship._id, "match_alert");
    if (created) sent++;
  }
  return sent;
}

async function runNotifyJob() {
  console.log("[notify.job] starting run");
  const [deadlineCount, matchCount] = await Promise.all([runDeadlineReminders(), runMatchAlerts()]);
  console.log(`[notify.job] run complete: ${deadlineCount} deadline reminders, ${matchCount} match alerts`);
}

function scheduleNotifyJob() {
  cron.schedule(notifyCron, () => {
    runNotifyJob().catch((err) => console.error("[notify.job] unhandled error", err));
  });
  console.log(`[notify.job] scheduled with cron "${notifyCron}"`);
}

module.exports = { runNotifyJob, scheduleNotifyJob, attachSocketServer };
