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

    // Store encrypted key in database with consistent ordering
    const encryptedKey = Buffer.concat([
      result.iv, // First 12 bytes
      result.encrypted, // Middle portion
      result.authTag, // Last 16 bytes
    ]);

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
