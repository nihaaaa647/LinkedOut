const { createApiClient } = require("../config/apiClient");

// Populates res.locals.currentUser (used by every EJS view's nav) by calling the real
// GET /auth/me endpoint through the same API client the page handlers use - the
// frontend never bypasses the REST API, even to read "who's logged in".
async function attachViewUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.flashError = req.query.error || null;
  res.locals.flashSuccess = req.query.success || null;

  if (!req.cookies?.token) return next();

  try {
    const api = createApiClient(req, res);
    const { data, status } = await api.get("/auth/me");
    if (status === 200) res.locals.currentUser = data.data;
  } catch (err) {
    // treat as logged out
  }
  next();
}

function requireViewAuth(req, res, next) {
  if (!res.locals.currentUser) return res.redirect("/login");
  next();
}

function requireViewRole(role) {
  return (req, res, next) => {
    if (!res.locals.currentUser || res.locals.currentUser.role !== role) {
      return res.status(403).send("Forbidden");
    }
    next();
  };
}

module.exports = { attachViewUser, requireViewAuth, requireViewRole };
