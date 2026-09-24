const jwt = require("jsonwebtoken");
const { jwtSecret, jwtExpiresIn, cookieSecure, cookieSameSite } = require("../config/env");

const COOKIE_NAME = "token";

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge: 60 * 60 * 1000, // 1h; keep in sync with JWT_EXPIRES_IN default
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
  });
}

module.exports = { COOKIE_NAME, signToken, setAuthCookie, clearAuthCookie };
