import asyncHandler from "../middleware/asyncHandler.js";
import { Rider, User } from "../models/index.js";
import { serializeUser } from "../utils/serializers.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeName = (value = "") => String(value).trim().replace(/\s+/g, " ");
const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizePhone = (value = "") => String(value).trim();

const serializeVendorRider = (rider, user = rider?.user) => {
  if (!rider) {
    return null;
  }

  return {
    ...rider.toJSON(),
    user: user ? serializeUser(user) : null,
  };
};

export const getVendorRiders = asyncHandler(async (req, res) => {
  const riders = await Rider.findAll({
    where: { vendorId: req.user._id },
    include: [{ model: User, as: "user", required: false }],
    order: [["created_at", "DESC"]],
  });

  return res.json({
    data: riders.map((rider) => serializeVendorRider(rider, rider.user)),
  });
});

export const createVendorRider = asyncHandler(async (req, res) => {
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

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return res.status(400).json({ message: "Email already in use" });
  }

  const result = await User.sequelize.transaction(async (transaction) => {
    const riderUser = await User.create(
      {
        name,
        email,
        phone,
        password,
        role: "rider",
        active: true,
      },
      { transaction }
    );

    const rider = await Rider.create(
      {
        userId: riderUser.id,
        vendorId: req.user._id,
        name,
        phone,
        available: true,
        isActive: true,
      },
      { transaction }
    );

    return { riderUser, rider };
  });

  return res.status(201).json({
    message: "Vendor rider created successfully",
    data: serializeVendorRider(result.rider, result.riderUser),
  });
});

export const updateVendorRiderStatus = asyncHandler(async (req, res) => {
  const rider = await Rider.findOne({
    where: {
      id: req.params.id,
      vendorId: req.user._id,
    },
  });

  if (!rider) {
    return res.status(404).json({ message: "Rider not found" });
  }

  if (typeof req.body?.isActive === "boolean") {
    rider.isActive = req.body.isActive;
  }

  if (typeof req.body?.available === "boolean") {
    rider.available = req.body.available;
  }

  await rider.save();

  return res.json({
    message: "Vendor rider status updated successfully",
    data: rider.toJSON(),
  });
});

export const resetVendorRiderPassword = asyncHandler(async (req, res) => {
  const password = String(req.body?.password || "");

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const rider = await Rider.findOne({
    where: {
      id: req.params.id,
      vendorId: req.user._id,
    },
    include: [{ model: User, as: "user", required: false }],
  });

  if (!rider?.user) {
    return res.status(404).json({ message: "Rider not found" });
  }

  rider.user.password = password;
  await rider.user.save();

  return res.json({
    message: "Vendor rider password reset successfully",
    data: serializeVendorRider(rider, rider.user),
  });
});
