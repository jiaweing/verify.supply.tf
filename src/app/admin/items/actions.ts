"use server";

import { db } from "@/db";
import {
  blocks,
  globalEncryptionKeys,
  items,
  series,
  shortUrls,
  transactions,
} from "@/db/schema";
import { env } from "@/env.mjs";
import { Block, TransactionData } from "@/lib/blockchain";
import { EncryptionService } from "@/lib/encryption";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

const itemSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  sku: z.string().min(1, "SKU is required"),
  weight: z.string().min(1, "Weight is required"),
  nfcSerialNumber: z.string().min(1, "NFC serial number is required"),
  orderId: z.string().min(1, "Order ID is required"),
  originalOwnerName: z.string().min(1, "Original owner name is required"),
  originalOwnerEmail: z.string().email("Invalid email address"),
  purchaseDate: z.string().min(1, "Original purchase date is required"),
  purchasedFrom: z.string().min(1, "Vendor name is required"),
  manufactureDate: z.string().min(1, "Manufacture date is required"),
  producedAt: z.string().min(1, "Production location is required"),
  seriesId: z.string().min(1, "Series ID is required"),
});

export async function createItemAction(formData: FormData) {
  try {
    const data = {
      serialNumber: formData.get("serialNumber"),
      sku: formData.get("sku"),
      weight: formData.get("weight"),
      nfcSerialNumber: formData.get("nfcSerialNumber"),
      orderId: formData.get("orderId"),
      originalOwnerName: formData.get("originalOwnerName"),
      originalOwnerEmail: formData.get("originalOwnerEmail"),
      purchaseDate: formData.get("PurchaseDate"),
      purchasedFrom: formData.get("purchasedFrom"),
      manufactureDate: formData.get("manufactureDate"),
      producedAt: formData.get("producedAt"),
      seriesId: formData.get("seriesId"),
    };

    // Validate input
    const parsed = itemSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed: " + JSON.stringify(parsed.error.issues),
      };
    }

    // Get or create current encryption key
    const recentKey = await db.query.globalEncryptionKeys.findFirst({
      orderBy: (keys, { desc }) => [desc(keys.activeFrom)],
    });

    let globalKeyVersion: string;
    let itemKey: Buffer;

    const now = new Date();
    const monthFromNow = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );

    if (!recentKey || recentKey.activeTo < now) {
      // Generate new key
      globalKeyVersion = crypto.randomBytes(3).toString("hex");
      itemKey = EncryptionService.generateKey();
      const masterKeyHex = env.MASTER_KEY!.replace(/[^0-9a-f]/gi, "");
      const masterKey = Buffer.from(masterKeyHex, "hex");

      if (masterKey.length !== 32) {
        return {
          success: false,
          error: "MASTER_KEY must be a 32-byte hex string",
        };
      }

      // Encrypt item key directly using EncryptionService
      const result = await EncryptionService.encrypt(itemKey, masterKey);

      // Store encrypted key in database
      await db.insert(globalEncryptionKeys).values({
        version: globalKeyVersion,
        encryptedKey: Buffer.concat([
          result.iv,
          result.encrypted,
          result.authTag,
        ]).toString("base64"),
        activeFrom: now,
        activeTo: monthFromNow,
      });
    } else {
      globalKeyVersion = recentKey.version;

      // Decrypt the existing key
      const masterKeyHex = env.MASTER_KEY!.replace(/[^0-9a-f]/gi, "");
      const masterKey = Buffer.from(masterKeyHex, "hex");

      if (masterKey.length !== 32) {
        return {
          success: false,
          error: "MASTER_KEY must be a 32-byte hex string",
        };
      }

      const encryptedKey = Buffer.from(recentKey.encryptedKey, "base64");
      const iv = encryptedKey.subarray(0, 12);
      const authTag = encryptedKey.subarray(encryptedKey.length - 16);
      const encrypted = encryptedKey.subarray(12, encryptedKey.length - 16);

      itemKey = (await EncryptionService.decrypt({
        encrypted,
        key: masterKey,
        iv,
        authTag,
        raw: true,
      })) as Buffer;
    }

    // Find the series
    const seriesRecord = await db.query.series.findFirst({
      where: eq(series.id, Number(parsed.data.seriesId)),
    });

    if (!seriesRecord) {
      return { success: false, error: "Series not found" };
    }

    // Check if we've reached the series limit
    if (seriesRecord.currentMintNumber >= seriesRecord.totalPieces) {
      return { success: false, error: "Series limit reached" };
    }

    // Update series mint number
    const [updatedSeries] = await db
      .update(series)
      .set({
        currentMintNumber: seriesRecord.currentMintNumber + 1,
        updatedAt: new Date(),
      })
      .where(eq(series.id, seriesRecord.id))
      .returning();

    const mintNumber = updatedSeries.currentMintNumber
      .toString()
      .padStart(4, "0");
    const itemId = crypto.randomUUID();

    // Generate normalized timestamp once to use consistently
    const timestampISO = now.toISOString().replace(/\.\d+/, ".000");
    const timestamp = new Date(timestampISO); // For DB records

    // Create genesis block for the item
    const lastBlock = await db.query.blocks.findFirst({
      orderBy: (blocks, { desc }) => [desc(blocks.blockNumber)],
    });

    const nextBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;

    // Create NFC link
    const nfcLink = await EncryptionService.generateNfcLink(
      itemId,
      parsed.data.serialNumber,
      parsed.data.nfcSerialNumber,
      itemKey,
      globalKeyVersion
    );

    // Create transaction data for item creation using the same timestamp
    // Generate nonce for transaction data
    const transactionNonce = crypto.randomBytes(32).toString("hex");

    const transactionData: TransactionData = {
      type: "create",
      itemId,
      timestamp: timestampISO,
      nonce: transactionNonce,
      data: {
        to: {
          name: parsed.data.originalOwnerName,
          email: parsed.data.originalOwnerEmail,
        },
        item: {
          id: itemId,
          serialNumber: parsed.data.serialNumber,
          sku: parsed.data.sku,
          mintNumber: mintNumber,
          weight: parsed.data.weight,
          nfcSerialNumber: parsed.data.nfcSerialNumber,
          orderId: parsed.data.orderId,
          originalOwnerName: parsed.data.originalOwnerName,
          originalOwnerEmail: parsed.data.originalOwnerEmail,
          originalPurchaseDate: new Date(parsed.data.purchaseDate),
          purchasedFrom: parsed.data.purchasedFrom,
          manufactureDate: new Date(parsed.data.manufactureDate),
          producedAt: parsed.data.producedAt,
          createdAt: timestamp,
          blockchainVersion: env.BLOCKCHAIN_VERSION,
          globalKeyVersion: globalKeyVersion,
          nfcLink: nfcLink,
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
      // Create new block
      const [newBlock] = await tx
        .insert(blocks)
        .values({
          blockNumber: nextBlockNumber,
          timestamp,
          previousHash: lastBlock?.hash ?? "0".repeat(64),
          merkleRoot,
          blockNonce: 0,
          hash: blockHash,
        })
        .returning();

      // Create transaction record
      const [newTransaction] = await tx
        .insert(transactions)
        .values({
          blockId: newBlock.id,
          transactionType: "create",
          itemId,
          data: transactionData,
          timestamp, // Required by schema
          hash: merkleRoot, // Since we only have one transaction per block
          transactionNonce, // Use the same nonce from transaction data
        })
        .returning();

      // Create item
      await tx.insert(items).values({
        id: itemId,
        serialNumber: parsed.data.serialNumber,
        sku: parsed.data.sku,
        mintNumber,
        weight: parsed.data.weight,
        nfcSerialNumber: parsed.data.nfcSerialNumber,
        orderId: parsed.data.orderId,
        originalOwnerName: parsed.data.originalOwnerName,
        originalOwnerEmail: parsed.data.originalOwnerEmail,
        originalPurchaseDate: new Date(parsed.data.purchaseDate),
        purchasedFrom: parsed.data.purchasedFrom,
        manufactureDate: new Date(parsed.data.manufactureDate),
        producedAt: parsed.data.producedAt,
        creationBlockId: newBlock.id,
        latestTransactionId: newTransaction.id,
        blockchainVersion: env.BLOCKCHAIN_VERSION,
        globalKeyVersion,
        nfcLink,
        createdAt: timestamp, // Use normalized timestamp
      });

      // Create short URL
      await tx.insert(shortUrls).values({
        originalUrl: nfcLink,
        itemId,
      });
    });

    // Get the generated short URL
    const shortUrl = await db.query.shortUrls.findFirst({
      where: eq(shortUrls.itemId, itemId),
    });

    return {
      success: true,
      message: "Item created successfully",
      data: {
        itemId,
        nfcLink,
        shortUrl: shortUrl
          ? `${env.NEXT_PUBLIC_APP_URL}/${shortUrl.shortPath}`
          : undefined,
      },
    };
  } catch (error) {
    console.error("Error creating item:", error);
    return {
      success: false,
      error: "An error occurred while creating the item. Please try again.",
    };
  }
}
