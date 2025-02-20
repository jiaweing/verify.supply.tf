"use server";

import { db } from "@/db";
import { items } from "@/db/schema";
import { validateSession } from "@/lib/auth";
import {
  type TransactionData,
  type TransactionHistoryItem,
  getItemTransactionHistory,
  verifyItemChain,
} from "@/lib/blockchain";
import { eq } from "drizzle-orm";

interface TransactionResponse {
  type: string;
  timestamp: Date;
  data: {
    from?: { name: string; email: string };
    to: { name: string; email: string };
  };
  blockNumber?: number;
  blockHash?: string;
}

function formatTransaction(tx: TransactionHistoryItem): TransactionResponse {
  const txData = tx.data as TransactionData;
  return {
    type: tx.transactionType,
    timestamp: tx.timestamp,
    data: txData.data,
    blockNumber: tx.block?.blockNumber,
    blockHash: tx.block?.hash,
  };
}

export async function getTransactionHistoryAction(
  id: string,
  sessionToken: string
) {
  try {
    if (!sessionToken) {
      throw new Error("Authentication required");
    }

    const itemId = await validateSession(sessionToken);
    if (!itemId || itemId !== id) {
      throw new Error("Invalid or expired session");
    }

    const item = await db.query.items.findFirst({
      where: eq(items.id, itemId),
    });

    if (!item) {
      throw new Error("Item not found");
    }

    const transactions = await getItemTransactionHistory(db, itemId);
    const { isValid, error } = await verifyItemChain(db, itemId);

    const history = transactions.map(formatTransaction);

    return {
      success: true,
      data: {
        history,
        verification: {
          isValid,
          error: error || null,
        },
        currentTime: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    throw error;
  }
}
