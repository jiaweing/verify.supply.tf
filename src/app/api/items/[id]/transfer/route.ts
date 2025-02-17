import { db } from "@/db";
import { blocks, items, ownershipTransfers, transactions } from "@/db/schema";
import { env } from "@/env.mjs";
import { validateSession } from "@/lib/auth";
import { Block, TransactionData } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { eq } from "drizzle-orm";
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

    const { newOwnerEmail, newOwnerName } = await request.json();

    // Get current item details
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemId),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if there's already a pending transfer
    const existingTransfer = await db.query.ownershipTransfers.findFirst({
      where: eq(ownershipTransfers.itemId, itemId),
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
        itemId,
        currentOwnerEmail: item.currentOwnerEmail,
        newOwnerEmail,
        newOwnerName,
        expiresAt,
      })
      .returning();

    // Send transfer request email to current owner
    await sendEmail({
      to: item.currentOwnerEmail,
      type: "transfer-request",
      data: {
        newOwnerName,
        newOwnerEmail,
        itemDetails: {
          serialNumber: item.serialNumber,
          sku: item.sku,
        },
        confirmUrl: `${env.NEXT_PUBLIC_APP_URL}/items/${itemId}/transfer/${createdTransfer[0].id}/confirm`,
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

      if (!item) {
        return Response.json({ error: "Item not found" }, { status: 404 });
      }

      // Get the last block for chain linking
      const lastBlock = await db.query.blocks.findFirst({
        orderBy: (blocks, { desc }) => [desc(blocks.blockNumber)],
      });

      const nextBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;
      // Generate timestamp once and use its ISO string consistently
      const timestampISO = new Date().toISOString();
      const timestamp = new Date(timestampISO); // For DB

      // Create transaction data
      const transactionData: TransactionData = {
        type: "transfer",
        itemId: item.id,
        timestamp: timestampISO,
        data: {
          from: {
            name: item.currentOwnerName,
            email: item.currentOwnerEmail,
          },
          to: {
            name: transfer.newOwnerName,
            email: transfer.newOwnerEmail,
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
            hash: merkleRoot, // Since we have one transaction per block, this is the same as merkle root
          })
          .returning();

        // Update item ownership
        await tx
          .update(items)
          .set({
            currentOwnerName: transfer.newOwnerName,
            currentOwnerEmail: transfer.newOwnerEmail,
            modifiedAt: timestamp,
            latestTransactionId: newTransaction.id,
          })
          .where(eq(items.id, transfer.itemId));

        // Mark transfer as confirmed
        await tx
          .update(ownershipTransfers)
          .set({ isConfirmed: true })
          .where(eq(ownershipTransfers.id, transfer.id));
      });

      // Send confirmation email to new owner
      await sendEmail({
        to: transfer.newOwnerEmail,
        type: "transfer-confirmed",
        data: {
          itemDetails: {
            serialNumber: item.serialNumber,
            sku: item.sku,
          },
          viewUrl: `${env.NEXT_PUBLIC_APP_URL}/items/${item.id}`,
        },
      });

      return Response.json({ message: "Transfer confirmed successfully" });
    } else {
      // Mark transfer as rejected
      await db
        .update(ownershipTransfers)
        .set({ isConfirmed: false })
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
