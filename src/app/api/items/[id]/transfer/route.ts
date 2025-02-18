import { db } from "@/db";
import { blocks, items, ownershipTransfers, transactions } from "@/db/schema";
import { env } from "@/env.mjs";
import { validateSession } from "@/lib/auth";
import {
  Block,
  TransactionData,
  getCurrentOwner,
  getItemTransactionHistory,
} from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const TRANSFER_EXPIRY_HOURS = env.OWNERSHIP_TRANSFER_EXPIRY_HOURS
  ? env.OWNERSHIP_TRANSFER_EXPIRY_HOURS
  : 24;

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return Response.json(
        { error: "No session token found" },
        { status: 401 }
      );
    }

    const authenticatedItemId = await validateSession(sessionToken);
    if (!authenticatedItemId) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    if (authenticatedItemId !== params.id) {
      return Response.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { newOwnerEmail, newOwnerName } = await request.json();

    // Get full item details and transaction history
    const item = await db.query.items.findFirst({
      where: eq(items.id, authenticatedItemId),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Get current ownership info from transaction history
    const txHistory = await getItemTransactionHistory(db, authenticatedItemId);
    const currentOwnership = getCurrentOwner(txHistory, {
      originalOwnerName: item.originalOwnerName,
      originalOwnerEmail: item.originalOwnerEmail,
      createdAt: item.createdAt,
    });

    // Check if there's already a pending transfer
    const existingTransfer = await db.query.ownershipTransfers.findFirst({
      where: eq(ownershipTransfers.itemId, authenticatedItemId),
    });

    if (existingTransfer && !existingTransfer.isConfirmed) {
      return Response.json(
        { error: "There is already a pending transfer for this item" },
        { status: 400 }
      );
    }

    // Create transfer request
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TRANSFER_EXPIRY_HOURS);

    const createdTransfer = await db
      .insert(ownershipTransfers)
      .values({
        itemId: authenticatedItemId,
        currentOwnerEmail: currentOwnership.currentOwnerEmail,
        newOwnerEmail,
        newOwnerName,
        expiresAt,
      })
      .returning();

    // Send transfer request email to new owner
    await sendEmail({
      to: newOwnerEmail,
      type: "transfer-request",
      data: {
        newOwnerName,
        newOwnerEmail,
        itemDetails: {
          serialNumber: item.serialNumber,
          sku: item.sku,
        },
        confirmUrl: `${env.NEXT_PUBLIC_APP_URL}/items/${authenticatedItemId}/transfer/${createdTransfer[0].id}/confirm`,
      },
    });

    return Response.json({
      message: "Transfer initiated successfully",
      expiresAt,
    });
  } catch (error) {
    console.error("Error in /api/items/[id]/transfer:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate transfer",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return Response.json(
        { error: "No session token found" },
        { status: 401 }
      );
    }

    const authenticatedItemId = await validateSession(sessionToken);
    if (!authenticatedItemId) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    if (authenticatedItemId !== params.id) {
      return Response.json({ error: "Unauthorized access" }, { status: 403 });
    }

    // Find pending transfer for this item
    const pendingTransfer = await db.query.ownershipTransfers.findFirst({
      where: eq(ownershipTransfers.itemId, authenticatedItemId),
    });

    if (!pendingTransfer || pendingTransfer.isConfirmed) {
      return Response.json(
        { error: "No pending transfer found" },
        { status: 404 }
      );
    }

    // Delete the transfer request
    await db
      .delete(ownershipTransfers)
      .where(eq(ownershipTransfers.id, pendingTransfer.id));

    return Response.json({ message: "Transfer cancelled successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/items/[id]/transfer:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to cancel transfer",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { transferId, action } = await request.json();

    if (!["confirm", "reject"].includes(action)) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get the transfer request
    const transfer = await db.query.ownershipTransfers.findFirst({
      where: eq(ownershipTransfers.id, transferId),
    });

    if (!transfer) {
      return Response.json(
        { error: "Transfer request not found" },
        { status: 404 }
      );
    }

    if (transfer.itemId !== params.id) {
      return Response.json(
        { error: "Transfer request does not match item" },
        { status: 400 }
      );
    }

    if (transfer.isConfirmed) {
      return Response.json(
        { error: "Transfer has already been processed" },
        { status: 400 }
      );
    }

    if (new Date() > transfer.expiresAt) {
      return Response.json(
        { error: "Transfer request has expired" },
        { status: 400 }
      );
    }

    if (action === "confirm") {
      // Get current item details
      // Get full item details and transaction history
      const item = await db.query.items.findFirst({
        where: eq(items.id, transfer.itemId),
        with: {
          latestTransaction: {
            with: {
              block: true,
            },
          },
        },
      });

      const txHistory = await getItemTransactionHistory(db, transfer.itemId);
      const currentOwnership = getCurrentOwner(txHistory, {
        originalOwnerName: item!.originalOwnerName,
        originalOwnerEmail: item!.originalOwnerEmail,
        createdAt: item!.createdAt,
      });

      if (!item) {
        return Response.json({ error: "Item not found" }, { status: 404 });
      }

      // Get the last block for chain linking
      const lastBlock = await db.query.blocks.findFirst({
        orderBy: (blocks, { desc }) => [desc(blocks.blockNumber)],
      });

      const nextBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;
      // Generate normalized timestamp once to use consistently
      const timestampISO = new Date().toISOString().replace(/\.\d+/, ".000");
      const timestamp = new Date(timestampISO); // For DB

      const transactionData: TransactionData = {
        type: "transfer",
        itemId: item!.id,
        timestamp: timestampISO,
        data: {
          from: {
            name: currentOwnership.currentOwnerName,
            email: currentOwnership.currentOwnerEmail,
          },
          to: {
            name: transfer.newOwnerName,
            email: transfer.newOwnerEmail,
          },
          item: {
            id: item!.id,
            serialNumber: item!.serialNumber,
            sku: item!.sku,
            mintNumber: item!.mintNumber,
            weight: item!.weight,
            nfcSerialNumber: item!.nfcSerialNumber,
            orderId: item!.orderId,
            originalOwnerName: item!.originalOwnerName,
            originalOwnerEmail: item!.originalOwnerEmail,
            originalPurchaseDate: item!.originalPurchaseDate,
            purchasedFrom: item!.purchasedFrom,
            manufactureDate: item!.manufactureDate,
            producedAt: item!.producedAt,
            createdAt: item!.createdAt,
            blockchainVersion: item!.blockchainVersion,
            globalKeyVersion: item!.globalKeyVersion,
            nfcLink: item!.nfcLink, // Keep the original NFC link unchanged
          },
        },
      };

      // Create new block using the same timestamp
      const block = new Block(
        nextBlockNumber,
        lastBlock?.hash ?? "0".repeat(64),
        [transactionData],
        timestampISO
      );

      const blockHash = block.calculateHash();
      const merkleRoot = block.getMerkleTree().getRoot();

      await db.transaction(async (tx) => {
        // Create block record
        const [newBlock] = await tx
          .insert(blocks)
          .values({
            blockNumber: nextBlockNumber,
            timestamp,
            previousHash: lastBlock?.hash ?? "0".repeat(64),
            merkleRoot,
            nonce: 0,
            hash: blockHash,
          })
          .returning();

        // Create transaction record
        const [newTransaction] = await tx
          .insert(transactions)
          .values({
            blockId: newBlock.id,
            transactionType: "transfer",
            itemId: item.id,
            data: transactionData,
            timestamp, // Add timestamp since it's required
            hash: merkleRoot, // Since we have one transaction per block, this is the same as merkle root
          })
          .returning();

        // Only update the latest transaction ID since ownership is tracked in transactions
        await tx
          .update(items)
          .set({
            latestTransactionId: newTransaction.id, // Don't update nfcLink, keep it as original
          })
          .where(eq(items.id, transfer.itemId));

        // Mark transfer as confirmed
        await tx
          .update(ownershipTransfers)
          .set({ isConfirmed: true })
          .where(eq(ownershipTransfers.id, transfer.id));
      });

      // Send confirmation emails to both the new owner and original owner
      await Promise.all([
        // Send confirmation to new owner
        sendEmail({
          to: transfer.newOwnerEmail,
          type: "transfer-confirmed",
          data: {
            itemDetails: {
              serialNumber: item.serialNumber,
              sku: item.sku,
            },
            viewUrl: `${env.NEXT_PUBLIC_APP_URL}/items/${item.id}`,
          },
        }),
        // Send completion notice to original owner
        sendEmail({
          to: transfer.currentOwnerEmail,
          type: "transfer-completed",
          data: {
            itemDetails: {
              serialNumber: item.serialNumber,
              sku: item.sku,
            },
            newOwnerName: transfer.newOwnerName,
            newOwnerEmail: transfer.newOwnerEmail,
          },
        }),
      ]);

      return Response.json({ message: "Transfer confirmed successfully" });
    } else {
      // Delete the transfer request when rejected
      await db
        .delete(ownershipTransfers)
        .where(eq(ownershipTransfers.id, transfer.id));

      return Response.json({ message: "Transfer rejected successfully" });
    }
  } catch (error) {
    console.error("Error in PUT /api/items/[id]/transfer:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process transfer",
      },
      { status: 500 }
    );
  }
}
