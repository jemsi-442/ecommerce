import express from "express";
import User from "../models/User.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { adminMiddleware } from "../middleware/roleMiddleware.js";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 */
router.get("/", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({ order: [["created_at", "DESC"]] });
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
