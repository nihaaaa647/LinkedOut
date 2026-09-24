const express = require("express");
const multer = require("multer");
const { createApiClient } = require("../../config/apiClient");
const { requireViewAuth } = require("../../middleware/viewAuth");

const router = express.Router();
const memoryUpload = multer({ storage: multer.memoryStorage() });

// --- Browse (public, but shows match score when logged in) ---

router.get("/internships", async (req, res) => {
  const api = createApiClient(req, res);
  const params = new URLSearchParams();
  if (req.query.location) params.set("location", req.query.location);
  if (req.query.workMode) params.set("workMode", req.query.workMode);
  if (req.query.minStipend) params.set("minStipend", req.query.minStipend);

  const { data } = await api.get(`/internships?${params.toString()}`);
  res.render("student/browse", { title: "Browse Internships", internships: data.data?.items || [], query: req.query });
});

router.get("/internships/:id", async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.get(`/internships/${req.params.id}`);
  if (status !== 200) return res.status(status).send(data.message);
  res.render("student/detail", { title: data.data.title, internship: data.data });
});

router.post("/internships/:id/apply", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.post("/applications", { internshipId: req.params.id });
  const redirect =
    status === 201
      ? `/internships/${req.params.id}?success=${encodeURIComponent("Application submitted")}`
      : `/internships/${req.params.id}?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

router.post("/internships/:id/save", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  await api.post(`/internships/${req.params.id}/save`);
  res.redirect(`/internships/${req.params.id}?success=${encodeURIComponent("Saved")}`);
});

router.post("/internships/:id/unsave", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  await api.delete(`/internships/${req.params.id}/save`);
  res.redirect(`/internships/${req.params.id}?success=${encodeURIComponent("Removed from saved")}`);
});

router.post("/internships/:id/report", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.post(`/internships/${req.params.id}/report`, {
    reason: req.body.reason,
    description: req.body.description,
  });
  const redirect =
    status === 201
      ? `/internships/${req.params.id}?success=${encodeURIComponent("Report submitted - thanks for flagging this")}`
      : `/internships/${req.params.id}?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

// --- Applications ---

router.get("/applications", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  const { data } = await api.get("/applications/me");
  res.render("student/applications", { title: "My Applications", applications: data.data?.items || [] });
});

router.post("/applications/:id/withdraw", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.patch(`/applications/${req.params.id}/withdraw`);
  const redirect =
    status === 200
      ? `/applications?success=${encodeURIComponent("Application withdrawn")}`
      : `/applications?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

// --- Profile & resume ---

router.get("/profile", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  const { data } = await api.get("/auth/me");
  res.render("student/profile", { title: "My Profile", profile: data.data });
});

router.post("/profile", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  const skills = (req.body.skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { data, status } = await api.patch("/users/me", {
    branch: req.body.branch || undefined,
    year: req.body.year ? Number(req.body.year) : undefined,
    cgpa: req.body.cgpa ? Number(req.body.cgpa) : undefined,
    locationPreference: req.body.locationPreference || undefined,
    skills: skills.length ? skills : undefined,
  });
  const redirect =
    status === 200
      ? `/profile?success=${encodeURIComponent("Profile updated")}`
      : `/profile?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

router.post("/profile/resume", requireViewAuth, memoryUpload.single("resume"), async (req, res) => {
  if (!req.file) return res.redirect(`/profile?error=${encodeURIComponent("No file selected")}`);

  const FormData = require("form-data");
  const form = new FormData();
  form.append("resume", req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });

  const api = createApiClient(req, res);
  const { data, status } = await api.post("/users/me/resume", form, { headers: form.getHeaders() });

  const redirect =
    status === 200
      ? `/profile?success=${encodeURIComponent(`Resume uploaded. Auto-detected skills: ${(data.data.addedSkills || []).join(", ") || "none"}`)}`
      : `/profile?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

// --- Notifications ---

router.get("/notifications", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  const { data } = await api.get("/notifications");
  res.render("student/notifications", { title: "Notifications", notifications: data.data || [] });
});

router.post("/notifications/:id/read", requireViewAuth, async (req, res) => {
  const api = createApiClient(req, res);
  await api.patch(`/notifications/${req.params.id}/read`);
  res.redirect("/notifications");
});

module.exports = router;
