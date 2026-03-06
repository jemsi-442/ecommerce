import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const createAdmin = async () => {
  await connectDB();

  const email = "admin@ramla.com";

  const exists = await User.findOne({ where: { email } });
  if (exists) {
    console.log("Admin already exists");
    process.exit(0);
  }

  await User.create({
    name: "Ramla Admin",
    email,
    password: "admin123",
    role: "admin",
  });

  console.log("Admin created successfully");
  process.exit(0);
};

createAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
