import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { serializeUser } from "../utils/serializers.js";

const extractBearerToken = (authorizationHeader = "") => {
  if (!authorizationHeader.startsWith("Bearer ")) return null;
  return authorizationHeader.split(" ")[1];
};

export const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization || "");
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided", data: null });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found", data: null });
    }

    req.user = serializeUser(user);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token", data: null });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized", data: null });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Forbidden", data: null });
  }

  next();
};

export const adminOnly = requireRole("admin");
export const riderOnly = requireRole("rider", "delivery");

// Backward-compatible aliases
export const verifyToken = protect;
export const adminMiddleware = adminOnly;
export const deliveryMiddleware = riderOnly;
