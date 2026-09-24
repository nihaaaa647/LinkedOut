const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { COOKIE_NAME } = require("../services/token");
const User = require("../models/User");
const { ApiError } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

// Stateless: verifies the JWT signature/expiry and attaches req.user from the token payload.
// Does not hit the DB, so it stays cheap on every request.
function verifyToken(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(new ApiError(401, "Not authenticated"));

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.sub, role: payload.role, tokenVersion: payload.tokenVersion };
    next();
  } catch (err) {
    next(new ApiError(401, "Invalid or expired session"));
  }
}

// Stateful: for admin-only and account-sensitive routes. Confirms the token's tokenVersion
// still matches the DB, so an admin can force-invalidate a specific user's sessions
// (PATCH /api/admin/users/:id/revoke-sessions) without a full token-blacklist store.
const requireFreshSession = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("tokenVersion role");
  if (!user || user.tokenVersion !== req.user.tokenVersion) {
    return next(new ApiError(401, "Session has been revoked, please log in again"));
  }
  next();
});

// For routes that behave differently for logged-in vs anonymous callers (e.g. public
// listing browse) without requiring auth. Never rejects; just attaches req.user if a
// valid cookie is present.
function attachUserIfPresent(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.sub, role: payload.role, tokenVersion: payload.tokenVersion };
  } catch (err) {
    // ignore invalid/expired token on an optional-auth route
  }
  next();
}

function requireRole(...roles) {
  return [
    requireFreshSession,
    (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return next(new ApiError(403, "Forbidden: insufficient role"));
      }
      next();
    },
  ];
}

module.exports = { verifyToken, attachUserIfPresent, requireFreshSession, requireRole };
