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
import { NextRequest } from "next/server";

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

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    // Validate session
    const sessionToken = request.headers.get("authorization")?.split(" ")[1];
    if (!sessionToken) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const itemId = await validateSession(sessionToken);
    if (!itemId || itemId !== params.id) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Check if item exists
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemId),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    try {
      // Get transaction history
      const transactions = await getItemTransactionHistory(db, itemId);

      // Verify blockchain integrity
      const { isValid, error } = await verifyItemChain(db, itemId);

      // Format response data
      const history = transactions.map(formatTransaction);

      return Response.json({
        history,
        verification: {
          isValid,
          error: error || null,
        },
        currentTime: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Blockchain verification error:", err);
      return Response.json(
        {
          error: "Failed to verify blockchain integrity",
          details: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch transaction history",
      },
      { status: 500 }
    );
  }
}
