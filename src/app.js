const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");

const { frontendOrigin } = require("./config/env");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { attachViewUser } = require("./middleware/viewAuth");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const internshipRoutes = require("./routes/internship.routes");
const applicationRoutes = require("./routes/application.routes");
const notificationRoutes = require("./routes/notification.routes");
const adminInternshipRoutes = require("./routes/admin.internship.routes");
const adminApplicationRoutes = require("./routes/admin.application.routes");
const adminTrustRoutes = require("./routes/admin.trust.routes");
const adminMiscRoutes = require("./routes/admin.misc.routes");
const authViewRoutes = require("./routes/views/auth.view.routes");
const studentViewRoutes = require("./routes/views/student.view.routes");
const adminViewRoutes = require("./routes/views/admin.view.routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());

app.get("/api/health", (req, res) => res.json({ success: true, data: { status: "ok" } }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/internships", internshipRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/internships", adminInternshipRoutes);
app.use("/api/admin/applications", adminApplicationRoutes);
app.use("/api/admin", adminTrustRoutes);
app.use("/api/admin", adminMiscRoutes);

// --- Minimal server-rendered frontend (exercises the API above as a real client - see
// src/config/apiClient.js) - PRD Section 17: "a minimal frontend that can register/login,
// browse/apply, and (as admin) manage listings and application statuses." ---
app.use(express.static(path.join(__dirname, "..", "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(attachViewUser);

app.get("/", (req, res) => res.redirect("/internships"));
app.use(authViewRoutes);
app.use(studentViewRoutes);
app.use(adminViewRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
