import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { adminMiddleware } from "../middleware/roleMiddleware.js";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();

/**
 * @route   POST /api/users/register
 * @desc    Register new user
 */
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  try {
    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(400).json({ message: "User exists" });

    const user = await User.create({
      name,
      email,
      password,
      role: "user",
      active: true,
    });

    const safeUser = serializeUser(user);

    const token = jwt.sign(
      { id: safeUser._id, role: safeUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/users/login
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "All fields required" });

  try {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    if (!user.active) return res.status(403).json({ message: "Account suspended" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const safeUser = serializeUser(user);
    const token = jwt.sign(
      { id: safeUser._id, role: safeUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 */
router.get("/", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({ order: [["createdAt", "DESC"]] });
    res.json(users.map((user) => serializeUser(user)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PATCH /api/users/:id/role
 * @desc    Update role (admin only)
 */
router.patch("/:id/role", verifyToken, adminMiddleware, async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role))
    return res.status(400).json({ message: "Invalid role" });

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.role = role;
    await user.save();
    res.json(serializeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Suspend/reactivate user (admin only)
 */
router.patch("/:id/status", verifyToken, adminMiddleware, async (req, res) => {
  const { active } = req.body;
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.active = Boolean(active);
    await user.save();
    res.json(serializeUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
