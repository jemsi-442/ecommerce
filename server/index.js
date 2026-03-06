import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import ordersRoutes from "./routes/ordersRoutes.js";
import productsRoutes from "./routes/productsRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";

import { riderAutoTimeout } from "./jobs/riderTimeout.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ MongoDB Atlas connection
const rawMongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
const mongoURI = rawMongoURI
  ? rawMongoURI.trim().replace(/^['"]|['"]$/g, "")
  : ""; // support accidental quotes in env var values

if (!mongoURI) {
  console.error("❌ MONGODB_URI/MONGO_URI not defined in environment variables");
  process.exit(1);
}

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

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

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB connected");

    // Rider SLA job
    setInterval(() => {
      riderAutoTimeout();
    }, 30000);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

startServer();
