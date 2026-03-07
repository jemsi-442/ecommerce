import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import "./models/index.js";

import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import ordersRoutes from "./routes/ordersRoutes.js";
import productsRoutes from "./routes/productsRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import { riderAutoTimeout } from "./jobs/riderTimeout.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { isCloudinaryConfigured } from "./middleware/uploadMiddleware.js";
import { isSmtpConfigured } from "./utils/mailer.js";
import { ensureAdminAccount } from "./utils/createAdmin.js";

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedOrigins = Array.from(
  new Set(
    [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      process.env.CLIENT_URL,
      ...(process.env.CLIENT_URLS || "").split(","),
    ]
      .map((origin) => origin?.trim())
      .filter(Boolean)
  )
);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser tools and same-origin requests without an Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

const isPlaceholderSecret = (value = "") =>
  !value ||
  value.startsWith("replace_with_") ||
  value === "your_super_secret_jwt_key";

const validateProductionEnv = () => {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (isPlaceholderSecret(process.env.JWT_SECRET || "")) {
    throw new Error("JWT_SECRET is missing or still using a placeholder value");
  }

  if (
    process.env.AUTO_BOOTSTRAP_ADMIN !== "false" &&
    (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "Jay442tx")
  ) {
    throw new Error("Disable AUTO_BOOTSTRAP_ADMIN or set a non-default ADMIN_PASSWORD before production deploy");
  }

  if (!isCloudinaryConfigured()) {
    console.warn(" Cloudinary is not configured. Production will fall back to local uploads, which is not recommended.");
  }

  if (!isSmtpConfigured()) {
    console.warn(" SMTP is not configured. Forgot-password emails will not be delivered in production.");
  }
};

// CORS configuration
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Body parser
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Request logging
app.use((req, res, next) => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "request",
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    })
  );
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Running",
    data: {
      environment: process.env.NODE_ENV || "development",
    },
  });
});

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/notifications", notificationRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    validateProductionEnv();
    await connectDB();
    console.log(" MariaDB connected");

    if (process.env.AUTO_BOOTSTRAP_ADMIN !== "false") {
      const result = await ensureAdminAccount();
      console.log(
        result.created
          ? ` Admin bootstrapped for ${result.email}`
          : ` Admin account verified for ${result.email}`
      );
    }

    // Rider SLA job
    setInterval(() => {
      riderAutoTimeout();
    }, 30000);

    const server = app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(` Port ${PORT} is already in use. Update PORT in server/.env or stop the running process first.`);
        process.exit(1);
      }

      console.error(" Server failed to start:", error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error(" Database connection failed:", error.message);
    process.exit(1);
  }
};

startServer();
