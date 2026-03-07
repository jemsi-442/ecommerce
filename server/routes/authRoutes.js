import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await User.findOne({ where: { email: String(email).toLowerCase() } });
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

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email: String(email).toLowerCase() } });
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

export default router;
