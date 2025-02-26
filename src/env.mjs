import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().url().optional(),

    // JWT
    JWT_SECRET: z.string().min(32),

    // SMTP
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.string().transform((val) => parseInt(val, 10)),
    SMTP_USER: z.string().min(1),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_FROM: z.string().email(),
    SMTP_SECURE: z
      .string()
      .transform((val) => val === "true")
      .default("true"),

    // Initial Admin Setup
    INITIAL_ADMIN_EMAIL: z.string().email(),
    INITIAL_ADMIN_PASSWORD: z
      .string()
      .min(8, "Initial admin password must be at least 8 characters"),

    // Session
    SESSION_SECRET: z.string().min(32),
    SESSION_EXPIRY_MINUTES: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
      .default("30"),

    // Security
    MASTER_KEY: z.string().min(32),
    OWNERSHIP_TRANSFER_EXPIRY_HOURS: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
      .default("24"),
    AUTH_CODE_EXPIRY_MINUTES: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
      .default("5"),

    // Transfer timing settings
    TRANSFER_COOLDOWN_SECONDS: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
      .default("86400"), // 24 hours
    TRANSFER_SAFETY_MARGIN_SECONDS: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
      .default("300"), // 5 minutes

    // Cloudflare Turnstile
    TURNSTILE_SECRET_KEY: z.string().min(1),

    // Node environment
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    // Blockchain
    BLOCKCHAIN_VERSION: z.string().min(1),
  },

  client: {
    // App
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    // Cloudflare Turnstile
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_SECURE: process.env.SMTP_SECURE,
    INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL,
    INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_EXPIRY_MINUTES: process.env.SESSION_EXPIRY_MINUTES,
    MASTER_KEY: process.env.MASTER_KEY,
    OWNERSHIP_TRANSFER_EXPIRY_HOURS:
      process.env.OWNERSHIP_TRANSFER_EXPIRY_HOURS,
    AUTH_CODE_EXPIRY_MINUTES: process.env.AUTH_CODE_EXPIRY_MINUTES,
    NODE_ENV: process.env.NODE_ENV,
    BLOCKCHAIN_VERSION: process.env.BLOCKCHAIN_VERSION,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    TRANSFER_COOLDOWN_SECONDS: process.env.TRANSFER_COOLDOWN_SECONDS,
    TRANSFER_SAFETY_MARGIN_SECONDS: process.env.TRANSFER_SAFETY_MARGIN_SECONDS,
  },

  skipValidation: process.env.CI === "true",
});
