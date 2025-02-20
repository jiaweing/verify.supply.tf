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
  // Check rate limit first
  const rateLimitResult = await nonceRateLimiter.check(
    req || ({} as NextRequest),
    100,
    nonce
  );

  if (!rateLimitResult.success) {
    throw new Error("Rate limit exceeded for nonce validation");
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
}

/**
 * Cleans up old nonces from the database to prevent bloat
 * @returns The number of nonces cleaned up
 */
export async function cleanupOldNonces(): Promise<number> {
  // First fetch old transactions to be deleted
  const oldTransactions = await db.query.transactions.findMany({
    where: lt(
      transactions.timestamp,
      new Date(Date.now() - MAX_NONCE_AGE_HOURS * 60 * 60 * 1000)
    ),
    limit: 1000,
  });

  if (oldTransactions.length === 0) {
    return 0;
  }

  // Then delete them in a batch
  await db
    .delete(transactions)
    .where(or(...oldTransactions.map((t) => eq(transactions.id, t.id))));

  return oldTransactions.length;
}
