import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Rider from "../models/Rider.js";

dotenv.config();

export const ensureRiderAccount = async () => {
  const email = process.env.RIDER_EMAIL || "rider@ramla.com";
  const password = process.env.RIDER_PASSWORD || "Jay442tx";
  const name = process.env.RIDER_NAME || "Ramla Rider";
  const phone = process.env.RIDER_PHONE || "0713551801";

  let user = await User.findOne({ where: { email } });

  if (user) {
    user.name = name;
    user.password = password;
    user.role = "rider";
    user.active = true;
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      password,
      role: "rider",
      active: true,
    });
  }

  const existingRider = await Rider.findOne({ where: { userId: user.id } });

  if (existingRider) {
    existingRider.name = name;
    existingRider.phone = phone;
    existingRider.available = true;
    existingRider.isActive = true;
    await existingRider.save();
    return { created: false, email, phone };
  }

  await Rider.create({
    userId: user.id,
    name,
    phone,
    available: true,
    isActive: true,
  });

  return { created: true, email, phone };
};

const run = async () => {
  try {
    await connectDB();
    const result = await ensureRiderAccount();
    console.log(
      result.created
        ? `Rider created successfully for ${result.email}`
        : `Rider account reset successfully for ${result.email}`
    );
    process.exit(0);
  } catch (error) {
    console.error("Error creating rider:", error);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
