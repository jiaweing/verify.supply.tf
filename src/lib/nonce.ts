import { db } from "@/db";
import { transactions } from "@/db/schema";
import crypto from "crypto";
import { eq } from "drizzle-orm";

export function generateNonce(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function isNonceUsed(nonce: string): Promise<boolean> {
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.transactionNonce, nonce),
  });
  return !!transaction;
}
