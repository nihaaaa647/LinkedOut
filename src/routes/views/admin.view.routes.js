const express = require("express");
const { createApiClient } = require("../../config/apiClient");
const { requireViewAuth, requireViewRole } = require("../../middleware/viewAuth");

const router = express.Router();
router.use(requireViewAuth, requireViewRole("admin"));

// --- Listings ---

router.get("/admin/internships", async (req, res) => {
  const api = createApiClient(req, res);
  const { data } = await api.get("/admin/internships?limit=50");
  res.render("admin/listings", { title: "Manage Listings", internships: data.data?.items || [] });
});

router.post("/admin/internships", async (req, res) => {
  const api = createApiClient(req, res);
  const requiredSkills = (req.body.requiredSkills || "").split(",").map((s) => s.trim()).filter(Boolean);
  const branches = (req.body.branches || "").split(",").map((s) => s.trim()).filter(Boolean);
  const years = (req.body.years || "").split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));

  const { data, status } = await api.post("/admin/internships", {
    title: req.body.title,
    company: req.body.company,
    description: req.body.description,
    eligibility: { branches, minCgpa: Number(req.body.minCgpa) || 0, years },
    location: req.body.location,
    deadline: req.body.deadline,
    stipend: req.body.stipend ? Number(req.body.stipend) : undefined,
    requiredSkills,
    workMode: req.body.workMode || undefined,
  });
  const redirect =
    status === 201
      ? `/admin/internships?success=${encodeURIComponent("Listing created")}`
      : `/admin/internships?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

router.post("/admin/internships/:id/close", async (req, res) => {
  const api = createApiClient(req, res);
  await api.patch(`/admin/internships/${req.params.id}/close`);
  res.redirect(`/admin/internships?success=${encodeURIComponent("Listing closed")}`);
});

// --- Review queue ---

router.get("/admin/internships/pending", async (req, res) => {
  const api = createApiClient(req, res);
  const { data } = await api.get("/admin/internships/pending");
  res.render("admin/pending", { title: "Review Queue", pending: data.data || [] });
});

router.post("/admin/internships/:id/approve", async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.patch(`/admin/internships/${req.params.id}/approve`, {});
  const redirect =
    status === 200
      ? `/admin/internships/pending?success=${encodeURIComponent("Listing approved")}`
      : `/admin/internships/pending?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

router.post("/admin/internships/:id/reject", async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.patch(`/admin/internships/${req.params.id}/reject`);
  const redirect =
    status === 200
      ? `/admin/internships/pending?success=${encodeURIComponent("Listing rejected")}`
      : `/admin/internships/pending?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

// --- Applications ---

router.get("/admin/applications", async (req, res) => {
  const api = createApiClient(req, res);
  const params = new URLSearchParams();
  if (req.query.status) params.set("status", req.query.status);
  const { data } = await api.get(`/admin/applications?${params.toString()}`);
  res.render("admin/applications", { title: "All Applications", applications: data.data?.items || [], query: req.query });
});

router.post("/admin/applications/:id/status", async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.patch(`/admin/applications/${req.params.id}/status`, { status: req.body.status });
  const redirect =
    status === 200
      ? `/admin/applications?success=${encodeURIComponent("Status updated")}`
      : `/admin/applications?error=${encodeURIComponent(data.message)}`;
  res.redirect(redirect);
});

// --- Skill-gap analytics ---

router.get("/admin/analytics", async (req, res) => {
  const api = createApiClient(req, res);
  const params = new URLSearchParams();
  if (req.query.branch) params.set("branch", req.query.branch);
  const { data } = await api.get(`/admin/analytics/skill-gaps?${params.toString()}`);
  res.render("admin/analytics", { title: "Skill-Gap Analytics", rows: data.data || [], query: req.query });
});

module.exports = router;
