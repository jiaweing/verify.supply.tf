"use server";

type TransferResponse =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

import { db } from "@/db";
import { ownershipTransfers, transactions } from "@/db/schema";
import { createSession, deleteSessionByItemId } from "@/lib/auth";
import { createTransactionBlock, getCurrentOwner } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { formatMintNumber } from "@/lib/item";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function confirmTransfer(
  itemId: string,
  transferId: string
): Promise<TransferResponse> {
  const transfer = await db.query.ownershipTransfers.findFirst({
    where: eq(ownershipTransfers.id, transferId),
    with: {
      item: true,
    },
  });

  if (!transfer || transfer.itemId !== itemId || transfer.isConfirmed) {
    return { success: false, error: "Invalid transfer request" };
  }

  if (new Date() > transfer.expiresAt) {
    return { success: false, error: "Transfer request has expired" };
  }

  const formattedMintNumber = await formatMintNumber(transfer.itemId);

  try {
    const history = await db.query.transactions.findMany({
      where: eq(transactions.itemId, itemId),
      with: {
        block: true,
      },
      orderBy: [asc(transactions.timestamp)],
    });
    const currentOwner = getCurrentOwner(history, {
      originalOwnerName: transfer.item.originalOwnerName,
      originalOwnerEmail: transfer.item.originalOwnerEmail,
      createdAt: transfer.item.createdAt,
    });

    const result = await createTransactionBlock(db, {
      type: "transfer",
      itemId: transfer.itemId,
      from: {
        name: currentOwner.currentOwnerName,
        email: currentOwner.currentOwnerEmail,
      },
      to: {
        name: transfer.newOwnerName,
        email: transfer.newOwnerEmail,
      },
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create transaction",
      };
    }

    // Invalidate original owner's session
    await deleteSessionByItemId(transfer.itemId);

    // Create session for new owner and clean up transfer
    const { sessionToken } = await createSession(transfer.itemId);
    const cookieStore = await cookies();
    cookieStore.set("session_token", sessionToken, {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      path: "/",
    });

    await Promise.all([
      // Send confirmation emails
      sendEmail({
        to: transfer.newOwnerEmail,
        type: "transfer-confirmed",
        data: {
          itemDetails: {
            serialNumber: transfer.item.serialNumber,
            sku: transfer.item.sku,
            mintNumber: formattedMintNumber,
          },
          viewUrl: transfer.item.nfcLink,
        },
      }),
      sendEmail({
        to: currentOwner.currentOwnerEmail,
        type: "transfer-completed",
        data: {
          itemDetails: {
            serialNumber: transfer.item.serialNumber,
            sku: transfer.item.sku,
            mintNumber: formattedMintNumber,
          },
          newOwnerName: transfer.newOwnerName,
          newOwnerEmail: transfer.newOwnerEmail,
        },
      }),
      // Delete the transfer record
      db
        .delete(ownershipTransfers)
        .where(eq(ownershipTransfers.id, transferId)),
    ]);

    return { success: true, redirectTo: `/items/${transfer.itemId}` };
  } catch (error) {
    console.error("Error confirming transfer:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to confirm transfer",
    };
  }
}

export async function rejectTransfer(
  itemId: string,
  transferId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const transfer = await db.query.ownershipTransfers.findFirst({
    where: eq(ownershipTransfers.id, transferId),
    with: {
      item: true,
    },
  });

  if (!transfer || transfer.itemId !== itemId) {
    return { success: false, error: "Invalid transfer request" };
  }

  const formattedMintNumber = await formatMintNumber(transfer.itemId);

  await sendEmail({
    to: transfer.newOwnerEmail,
    type: "transfer-declined",
    data: {
      itemDetails: {
        serialNumber: transfer.item.serialNumber,
        sku: transfer.item.sku,
        mintNumber: formattedMintNumber,
      },
      newOwnerName: transfer.newOwnerName,
      newOwnerEmail: transfer.newOwnerEmail,
    },
  });

  await db
    .delete(ownershipTransfers)
    .where(eq(ownershipTransfers.id, transferId));

  return { success: true };
}
