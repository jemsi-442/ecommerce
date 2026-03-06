import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { serializeUser } from "../utils/serializers.js";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const register = async (req, res) => {
  const user = await User.create(req.body);
  const serialized = serializeUser(user);
  res.json({ token: generateToken(serialized._id), user: serialized });
};

export const login = async (req, res) => {
  const user = await User.findOne({ where: { email: String(req.body.email).toLowerCase() } });
  if (!user || !(await bcrypt.compare(req.body.password, user.password)))
    return res.status(401).json({ message: "Invalid credentials" });

  const serialized = serializeUser(user);
  res.json({ token: generateToken(serialized._id), user: serialized });
};
