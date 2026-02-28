import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "./models/User";

const MONGO_URI = process.env.MONGO_URI as string;
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL as string;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD as string;

if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing required env vars: MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD");
  process.exit(1);
}

async function seed() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("Connected.");

  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (existing) {
    if (existing.role === "admin") {
      console.log(`Admin already exists: ${ADMIN_EMAIL}`);
    } else {
      // Upgrade existing account to admin
      existing.role = "admin";
      existing.isEmailVerified = true;
      existing.password = ADMIN_PASSWORD; // will be hashed by pre-save hook
      await existing.save();
      console.log(`✓ Upgraded existing account to admin: ${ADMIN_EMAIL}`);
    }
  } else {
    await new User({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin",
      isEmailVerified: true,
    }).save();
    console.log(`✓ Admin created: ${ADMIN_EMAIL}`);
  }

  console.log("──────────────────────────────────────────\n");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
