const express = require("express");
const { createApiClient } = require("../../config/apiClient");

const router = express.Router();

router.get("/login", (req, res) => {
  if (res.locals.currentUser) return res.redirect("/internships");
  res.render("login", { title: "Login" });
});

router.post("/login", async (req, res) => {
  const api = createApiClient(req, res);
  const { data, status } = await api.post("/auth/login", { email: req.body.email, password: req.body.password });
  if (status !== 200) {
    return res.redirect(`/login?error=${encodeURIComponent(data.message || "Login failed")}`);
  }
  res.redirect("/internships");
});

router.get("/register", (req, res) => {
  if (res.locals.currentUser) return res.redirect("/internships");
  res.render("register", { title: "Register" });
});

router.post("/register", async (req, res) => {
  const api = createApiClient(req, res);
  const { name, email, password, branch, year, cgpa } = req.body;
  const { data, status } = await api.post("/auth/register", {
    name,
    email,
    password,
    branch: branch || undefined,
    year: year ? Number(year) : undefined,
    cgpa: cgpa ? Number(cgpa) : undefined,
  });
  if (status !== 201) {
    const message = data.errors ? data.errors.map((e) => e.message || e).join(", ") : data.message;
    return res.redirect(`/register?error=${encodeURIComponent(message || "Registration failed")}`);
  }
  res.redirect("/internships");
});

router.post("/logout", async (req, res) => {
  const api = createApiClient(req, res);
  await api.post("/auth/logout");
  res.redirect("/login");
});

module.exports = router;
