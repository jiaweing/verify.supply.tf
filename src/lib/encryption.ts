import { env } from "@/env.mjs";
import crypto from "crypto";

export class EncryptionService {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 16;

  static generateKey(): Buffer {
    return crypto.randomBytes(this.KEY_LENGTH);
  }

  static async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        100000,
        this.KEY_LENGTH,
        "sha256",
        (err, derivedKey) => {
          if (err) reject(new Error("Key derivation failed"));
          else resolve(derivedKey);
        }
      );
    });
  }

  static generateIV(): Buffer {
    return crypto.randomBytes(this.IV_LENGTH);
  }

  static async encrypt(
    data: string | Buffer,
    key: Buffer
  ): Promise<{
    encrypted: Buffer;
    iv: Buffer;
    authTag: Buffer;
  }> {
    if (key.length !== this.KEY_LENGTH) {
      throw new Error("Invalid key length");
    }

    const iv = this.generateIV();
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(Buffer.isBuffer(data) ? data : Buffer.from(data)),
      cipher.final(),
    ]);

    return {
      encrypted,
      iv,
      authTag: cipher.getAuthTag(),
    };
  }

  static async decrypt(data: {
    encrypted: Buffer;
    key: Buffer;
    iv: Buffer;
    authTag: Buffer;
    raw?: boolean;
  }): Promise<string | Buffer> {
    if (data.key.length !== this.KEY_LENGTH) {
      throw new Error("Invalid key length");
    }

    if (data.iv.length !== this.IV_LENGTH) {
      throw new Error("Invalid IV length");
    }

    if (data.authTag.length !== this.AUTH_TAG_LENGTH) {
      throw new Error("Invalid auth tag length");
    }

    try {
      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        data.key,
        data.iv,
        {
          authTagLength: this.AUTH_TAG_LENGTH,
        }
      );
      decipher.setAuthTag(data.authTag);

      const decrypted = Buffer.concat([
        decipher.update(data.encrypted),
        decipher.final(),
      ]);

      return data.raw ? decrypted : decrypted.toString("utf8");
    } catch {
      console.error("Decryption debug:", {
        encryptedLength: data.encrypted.length,
        keyLength: data.key.length,
        ivLength: data.iv.length,
        authTagLength: data.authTag.length,
      });
      throw new Error("Decryption failed");
    }
  }

  static async generateNfcLink(
    itemId: string,
    serialNumber: string,
    nfcSerialNumber: string,
    itemKey: Buffer,
    globalKeyVersion: string
  ): Promise<string> {
    const data = JSON.stringify({
      itemId,
      serialNumber,
      nfcSerialNumber,
    });
    const { encrypted, iv, authTag } = await this.encrypt(data, itemKey);

    const linkData = Buffer.concat([encrypted, iv, authTag]).toString(
      "base64url"
    );
    return `${env.NEXT_PUBLIC_APP_URL}/?key=${linkData}&version=${globalKeyVersion}`;
  }

  static async verifyNfcLink(
    key: string,
    version: string,
    itemKey: Buffer
  ): Promise<{
    success: boolean;
    error?: string;
    data?: {
      itemId: string;
      serialNumber: string;
      nfcSerialNumber: string;
    };
  }> {
    try {
      const buffer = Buffer.from(key, "base64url");

      // Extract components from buffer
      const authTag = buffer.subarray(buffer.length - this.AUTH_TAG_LENGTH);
      const iv = buffer.subarray(
        buffer.length - this.AUTH_TAG_LENGTH - this.IV_LENGTH,
        buffer.length - this.AUTH_TAG_LENGTH
      );
      const encrypted = buffer.subarray(
        0,
        buffer.length - this.AUTH_TAG_LENGTH - this.IV_LENGTH
      );

      const decrypted = await this.decrypt({
        encrypted,
        key: itemKey,
        iv,
        authTag,
      });

      const data = JSON.parse(decrypted as string);
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("Error verifying NFC link:", error);
      return {
        success: false,
        error: "Invalid or tampered NFC link",
      };
    }
  }

  static generateAuthCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}
