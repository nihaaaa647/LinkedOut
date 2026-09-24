require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: required("MONGO_URI"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookieSameSite: process.env.COOKIE_SAMESITE || "lax",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  notifyWindowHours: Number(process.env.NOTIFY_WINDOW_HOURS || 48),
  notifyCron: process.env.NOTIFY_CRON || "0 */6 * * *",
  scrapeCron: process.env.SCRAPE_CRON || "0 */6 * * *",
  matchAlertThreshold: Number(process.env.MATCH_ALERT_THRESHOLD || 85),
  reportThreshold: Number(process.env.REPORT_THRESHOLD || 3),
  maxResumeSizeMb: Number(process.env.MAX_RESUME_SIZE_MB || 2),
};
