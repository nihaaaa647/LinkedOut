const bcrypt = require("bcrypt");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { ok, created, ApiError } = require("../utils/apiResponse");
const { signToken, setAuthCookie, clearAuthCookie } = require("../services/token");

const BCRYPT_ROUNDS = 11;

const register = asyncHandler(async (req, res) => {
  const { name, email, password, branch, year, cgpa, skills } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // role is always "user" here - never read from req.body (Business Rule 7).
  const user = await User.create({ name, email, passwordHash, branch, year, cgpa, skills });

  const token = signToken(user);
  setAuthCookie(res, token);
  return created(res, user.toSafeJSON(), "Registered successfully");
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) throw new ApiError(401, "Invalid email or password");

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw new ApiError(401, "Invalid email or password");

  const token = signToken(user);
  setAuthCookie(res, token);
  return ok(res, user.toSafeJSON(), "Logged in");
});

const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  return ok(res, null, "Logged out");
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");
  return ok(res, user.toSafeJSON(), "Current user");
});

module.exports = { register, login, logout, me };
