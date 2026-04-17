import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { serializeUser } from "../utils/serializers.js";

const extractBearerToken = (authorizationHeader = "") => {
  if (!authorizationHeader.startsWith("Bearer ")) return null;
  return authorizationHeader.split(" ")[1];
};

const loadAuthenticatedUser = async (authorizationHeader = "") => {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return { token: null, user: null };
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findByPk(decoded.id);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (!user.active) {
    throw new Error("ACCOUNT_SUSPENDED");
  }

  return { token, user: serializeUser(user) };
};

export const protect = async (req, res, next) => {
  try {
    const { token, user } = await loadAuthenticatedUser(req.headers.authorization || "");
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided", data: null });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.message === "ACCOUNT_SUSPENDED") {
      return res.status(403).json({ success: false, message: "Account suspended", data: null });
    }

    if (error.message === "USER_NOT_FOUND") {
      return res.status(401).json({ success: false, message: "User not found", data: null });
    }

    return res.status(401).json({ success: false, message: "Invalid token", data: null });
  }
};

export const optionalProtect = async (req, res, next) => {
  try {
    const { user } = await loadAuthenticatedUser(req.headers.authorization || "");
    if (user) {
      req.user = user;
    }
  } catch (error) {
    req.user = null;
  }

  next();
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
