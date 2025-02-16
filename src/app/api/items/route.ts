import { db } from "@/db";
import { globalEncryptionKeys, items, skus } from "@/db/schema";
import { env } from "@/env.mjs";
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

      console.log("Debug encryption:", {
        masterKeyLength: masterKey.length,
        encryptedKeyTotal: encryptedKey.length,
        version: recentKey.version,
      });

      try {
        // Try to parse components and log more details
        console.log("Raw components:", {
          ivLength: encryptedKey.subarray(0, 12).length,
          ivBytes: encryptedKey.subarray(0, 12).toString("hex"),
          authTagLength: encryptedKey.subarray(12, 28).length,
          authTagBytes: encryptedKey.subarray(12, 28).toString("hex"),
          encryptedLength: encryptedKey.subarray(28).length,
          encryptedBytes: encryptedKey.subarray(28).toString("hex"),
        });

        // Step 1: Log the full base64 for comparison
        console.log("Base64 key from DB:", recentKey.encryptedKey);
        console.log("Base64 decoded length:", encryptedKey.length);

        // Step 2: Extract components [IV (12 bytes) | Encrypted | Auth Tag (16 bytes)]
        const iv = encryptedKey.subarray(0, 12); // First 12 bytes
        const encrypted = encryptedKey.subarray(12, encryptedKey.length - 16); // Middle portion
        const authTag = encryptedKey.subarray(encryptedKey.length - 16); // Last 16 bytes

        // Step 3: Log the full hex of each component for byte-level comparison
        console.log("Decryption components:", {
          iv: iv.toString("hex"),
          encrypted: encrypted.toString("hex"),
          authTag: authTag.toString("hex"),
        });

        // Step 4: Verify lengths
        console.log("Component validation:", {
          totalLength: encryptedKey.length,
          expectedTotal: 12 + 32 + 16, // IV + Key + AuthTag
          ivLength: iv.length,
          encryptedLength: encrypted.length,
          authTagLength: authTag.length,
          encryptedMatches32: encrypted.length === 32,
        });

        // Decrypt using EncryptionService
        const decrypted = await EncryptionService.decrypt({
          encrypted,
          key: masterKey,
          iv,
          authTag,
          raw: true,
        });
        itemKey = decrypted as Buffer;

        console.log("Debug decryption success:", {
          itemKeyLength: itemKey.length,
        });
      } catch (error) {
        console.error("Debug decryption error:", error);
        throw error;
      }
    }

    // Generate blockchain data
    const blockId = crypto.randomBytes(32).toString("hex");
    const itemKeyHash = crypto
      .createHash("sha256")
      .update(itemKey)
      .digest("hex");

    // Create NFC link
    const nfcLink = await EncryptionService.generateNfcLink(
      blockId,
      itemKey,
      globalKeyVersion
    );

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

    const timestamp = new Date();
    const genesisHash = "0".repeat(64);
    const blockData = {
      blockId,
      serialNumber: parsed.data.serialNumber,
      sku: parsed.data.sku,
      mintNumber,
      weight: parsed.data.weight,
      nfcSerialNumber: parsed.data.nfcSerialNumber,
      orderId: parsed.data.orderId,
      currentOwnerName: parsed.data.originalOwnerName,
      currentOwnerEmail: parsed.data.originalOwnerEmail,
      purchaseDate: parsed.data.purchaseDate,
      purchasedFrom: parsed.data.purchasedFrom,
      manufactureDate: parsed.data.manufactureDate,
      producedAt: parsed.data.producedAt,
      timestamp: timestamp,
      previousBlockHash: genesisHash, // Include genesis hash in the block data
    };

    console.log("Block data:", blockData);
    console.log(
      "Block hash:",
      crypto
        .createHash("sha256")
        .update(JSON.stringify(blockData))
        .digest("hex")
    );

    // Insert item into database
    await db.insert(items).values({
      blockId,
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
      timestamp: timestamp,
      currentBlockHash: crypto
        .createHash("sha256")
        .update(JSON.stringify(blockData))
        .digest("hex"),
      previousBlockHash: "0".repeat(64), // Genesis block
      itemEncryptionKeyHash: itemKeyHash,
      globalKeyVersion,
      nfcLink,
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
