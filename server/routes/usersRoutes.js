import express from "express";
import User from "../models/User.js";
import Rider from "../models/Rider.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { adminMiddleware } from "../middleware/roleMiddleware.js";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeName = (value = "") => String(value).trim().replace(/\s+/g, " ");
const normalizePhone = (value = "") => String(value).trim();

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 */
router.get("/", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Rider, as: "riderProfile", required: false }],
      order: [["created_at", "DESC"]],
    });
    res.json(users.map((user) => serializeUser(user)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/password", verifyToken, adminMiddleware, async (req, res) => {
  const password = String(req.body?.password || "");

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password;
    await user.save();

    res.json({
      message: "Password reset successfully",
      data: serializeUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/users/riders
 * @desc    Create or upgrade a rider account (admin only)
 */
router.post("/riders", verifyToken, adminMiddleware, async (req, res) => {
  const name = normalizeName(req.body?.name || "");
  const email = normalizeEmail(req.body?.email || "");
  const phone = normalizePhone(req.body?.phone || "");
  const password = String(req.body?.password || "");

  if (name.length < 2) {
    return res.status(400).json({ message: "Name must be at least 2 characters" });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: "Valid email is required" });
  }

  if (phone.length < 6) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const result = await User.sequelize.transaction(async (transaction) => {
      let user = await User.findOne({ where: { email }, transaction });

      if (user?.role === "admin") {
        throw new Error("Admin account cannot be converted to rider");
      }

      if (user) {
        user.name = name;
        user.password = password;
        user.role = "rider";
        user.active = true;
        await user.save({ transaction });
      } else {
        user = await User.create(
          {
            name,
            email,
            password,
            role: "rider",
            active: true,
          },
          { transaction }
        );
      }

      let riderProfile = await Rider.findOne({ where: { userId: user.id }, transaction });

      if (riderProfile) {
        riderProfile.name = name;
        riderProfile.phone = phone;
        riderProfile.available = true;
        riderProfile.isActive = true;
        await riderProfile.save({ transaction });
      } else {
        riderProfile = await Rider.create(
          {
            userId: user.id,
            name,
            phone,
            available: true,
            isActive: true,
          },
          { transaction }
        );
      }

      return { user, riderProfile };
    });

    return res.status(201).json({
      message: "Rider account saved successfully",
      data: {
        user: serializeUser(result.user),
        rider: result.riderProfile.toJSON(),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: err.message || "Failed to create rider" });
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
    if (user.role === "rider") {
      return res.status(400).json({ message: "Use the rider management flow for rider accounts" });
    }
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

router.patch("/:id/rider-status", verifyToken, adminMiddleware, async (req, res) => {
  try {
    const rider = await Rider.findOne({ where: { userId: req.params.id } });
    if (!rider) return res.status(404).json({ message: "Rider profile not found" });

    if (typeof req.body?.isActive === "boolean") {
      rider.isActive = req.body.isActive;
    }

    if (typeof req.body?.available === "boolean") {
      rider.available = req.body.available;
    }

    await rider.save();

    res.json({
      message: "Rider status updated successfully",
      data: rider.toJSON(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
