import * as bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "../db";
import { adminUsers, sessions } from "../db/schema";
import { env } from "../env.mjs";

// Authentication schemas
export const authCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const loginResponseSchema = z.object({
  sessionToken: z.string(),
  expiresAt: z.string().datetime(),
});

// Helper functions
export async function generateAuthCode(): Promise<string> {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateSessionToken(itemId: string): string {
  return jwt.sign({ itemId }, env.SESSION_SECRET, {
    expiresIn: `${env.SESSION_EXPIRY_MINUTES}m`,
  });
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// Session management
export async function createSession(itemId: string): Promise<{
  sessionToken: string;
  expiresAt: Date;
}> {
  try {
    const sessionToken = generateSessionToken(itemId);
    const expiresAt = new Date(
      Date.now() + env.SESSION_EXPIRY_MINUTES * 60 * 1000
    );

    const result = await db.insert(sessions).values({
      itemId,
      sessionToken,
      expiresAt,
    });
    console.log("Session created:", { itemId, sessionToken, expiresAt });
    console.log("Result:", result);

    return { sessionToken, expiresAt };
  } catch (error) {
    console.error("Failed to create session:", error);
    throw error;
  }
}

export async function validateSession(
  sessionToken: string
): Promise<string | null> {
  try {
    // First verify the JWT token
    const decoded = jwt.verify(
      sessionToken,
      env.SESSION_SECRET
    ) as SessionJwtPayload;
    const itemId = decoded.itemId;
    console.log(itemId);

    // find and log
    const sessionfind = await db.query.sessions.findFirst({
      where: eq(sessions.sessionToken, sessionToken),
    });
    console.log("Session validated:", sessionfind);

    // First check if the session exists
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.sessionToken, sessionToken),
        eq(sessions.itemId, itemId)
      ),
    });
    console.log("Session validated:", session);

    // Check if session is expired
    const now = new Date();
    if (!session || session.expiresAt < now) {
      // Clean up expired sessions
      await db
        .delete(sessions)
        .where(sql`${sessions.expiresAt} < ${sql`NOW()`}`);
      return null;
    }

    return session.itemId;
  } catch (error) {
    console.error("Session validation failed:", error);
    return null;
  }
}

export async function deleteSession(sessionToken: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
}

// Types
export type AuthCode = z.infer<typeof authCodeSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

interface AdminJwtPayload {
  admin: boolean;
  email: string;
  iat: number;
  exp: number;
}

interface SessionJwtPayload {
  itemId: string;
  iat: number;
  exp: number;
}

// Admin authentication
export async function initializeAdmin(): Promise<void> {
  // Check if admin exists
  const existingAdmin = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, env.INITIAL_ADMIN_EMAIL),
  });

  if (!existingAdmin) {
    // Create initial admin user
    const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
    await db.insert(adminUsers).values({
      email: env.INITIAL_ADMIN_EMAIL,
      passwordHash,
    });
    console.log(`Initial admin user ${env.INITIAL_ADMIN_EMAIL} created`);
  }
}

export async function auth(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return false;

    const decoded = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;
    if (!decoded.email) return false;

    // Verify admin exists in database
    const admin = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, decoded.email),
    });

    return admin !== null;
  } catch {
    return false;
  }
}

export async function adminLogin(
  email: string,
  password: string
): Promise<string | null> {
  const admin = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.email, email),
  });

  if (!admin) return null;

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) return null;

  const token = jwt.sign({ admin: true, email: admin.email }, env.JWT_SECRET, {
    expiresIn: "24h",
  });
  return token;
}
