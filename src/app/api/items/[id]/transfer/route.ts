import { db } from "@/db";
import { blocks, items, ownershipTransfers, transactions } from "@/db/schema";
import { env } from "@/env.mjs";
import { deleteSessionByItemId, validateSession } from "@/lib/auth";
import {
  Block,
  getCurrentOwner,
  getItemTransactionHistory,
  hash,
  TransactionData,
  verifyItemChain,
} from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { and, asc, desc, eq, not, sql } from "drizzle-orm";
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

    // Prevent transferring to self
    if (newOwnerEmail === currentOwnership.currentOwnerEmail) {
      return Response.json(
        {
          error: "You are already the owner. You cannot transfer to yourself. ",
        },
        { status: 400 }
      );
    }

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

    // Generate normalized timestamp for consistency
    const timestampISO = new Date().toISOString().replace(/\.\d+Z$/, ".000Z");

    const createdTransfer = await db
      .insert(ownershipTransfers)
      .values({
        itemId: authenticatedItemId,
        currentOwnerEmail: currentOwnership.currentOwnerEmail,
        newOwnerEmail,
        newOwnerName,
        expiresAt,
        createdAt: new Date(timestampISO), // Explicitly set UTC timestamp
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
          mintNumber: item.mintNumber,
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

    const { transferId } = await request.json();

    if (!transferId) {
      return Response.json(
        { error: "Transfer ID is required" },
        { status: 400 }
      );
    }

    // Find pending transfer for this item
    const pendingTransfer = await db.query.ownershipTransfers.findFirst({
      where: and(
        eq(ownershipTransfers.id, transferId),
        eq(ownershipTransfers.itemId, authenticatedItemId)
      ),
    });

    if (!pendingTransfer || pendingTransfer.isConfirmed) {
      return Response.json(
        {
          error: !pendingTransfer
            ? "No pending transfer found"
            : "Cannot cancel a confirmed transfer",
        },
        { status: 400 }
      );
    }

    // Get item details for the email
    const item = await db.query.items.findFirst({
      where: eq(items.id, authenticatedItemId),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Delete the transfer request
    await db
      .delete(ownershipTransfers)
      .where(eq(ownershipTransfers.id, pendingTransfer.id));

    // Notify the new owner that the transfer was cancelled
    await sendEmail({
      to: pendingTransfer.newOwnerEmail,
      type: "transfer-cancelled",
      data: {
        itemDetails: {
          serialNumber: item.serialNumber,
          sku: item.sku,
          mintNumber: item.mintNumber,
        },
      },
    });

    return Response.json({ message: "Transfer cancelled" });
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

      const txHistory = await getItemTransactionHistory(db, transfer.itemId);
      const currentOwnership = getCurrentOwner(txHistory, {
        originalOwnerName: item.originalOwnerName,
        originalOwnerEmail: item.originalOwnerEmail,
        createdAt: item.createdAt,
      });

      // Get any pending transactions that haven't been added to a block yet
      const pendingTransactions = await db.query.transactions.findMany({
        where: and(
          sql`${transactions.blockId} IS NULL`,
          not(eq(transactions.itemId, transfer.itemId)) // Exclude current item's transactions
        ),
        orderBy: [asc(transactions.timestamp)],
        limit: 9, // Limit to 9 to make room for our new transaction (total 10 per block)
      });

      // Get the last block for chain linking
      const lastBlock = await db.query.blocks.findFirst({
        orderBy: [desc(blocks.blockNumber)],
      });

      const nextBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;
      // Generate normalized timestamp once to use consistently
      const timestampISO = new Date().toISOString().replace(/\.\d+Z$/, ".000Z");
      const timestamp = new Date(timestampISO); // For DB

      const transactionData: TransactionData = {
        type: "transfer",
        itemId: item.id,
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
            id: item.id,
            serialNumber: item.serialNumber,
            sku: item.sku,
            mintNumber: item.mintNumber,
            weight: item.weight,
            nfcSerialNumber: item.nfcSerialNumber,
            orderId: item.orderId,
            originalOwnerName: item.originalOwnerName,
            originalOwnerEmail: item.originalOwnerEmail,
            originalPurchaseDate: item.originalPurchaseDate,
            purchasedFrom: item.purchasedFrom,
            manufactureDate: item.manufactureDate,
            producedAt: item.producedAt,
            createdAt: item.createdAt,
            blockchainVersion: item.blockchainVersion,
            globalKeyVersion: item.globalKeyVersion,
            nfcLink: item.nfcLink,
          },
        },
      };

      // Combine pending transactions with our new transaction
      const blockTransactions = [
        ...pendingTransactions.map((tx) => tx.data as TransactionData),
        transactionData,
      ];

      // Create new block using the same timestamp
      const block = new Block(
        nextBlockNumber,
        lastBlock?.hash ?? "0".repeat(64),
        blockTransactions,
        timestampISO
      );

      // Calculate block hash after all data is set
      const blockHash = block.calculateHash();
      const merkleRoot = block.getMerkleTree().getRoot();

      let newBlock: typeof blocks.$inferSelect;
      let newTransaction: typeof transactions.$inferSelect;

      await db.transaction(async (tx) => {
        // Create block record
        [newBlock] = await tx
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

        // Process all transactions in the block
        for (let i = 0; i < blockTransactions.length; i++) {
          const txData = blockTransactions[i];
          const transactionHash = hash(txData);

          if (i < pendingTransactions.length) {
            // Update existing transaction with block info
            await tx
              .update(transactions)
              .set({
                blockId: newBlock.id,
                hash: transactionHash,
              })
              .where(eq(transactions.id, pendingTransactions[i].id));
          } else {
            // Create new transaction for our transfer
            [newTransaction] = await tx
              .insert(transactions)
              .values({
                blockId: newBlock.id,
                transactionType: "transfer",
                itemId: item.id,
                data: transactionData,
                timestamp,
                hash: transactionHash,
              })
              .returning();

            // Update item with latest transaction
            await tx
              .update(items)
              .set({
                latestTransactionId: newTransaction.id,
              })
              .where(eq(items.id, transfer.itemId));
          }
        }

        // Mark transfer as confirmed
        await tx
          .update(ownershipTransfers)
          .set({ isConfirmed: true })
          .where(eq(ownershipTransfers.id, transfer.id));
      });

      // Verify chain integrity after the new block is added
      const verifyResult = await verifyItemChain(db, transfer.itemId);
      if (!verifyResult.isValid) {
        // Rollback in proper order to handle foreign key constraints
        await db.transaction(async (tx) => {
          // First find all transactions that reference this block
          const blockTransactions = await tx
            .select()
            .from(transactions)
            .where(eq(transactions.blockId, newBlock.id));

          // Update items to remove references to these transactions
          for (const transaction of blockTransactions) {
            await tx
              .update(items)
              .set({ latestTransactionId: null })
              .where(eq(items.latestTransactionId, transaction.id));
          }

          // Delete the transactions
          await tx
            .delete(transactions)
            .where(eq(transactions.blockId, newBlock.id));

          // Now we can safely delete the block
          await tx.delete(blocks).where(eq(blocks.id, newBlock.id));

          // Reset transfer confirmation
          await tx
            .update(ownershipTransfers)
            .set({ isConfirmed: false })
            .where(eq(ownershipTransfers.id, transfer.id));
        });

        console.error("Blockchain verification failed:", {
          error: verifyResult.error,
          transferId,
          itemId: transfer.itemId,
        });
        return Response.json({ error: verifyResult.error }, { status: 500 });
      }

      // Invalidate original owner's session
      await deleteSessionByItemId(transfer.itemId);

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
              mintNumber: item.mintNumber,
            },
            viewUrl: `${item.nfcLink}`,
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
              mintNumber: item.mintNumber,
            },
            newOwnerName: transfer.newOwnerName,
            newOwnerEmail: transfer.newOwnerEmail,
          },
        }),
      ]);

      return Response.json({ message: "Transfer confirmed successfully" });
    } else {
      // Get item details for the email notification
      const item = await db.query.items.findFirst({
        where: eq(items.id, transfer.itemId),
      });

      if (!item) {
        return Response.json({ error: "Item not found" }, { status: 404 });
      }

      // Send email to current owner about the rejection
      await sendEmail({
        to: transfer.currentOwnerEmail,
        type: "transfer-declined",
        data: {
          itemDetails: {
            serialNumber: item.serialNumber,
            sku: item.sku,
            mintNumber: item.mintNumber,
          },
          newOwnerEmail: transfer.newOwnerEmail,
          newOwnerName: transfer.newOwnerName,
        },
      });

      // Delete the transfer request when rejected
      await db
        .delete(ownershipTransfers)
        .where(eq(ownershipTransfers.id, transfer.id));

      console.log(
        `Transfer ${transfer.id} rejected and current owner ${transfer.currentOwnerEmail} notified`
      );

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
