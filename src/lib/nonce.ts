import { db } from "@/db";
import { transactions } from "@/db/schema";
import crypto from "crypto";
import { and, eq, gte, lt, or } from "drizzle-orm";
import { NextRequest } from "next/server";
import { RateLimiter } from "./rate-limit";

const MAX_NONCE_AGE_HOURS = 24;

// Rate limiter for nonce validation (100 requests per minute)
const nonceRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export function generateNonce(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function isNonceUsed(
  nonce: string,
  req?: NextRequest
): Promise<boolean> {
  try {
    // Check rate limit first
    const rateLimitResult = await nonceRateLimiter.check(
      req || ({} as NextRequest),
      100,
      nonce
    );

    if (!rateLimitResult.success) {
      return true; // Treat rate limit exceeded as nonce being used
    }

    const transaction = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.transactionNonce, nonce),
        gte(
          transactions.timestamp,
          new Date(Date.now() - MAX_NONCE_AGE_HOURS * 60 * 60 * 1000)
        )
      ),
    });

    return !!transaction;
  } catch (error) {
    console.error("Error checking nonce:", error);
    return true; // Treat errors as nonce being used for safety
  }
}

/**
 * Cleans up old nonces from the database to prevent bloat
 * @returns The number of nonces cleaned up or error response
 */
export async function cleanupOldNonces(): Promise<{
  success: boolean;
  error?: string;
  data?: number;
}> {
  try {
    // First fetch old transactions to be deleted
    const oldTransactions = await db.query.transactions.findMany({
      where: lt(
        transactions.timestamp,
        new Date(Date.now() - MAX_NONCE_AGE_HOURS * 60 * 60 * 1000)
      ),
      limit: 1000,
    });

    if (oldTransactions.length === 0) {
      return { success: true, data: 0 };
    }

    // Then delete them in a batch
    await db
      .delete(transactions)
      .where(or(...oldTransactions.map((t) => eq(transactions.id, t.id))));

    return { success: true, data: oldTransactions.length };
  } catch (error) {
    console.error("Error cleaning up nonces:", error);
    return {
      success: false,
      error: "Failed to clean up old nonces",
    };
  }
}
