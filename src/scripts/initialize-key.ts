import { db } from "@/db";
import { globalEncryptionKeys } from "@/db/schema";
import { EncryptionService } from "@/lib/encryption";
import crypto from "crypto";
import { env } from "../env.mjs";

export async function initializeKey() {
  try {
    // Check if we have any existing keys
    const existingKey = await db.query.globalEncryptionKeys.findFirst({
      orderBy: (keys, { desc }) => [desc(keys.activeFrom)],
    });

    if (existingKey) {
      console.log("Encryption key already exists, skipping initialization");
      return;
    }

    // Generate initial key
    const version = crypto.randomBytes(3).toString("hex");
    const itemKey = crypto.randomBytes(32);
    // Convert hex string to Buffer
    const masterKeyHex = env.MASTER_KEY!.replace(/[^0-9a-f]/gi, "");
    const masterKey = Buffer.from(masterKeyHex, "hex");

    if (masterKey.length !== 32) {
      throw new Error("MASTER_KEY must be a 32-byte hex string");
    }

    // Encrypt item key using encryption service
    const result = await EncryptionService.encrypt(itemKey, masterKey);

    const now = new Date();
    const monthFromNow = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );

    // Log initial components and their first few bytes
    console.log("Initialize components:", {
      ivLength: result.iv.length,
      ivBytes: result.iv.toString("hex"),
      authTagLength: result.authTag.length,
      authTagBytes: result.authTag.toString("hex"),
      encryptedLength: result.encrypted.length,
      encryptedBytes: result.encrypted.toString("hex"),
    });

    // Show raw byte lengths
    console.log("Raw component lengths:", {
      ivLength: result.iv.length,
      encryptedLength: result.encrypted.length,
      authTagLength: result.authTag.length,
      expectedTotal:
        result.iv.length + result.encrypted.length + result.authTag.length,
    });

    // Store encrypted key in database with consistent ordering
    const encryptedKey = Buffer.concat([
      result.iv, // First 12 bytes
      result.encrypted, // Middle portion
      result.authTag, // Last 16 bytes
    ]);

    // Compare all bytes pre vs post concat
    console.log("Byte matching check:", {
      originalIV: result.iv.toString("hex"),
      concatIV: encryptedKey.subarray(0, 12).toString("hex"),
      originalEncrypted: result.encrypted.toString("hex"),
      concatEncrypted: encryptedKey
        .subarray(12, 12 + result.encrypted.length)
        .toString("hex"),
      originalAuthTag: result.authTag.toString("hex"),
      concatAuthTag: encryptedKey
        .subarray(encryptedKey.length - 16)
        .toString("hex"),
    });

    await db.insert(globalEncryptionKeys).values({
      version,
      encryptedKey: encryptedKey.toString("base64"),
      activeFrom: now,
      activeTo: monthFromNow,
    });

    console.log("Initial encryption key created with version:", version);
  } catch (error) {
    console.error("Error initializing encryption key:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeKey()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
