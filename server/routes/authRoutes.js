import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { serializeUser } from "../utils/serializers.js";
import { isSmtpConfigured, sendPasswordResetEmail } from "../utils/mailer.js";
import { rateLimit } from "../middleware/rateLimiter.js";

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const getClientBaseUrl = () => {
  const explicit = String(process.env.CLIENT_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const fromList = String(process.env.CLIENT_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);

  return (fromList || "http://localhost:5173").replace(/\/$/, "");
};
const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeName = (value = "") => String(value).trim().replace(/\s+/g, " ");
const isValidEmail = (value = "") => EMAIL_REGEX.test(normalizeEmail(value));
const isValidPassword = (value = "") => String(value).length >= MIN_PASSWORD_LENGTH;

const registerRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:register`,
});

const loginRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => `${req.ip}:login:${normalizeEmail(req.body?.email || "")}`,
});

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  keyGenerator: (req) => `${req.ip}:forgot-password:${normalizeEmail(req.body?.email || "")}`,
});

const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:reset-password`,
});

const generatePasswordResetToken = (user) =>
  jwt.sign({ id: user.id, purpose: "password-reset" }, `${process.env.JWT_SECRET}:${user.password}`, {
    expiresIn: "15m",
  });

router.post("/register", registerRateLimiter, async (req, res) => {
  const name = normalizeName(req.body?.name || "");
  const email = normalizeEmail(req.body?.email || "");
  const password = String(req.body?.password || "");

  if (name.length < 2) {
    return res.status(400).json({ message: "Name must be at least 2 characters" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ message: "Email exists" });

    const user = await User.create({ name, email, password });
    const safeUser = serializeUser(user);

    res.status(201).json({
      _id: safeUser._id,
      name: safeUser.name,
      email: safeUser.email,
      role: safeUser.role,
      token: generateToken(safeUser._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", loginRateLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email || "");
  const password = String(req.body?.password || "");

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.active) {
      return res.status(403).json({ message: "Account suspended" });
    }

    if (await user.matchPassword(password)) {
      const safeUser = serializeUser(user);
      res.json({
        _id: safeUser._id,
        name: safeUser.name,
        email: safeUser.email,
        role: safeUser.role,
        token: generateToken(safeUser._id),
      });
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/forgot-password", forgotPasswordRateLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email || "");

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  try {
    const user = await User.findOne({ where: { email } });

    if (!user || !user.active) {
      return res.json({
        message: "If that email exists, a password reset link has been prepared.",
      });
    }

    const token = generatePasswordResetToken(user);
    const resetUrl = `${getClientBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const isProduction = process.env.NODE_ENV === "production";

    if (isSmtpConfigured()) {
      await sendPasswordResetEmail({
        to: email,
        resetUrl,
        appName: process.env.APP_NAME || "RihanCollection",
      });

      return res.json({
        message: "Password reset email sent successfully.",
      });
    }

    console.log(` Password reset link for ${email}: ${resetUrl}`);

    if (isProduction) {
      return res.status(503).json({
        message: "Password reset email service is not configured yet.",
      });
    }

    return res.json({
      message: "Password reset instructions generated successfully.",
      resetUrl,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/reset-password", resetPasswordRateLimiter, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");

  if (!token || !password) {
    return res.status(400).json({ message: "Token and new password are required" });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const decoded = jwt.decode(token);

    if (!decoded?.id || decoded?.purpose !== "password-reset") {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const user = await User.findByPk(decoded.id);

    if (!user || !user.active) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    jwt.verify(token, `${process.env.JWT_SECRET}:${user.password}`);

    user.password = password;
    await user.save();

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }
});

export default router;
