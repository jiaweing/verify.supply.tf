"use server";

import { db } from "@/db";
import { blocks, items, ownershipTransfers, transactions } from "@/db/schema";
import { deleteSessionByItemId, validateSession } from "@/lib/auth";
import {
  Block,
  TransactionData,
  getCurrentOwner,
  hash,
  verifyItemChain,
} from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { and, asc, desc, eq, not, sql } from "drizzle-orm";
import { cookies } from "next/headers";

export async function processTransferAction(
  itemId: string,
  transferId: string,
  action: "confirm" | "reject"
) {
  const transfer = await db.query.ownershipTransfers.findFirst({
    where: eq(ownershipTransfers.id, transferId),
  });

  if (!transfer) {
    throw new Error("Transfer request not found");
  }

  if (transfer.itemId !== itemId) {
    throw new Error("Transfer request does not match item");
  }

  if (transfer.isConfirmed) {
    throw new Error("Transfer has already been processed");
  }

  if (new Date() > transfer.expiresAt) {
    throw new Error("Transfer request has expired");
  }

  // Get item details
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
    throw new Error("Item not found");
  }

  // Verify blockchain integrity before proceeding with any action
  const verifyResult = await verifyItemChain(db, itemId);
  if (!verifyResult.isValid) {
    throw new Error("Current item data does not match blockchain record");
  }

  if (action === "confirm") {
    // Get current owner from transaction history
    const txHistory = await db.query.transactions.findMany({
      where: eq(transactions.itemId, transfer.itemId),
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

    // Get any pending transactions that haven't been added to a block yet
    const pendingTransactions = await db.query.transactions.findMany({
      where: and(
        sql`${transactions.blockId} IS NULL`,
        not(eq(transactions.itemId, transfer.itemId))
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

          // Update item with latest transaction only
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
      throw new Error(verifyResult.error);
    }

    // Invalidate original owner's session
    await deleteSessionByItemId(transfer.itemId);

    // Send confirmation emails
    const viewUrl = `${item.nfcLink}`;

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
          viewUrl,
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

    // Delete the transfer record
    await db
      .delete(ownershipTransfers)
      .where(eq(ownershipTransfers.id, transferId));
  } else {
    // Handle rejection case
    await Promise.all([
      // Send rejection email
      sendEmail({
        to: transfer.newOwnerEmail,
        type: "transfer-declined",
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
      // Delete the transfer record
      db
        .delete(ownershipTransfers)
        .where(eq(ownershipTransfers.id, transferId)),
    ]);
  }
}

export async function transferItem(formData: FormData) {
  const itemId = formData.get("itemId") as string;
  const newOwnerName = formData.get("newOwnerName") as string;
  const newOwnerEmail = formData.get("newOwnerEmail") as string;

  if (!itemId || !newOwnerName || !newOwnerEmail) {
    throw new Error("Missing required fields");
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const authenticatedItemId = await validateSession(sessionToken);
  if (!authenticatedItemId || authenticatedItemId !== itemId) {
    throw new Error("Unauthorized to transfer this item");
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
    throw new Error("Item not found");
  }

  // Verify blockchain integrity before proceeding
  const verifyResult = await verifyItemChain(db, itemId);
  if (!verifyResult.isValid) {
    throw new Error("Current item data does not match blockchain record");
  }

  // Prevent transferring to self
  if (newOwnerEmail === item.originalOwnerEmail) {
    throw new Error("You cannot transfer the item to yourself.");
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create transfer record
  const [transfer] = await db
    .insert(ownershipTransfers)
    .values({
      itemId,
      currentOwnerEmail: item.originalOwnerEmail,
      newOwnerName,
      newOwnerEmail,
      expiresAt,
      isConfirmed: false,
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
        mintNumber: item.mintNumber,
      },
      confirmUrl,
    },
  });

  return transfer;
}

export async function cancelTransfer(formData: FormData) {
  const itemId = formData.get("itemId") as string;
  const transferId = formData.get("transferId") as string;

  if (!itemId || !transferId) {
    throw new Error("Missing required fields");
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    throw new Error("Authentication required");
  }

  const authenticatedItemId = await validateSession(sessionToken);
  if (!authenticatedItemId || authenticatedItemId !== itemId) {
    throw new Error("Unauthorized to cancel this transfer");
  }

  // Get item details for the email
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    throw new Error("Item not found");
  }

  const transfer = await db.query.ownershipTransfers.findFirst({
    where: eq(ownershipTransfers.id, transferId),
  });

  if (!transfer) {
    throw new Error("Transfer not found");
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
        mintNumber: item.mintNumber,
      },
    },
  });
}
