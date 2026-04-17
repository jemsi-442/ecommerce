import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

export const ensureAdminAccount = async ({ resetExisting = false } = {}) => {
  const email = process.env.ADMIN_EMAIL || "admin@ramla.com";
  const password = process.env.ADMIN_PASSWORD || "Jay442tx";
  const name = process.env.ADMIN_NAME || "Ramla Admin";

  const existing = await User.findOne({ where: { email } });

  if (existing) {
    if (!resetExisting) {
      if (existing.role !== "admin") {
        throw new Error(
          "Configured admin email already belongs to a non-admin user. Refusing automatic privilege escalation."
        );
      }

      if (!existing.active) {
        throw new Error(
          "Configured admin account is inactive. Re-enable it manually or run the create-admin script."
        );
      }

      return { created: false, email };
    }

    existing.name = name;
    existing.password = password;
    existing.role = "admin";
    existing.active = true;
    await existing.save();
    return { created: false, email };
  }

  await User.create({
    name,
    email,
    password,
    role: "admin",
    active: true,
  });

  return { created: true, email };
};

const run = async () => {
  try {
    await connectDB();
    const result = await ensureAdminAccount({ resetExisting: true });
    console.log(
      result.created
        ? `Admin created successfully for ${result.email}`
        : `Admin account reset successfully for ${result.email}`
    );
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
