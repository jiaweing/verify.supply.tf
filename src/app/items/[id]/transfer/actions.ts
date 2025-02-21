"use server";

import { db } from "@/db";
import { items, ownershipTransfers, transactions } from "@/db/schema";
import { env } from "@/env.mjs";
import { validateSession } from "@/lib/auth";
import { getCurrentOwner, verifyItemChain } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { formatMintNumber } from "@/lib/item";
import { and, asc, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function transferItem(formData: FormData) {
  const itemId = formData.get("itemId") as string;
  const newOwnerName = formData.get("newOwnerName") as string;
  const newOwnerEmail = formData.get("newOwnerEmail") as string;

  if (!itemId || !newOwnerName || !newOwnerEmail) {
    return { success: false, error: "Missing required fields" };
  }

  // Get cooldown periods from environment variables (convert seconds to milliseconds)
  const COOLDOWN_PERIOD = env.TRANSFER_COOLDOWN_SECONDS * 1000;
  const SAFETY_MARGIN = env.TRANSFER_SAFETY_MARGIN_SECONDS * 1000;

  // Check transfer cooldown using normalized timestamps
  const lastTransfer = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.itemId, itemId),
      eq(transactions.transactionType, "transfer")
    ),
    orderBy: [desc(transactions.timestamp)],
  });

  if (lastTransfer) {
    // Get current time in UTC with normalized milliseconds
    const currentTime = new Date(
      new Date().toISOString().replace(/\.\d+Z$/, ".000Z")
    );
    const lastTransferTime = new Date(
      lastTransfer.timestamp.toISOString().replace(/\.\d+Z$/, ".000Z")
    );

    const timeSinceLastTransfer =
      currentTime.getTime() - lastTransferTime.getTime();

    // Add safety margin to cooldown period
    if (timeSinceLastTransfer < COOLDOWN_PERIOD + SAFETY_MARGIN) {
      const remainingTime =
        COOLDOWN_PERIOD + SAFETY_MARGIN - timeSinceLastTransfer;
      const hoursRemaining = Math.ceil(remainingTime / (60 * 60 * 1000));

      return {
        success: false,
        error: `Please wait ${hoursRemaining} hours before attempting another transfer. This cooldown helps ensure transaction security.`,
      };
    }
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return { success: false, error: "Authentication required" };
  }

  const authenticatedItemId = await validateSession(sessionToken);
  if (!authenticatedItemId || authenticatedItemId !== itemId) {
    return { success: false, error: "Unauthorized to transfer this item" };
  }

  // Get item details and verify blockchain integrity
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
    with: {
      latestTransaction: {
        with: {
          block: true,
        },
      },
    },
  });

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // Get mint number for emails
  const formattedMintNumber = await formatMintNumber(item.id);

  // Verify blockchain integrity before proceeding
  const verifyResult = await verifyItemChain(db, itemId);
  if (!verifyResult.isValid) {
    return {
      success: false,
      error: "Current item data does not match blockchain record",
    };
  }

  // Get current ownership info from transaction history
  const txHistory = await db.query.transactions.findMany({
    where: eq(transactions.itemId, itemId),
    with: {
      block: true,
    },
    orderBy: [asc(transactions.timestamp)],
  });

  const currentOwnership = getCurrentOwner(txHistory, {
    originalOwnerName: item.originalOwnerName,
    originalOwnerEmail: item.originalOwnerEmail,
    createdAt: item.createdAt,
  });

  // Prevent transferring to self using email or name
  if (
    newOwnerEmail === currentOwnership.currentOwnerEmail ||
    newOwnerEmail === currentOwnership.currentOwnerName
  ) {
    return {
      success: false,
      error:
        "Invalid transfer: Cannot transfer to current owner or their registered name",
    };
  }

  // Check for any existing pending transfers
  const existingTransfer = await db.query.ownershipTransfers.findFirst({
    where: and(
      eq(ownershipTransfers.itemId, itemId),
      eq(ownershipTransfers.isConfirmed, false)
    ),
  });

  if (existingTransfer) {
    return {
      success: false,
      error: "There is already a pending transfer for this item",
    };
  }

  // Convert to UTC timestamp and add 24 hours
  // Generate normalized timestamp for expiry
  const timestampISO = new Date().toISOString().replace(/\.\d+Z$/, ".000Z");
  const expiresAt = new Date(
    new Date(timestampISO).getTime() +
      env.OWNERSHIP_TRANSFER_EXPIRY_HOURS * 60 * 60 * 1000
  );

  // Create transfer record with current owner from blockchain
  const [transfer] = await db
    .insert(ownershipTransfers)
    .values({
      itemId,
      currentOwnerEmail: currentOwnership.currentOwnerEmail,
      newOwnerName,
      newOwnerEmail,
      expiresAt,
      isConfirmed: false,
      createdAt: new Date(timestampISO), // Explicitly set createdAt in UTC
    })
    .returning();

  // Generate the confirmation URL
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/items/${itemId}/transfer/${transfer.id}/confirm`;

  // Send email to new owner
  await sendEmail({
    to: newOwnerEmail,
    type: "transfer-request",
    data: {
      newOwnerName,
      newOwnerEmail,
      itemDetails: {
        serialNumber: item.serialNumber,
        sku: item.sku,
        mintNumber: formattedMintNumber,
      },
      confirmUrl,
    },
  });

  return {
    success: true,
    data: transfer,
  };
}

export async function cancelTransfer(formData: FormData) {
  const itemId = formData.get("itemId") as string;
  const transferId = formData.get("transferId") as string;

  if (!itemId || !transferId) {
    return { success: false, error: "Missing required fields" };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return { success: false, error: "Authentication required" };
  }

  const authenticatedItemId = await validateSession(sessionToken);
  if (!authenticatedItemId || authenticatedItemId !== itemId) {
    return { success: false, error: "Unauthorized to cancel this transfer" };
  }

  // Get item details for the email
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  // Get mint number for emails
  const formattedMintNumber = await formatMintNumber(item.id);

  const transfer = await db.query.ownershipTransfers.findFirst({
    where: eq(ownershipTransfers.id, transferId),
  });

  if (!transfer) {
    return { success: false, error: "Transfer not found" };
  }

  // Delete the transfer record
  await db
    .delete(ownershipTransfers)
    .where(eq(ownershipTransfers.id, transferId));

  // Send cancellation email
  await sendEmail({
    to: transfer.newOwnerEmail,
    type: "transfer-cancelled",
    data: {
      itemDetails: {
        serialNumber: item.serialNumber,
        sku: item.sku,
        mintNumber: formattedMintNumber,
      },
    },
  });

  return { success: true };
}
