const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { port } = require("./src/config/env");
const { initNotificationSocket } = require("./src/sockets/notifications");
const { attachSocketServer, scheduleNotifyJob } = require("./src/jobs/notify.job");
const { scheduleScrapeJob } = require("./src/jobs/scrape.job");
const { scheduleSkillGapSnapshotJob } = require("./src/jobs/skillGapSnapshot.job");

async function start() {
  await connectDB();

  const httpServer = http.createServer(app);
  const notificationSocket = initNotificationSocket(httpServer);
  attachSocketServer(notificationSocket);

  scheduleScrapeJob();
  scheduleNotifyJob();
  scheduleSkillGapSnapshotJob();

  httpServer.listen(port, () => console.log(`Server listening on port ${port}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
