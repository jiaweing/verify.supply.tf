import { initializeAdmin } from "@/lib/auth";
import "dotenv/config";
import { env } from "../env.mjs";
import { initializeKey } from "./initialize-key";

// Debug: Show a few key env variables to verify loading
console.log("Environment check:", {
  DATABASE_URL: env.DATABASE_URL ? "[REDACTED]" : undefined,
  NODE_ENV: env.NODE_ENV,
  SMTP_HOST: env.SMTP_HOST,
});

async function seed() {
  try {
    console.log("Starting seed...");

    // Initialize encryption key first
    console.log("Initializing encryption key...");
    initializeKey();

    // Initialize admin user
    console.log("Initializing admin user...");
    await initializeAdmin();

    console.log("Seed completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
