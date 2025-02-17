import { db } from "@/db";
import {
  blocks,
  globalEncryptionKeys,
  items,
  skus,
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
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchasedFrom: z.string().min(1, "Vendor name is required"),
  manufactureDate: z.string().min(1, "Manufacture date is required"),
  producedAt: z.string().min(1, "Production location is required"),
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const data = {
      serialNumber: formData.get("serialNumber"),
      sku: formData.get("sku"),
      weight: formData.get("weight"),
      nfcSerialNumber: formData.get("nfcSerialNumber"),
      orderId: formData.get("orderId"),
      originalOwnerName: formData.get("originalOwnerName"),
      originalOwnerEmail: formData.get("originalOwnerEmail"),
      purchaseDate: formData.get("purchaseDate"),
      purchasedFrom: formData.get("purchasedFrom"),
      manufactureDate: formData.get("manufactureDate"),
      producedAt: formData.get("producedAt"),
    };

    // Validate input
    const parsed = itemSchema.safeParse(data);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
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
        throw new Error("MASTER_KEY must be a 32-byte hex string");
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
        throw new Error("MASTER_KEY must be a 32-byte hex string");
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

    // Find or create SKU and get next mint number
    let sku = await db.query.skus.findFirst({
      where: eq(skus.code, parsed.data.sku),
    });

    if (!sku) {
      const [newSku] = await db
        .insert(skus)
        .values({
          code: parsed.data.sku,
          currentMintNumber: 1,
        })
        .returning();
      sku = newSku;
    } else {
      [sku] = await db
        .update(skus)
        .set({
          currentMintNumber: sku.currentMintNumber + 1,
          updatedAt: new Date(),
        })
        .where(eq(skus.code, parsed.data.sku))
        .returning();
    }

    const mintNumber = sku.currentMintNumber.toString().padStart(4, "0");
    const itemId = crypto.randomUUID();

    // Generate timestamp once and use its ISO string consistently
    const timestampISO = new Date().toISOString();
    const timestamp = new Date(timestampISO); // For DB records

    // Create genesis block for the item
    const lastBlock = await db.query.blocks.findFirst({
      orderBy: (blocks, { desc }) => [desc(blocks.blockNumber)],
    });

    const nextBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;

    // Create transaction data for item creation using the same timestamp
    const transactionData: TransactionData = {
      type: "create",
      itemId,
      timestamp: timestampISO,
      data: {
        to: {
          name: parsed.data.originalOwnerName,
          email: parsed.data.originalOwnerEmail,
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

    // Create NFC link
    const nfcLink = await EncryptionService.generateNfcLink(
      itemId,
      itemKey,
      globalKeyVersion
    );

    await db.transaction(async (tx) => {
      // Create new block
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
          transactionType: "create",
          itemId,
          data: transactionData,
          hash: merkleRoot, // Since we only have one transaction per block
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
        currentOwnerName: parsed.data.originalOwnerName,
        currentOwnerEmail: parsed.data.originalOwnerEmail,
        purchaseDate: new Date(parsed.data.purchaseDate),
        purchasedFrom: parsed.data.purchasedFrom,
        manufactureDate: new Date(parsed.data.manufactureDate),
        producedAt: parsed.data.producedAt,
        timestamp,
        creationBlockId: newBlock.id,
        latestTransactionId: newTransaction.id,
        itemEncryptionKeyHash: crypto
          .createHash("sha256")
          .update(itemKey)
          .digest("hex"),
        globalKeyVersion,
        nfcLink,
      });
    });

    return Response.json(
      { success: true, message: "Item created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating item:", error);
    return Response.json(
      { error: "An error occurred while creating the item" },
      { status: 500 }
    );
  }
}
