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
import vendorRoutes from "./routes/vendorRoutes.js";
import storesRoutes from "./routes/storesRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

import { riderAutoTimeout } from "./jobs/riderTimeout.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { isCloudinaryConfigured } from "./middleware/uploadMiddleware.js";
import { isSmtpConfigured } from "./utils/mailer.js";
import { ensureAdminAccount } from "./utils/createAdmin.js";
import { isSnippeConfigured, isSnippeWebhookConfigured } from "./utils/snippe.js";
import { startNotificationEventRelay } from "./utils/notificationStream.js";

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

  if (!process.env.CLIENT_URL && !process.env.CLIENT_URLS) {
    throw new Error("CLIENT_URL or CLIENT_URLS must be set for production");
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

  if (!isSnippeConfigured()) {
    console.warn(" Snippe is not configured. Mobile money payments will be unavailable.");
  } else if (!isSnippeWebhookConfigured()) {
    console.warn(" Snippe webhook secret is not configured. Payment verification will fail.");
  }
};

export const createApp = () => {
  const app = express();

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use(
    express.json({
      limit: "2mb",
      verify: (req, res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "API Running",
      data: {
        environment: process.env.NODE_ENV || "development",
      },
    });
  });

  app.use("/api/admin", adminRoutes);
  app.use("/api/admin", adminDashboardRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/vendor", vendorRoutes);
  app.use("/api/stores", storesRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/rider", riderRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/payments", paymentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();

export const startServer = async ({
  port = PORT,
  bootstrapAdmin = process.env.AUTO_BOOTSTRAP_ADMIN !== "false",
  startBackgroundJobs = process.env.DISABLE_RIDER_TIMEOUT_JOB !== "true",
} = {}) => {
  validateProductionEnv();
  await connectDB();
  console.log(" MariaDB connected");

  if (bootstrapAdmin) {
    const result = await ensureAdminAccount({ resetExisting: false });
    console.log(
      result.created
        ? ` Admin bootstrapped for ${result.email}`
        : ` Admin account verified for ${result.email}`
    );
  }

  const riderTimeoutInterval =
    startBackgroundJobs
      ? setInterval(() => {
          riderAutoTimeout();
        }, 30000)
      : null;
  const stopNotificationRelay = startBackgroundJobs ? startNotificationEventRelay() : () => {};

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(port, () => {
      const runningPort = instance.address()?.port ?? port;
      console.log(` Server running on port ${runningPort}`);
      resolve(instance);
    });

    instance.on("error", (error) => {
      reject(error);
    });
  });

  const close = async () => {
    if (riderTimeoutInterval) {
      clearInterval(riderTimeoutInterval);
    }
    stopNotificationRelay();

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  };

  return {
    app,
    server,
    close,
  };
};

const isDirectExecution = import.meta.url === `file://${process.argv[1]}`;

if (isDirectExecution) {
  startServer().catch((error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        ` Port ${PORT} is already in use. Update PORT in server/.env or stop the running process first.`
      );
      process.exit(1);
    }

    console.error(" Database connection failed:", error.message);
    process.exit(1);
  });
}
