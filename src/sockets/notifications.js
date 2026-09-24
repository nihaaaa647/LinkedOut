const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const { jwtSecret, frontendOrigin } = require("../config/env");
const { COOKIE_NAME } = require("../services/token");

// Real-time push alongside the polled GET /api/notifications (Section 7). Authenticated
// via the same JWT httpOnly cookie used for REST calls; each socket joins a room scoped
// to its user so notify.job.js can target `user:<id>` without a broadcast.
function initNotificationSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: frontendOrigin, credentials: true },
    path: "/socket.io",
  });

  const notifications = io.of("/notifications");

  notifications.use((socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      const token = cookies[COOKIE_NAME];
      if (!token) return next(new Error("Not authenticated"));
      const payload = jwt.verify(token, jwtSecret);
      socket.userId = payload.sub;
      next();
    } catch (err) {
      next(new Error("Not authenticated"));
    }
  });

  notifications.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  return notifications;
}

module.exports = { initNotificationSocket };
