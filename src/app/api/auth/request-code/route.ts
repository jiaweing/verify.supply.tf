import { db } from "@/db";
import { authCodes, globalEncryptionKeys, items } from "@/db/schema";
import { generateAuthCode } from "@/lib/auth";
import { getCurrentOwner } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { EncryptionService } from "@/lib/encryption";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

const requestCodeSchema = z.object({
  email: z.string().email(),
  serialNumber: z.string().min(1),
  key: z.string().optional(),
  version: z.string().optional(),
  itemId: z.string().optional(),
  turnstileToken: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { email, serialNumber, key, version, turnstileToken } =
      requestCodeSchema.parse(body);

    // Validate Turnstile token
    const turnstileResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
        }),
      }
    );

    const turnstileData = await turnstileResponse.json();
    if (!turnstileData.success) {
      return Response.json(
        { error: "Invalid CAPTCHA verification" },
        { status: 400 }
      );
    }

    // If key and version provided, verify NFC link first
    let itemId: string | undefined = undefined;
    if (key && version) {
      // Get the encryption key
      const globalKey = await db.query.globalEncryptionKeys.findFirst({
        where: eq(globalEncryptionKeys.version, version),
      });

      if (!globalKey) {
        return Response.json(
          { error: "Please use the most recent NFC link" },
          { status: 400 }
        );
      }

      if (globalKey.activeTo < new Date()) {
        return Response.json(
          { error: "Expired key version. Please scan again." },
          { status: 400 }
        );
      }

      // Decrypt the encryption key
      const masterKeyHex = process.env.MASTER_KEY!.replace(/[^0-9a-f]/gi, "");
      const masterKey = Buffer.from(masterKeyHex, "hex");

      if (masterKey.length !== 32) {
        throw new Error("MASTER_KEY must be a 32-byte hex string");
      }

      try {
        // First decrypt the item key
        const encryptedItemKey = Buffer.from(globalKey.encryptedKey, "base64");
        const keyIV = encryptedItemKey.subarray(0, 12);
        const keyAuthTag = encryptedItemKey.subarray(
          encryptedItemKey.length - 16
        );
        const keyEncrypted = encryptedItemKey.subarray(
          12,
          encryptedItemKey.length - 16
        );

        // Get the item key using master key
        const itemKey = (await EncryptionService.decrypt({
          encrypted: keyEncrypted,
          key: masterKey,
          iv: keyIV,
          authTag: keyAuthTag,
          raw: true,
        })) as Buffer;

        // Then verify the NFC link which is already in correct format for verifyNfcLink
        const verifiedData = await EncryptionService.verifyNfcLink(
          key,
          version,
          itemKey
        );
        itemId = verifiedData.itemId;
      } catch {
        return Response.json(
          { error: "Invalid verification key" },
          { status: 400 }
        );
      }
    }

    // Create base conditions for item query
    const conditions = [eq(items.serialNumber, serialNumber)];

    if (version) {
      conditions.push(eq(items.globalKeyVersion, version));
    }

    if (itemId) {
      conditions.push(eq(items.id, itemId));
    }

    // Check if item exists with all conditions
    const item = await db.query.items.findFirst({
      where: and(...conditions),
      with: {
        latestTransaction: true,
        transactions: {
          with: {
            block: true,
          },
        },
      },
    });

    if (!item) {
      return Response.json(
        { error: "No item found matching these details" },
        { status: 404 }
      );
    }

    // Get current owner info including latest transfer date
    const currentOwner = getCurrentOwner(item.transactions, item);

    // Check email matches current owner
    if (currentOwner.currentOwnerEmail.toLowerCase() !== email.toLowerCase()) {
      return Response.json(
        { error: "Email does not match current owner" },
        { status: 403 }
      );
    }

    // Generate and save auth code
    const code = await generateAuthCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Delete any existing auth codes for this email
    await db.delete(authCodes).where(eq(authCodes.email, email));

    // Save new auth code
    await db.insert(authCodes).values({
      email,
      code,
      expiresAt,
    });

    // Send verification email
    await sendEmail({
      to: email,
      type: "verify",
      data: { code },
    });

    return Response.json({ message: "Auth code sent" });
  } catch (error) {
    console.error("Error in /api/auth/request-code:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
