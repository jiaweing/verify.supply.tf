"use server";

import { db } from "@/db";
import { authCodes, globalEncryptionKeys, items, sessions } from "@/db/schema";
import {
  authCodeSchema,
  createSession,
  deleteSession,
  generateAuthCode,
} from "@/lib/auth";
import { getCurrentOwner } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { EncryptionService } from "@/lib/encryption";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

const requestCodeSchema = z.object({
  email: z.string().email(),
  serialNumber: z.string().min(1),
  key: z.string().optional(),
  version: z.string().optional(),
  itemId: z.string().optional(),
  turnstileToken: z.string(),
});

export async function requestAuthCodeAction(formData: FormData) {
  try {
    const data = {
      email: formData.get("email")?.toString(),
      serialNumber: formData.get("serialNumber")?.toString(),
      key: formData.get("key")?.toString(),
      version: formData.get("version")?.toString(),
      turnstileToken: formData.get("turnstileToken")?.toString(),
    };

    const parsed = requestCodeSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("Invalid input data");
    }

    const { email, serialNumber, key, version, turnstileToken } = parsed.data;

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
      throw new Error("Invalid CAPTCHA verification");
    }

    // If key and version provided, verify NFC link first
    let itemId: string | undefined = undefined;
    if (key && version) {
      // Get the encryption key
      const globalKey = await db.query.globalEncryptionKeys.findFirst({
        where: eq(globalEncryptionKeys.version, version),
      });

      if (!globalKey) {
        throw new Error("Please use the most recent NFC link");
      }

      if (globalKey.activeTo < new Date()) {
        throw new Error("Expired key version. Please scan again.");
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
        throw new Error("Invalid verification key");
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
      throw new Error("No item found matching these details");
    }

    // Get current owner info including latest transfer date
    const currentOwner = getCurrentOwner(item.transactions, item);

    // Check email matches current owner
    if (currentOwner.currentOwnerEmail.toLowerCase() !== email.toLowerCase()) {
      throw new Error("Email does not match current owner");
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

    return { success: true };
  } catch (error) {
    console.error("Error in requestAuthCodeAction:", error);
    throw error;
  }
}

export async function getSessionAction() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return { session: null };
    }

    // Get session data from database
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.sessionToken, sessionToken),
      with: {
        item: {
          with: {
            latestTransaction: true,
            transactions: {
              with: {
                block: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return { session: null };
    }

    return {
      session: {
        itemId: session.itemId,
        expiresAt: session.expiresAt,
        item: session.item,
      },
    };
  } catch (error) {
    console.error("Error in getSessionAction:", error);
    throw error;
  }
}

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      throw new Error("No session token found");
    }

    await deleteSession(sessionToken);
    cookieStore.delete("session_token");
    return { success: true };
  } catch (error) {
    console.error("Error in logoutAction:", error);
    throw error;
  }
}

export async function verifyAuthCodeAction(formData: FormData) {
  try {
    const data = {
      email: formData.get("email")?.toString(),
      code: formData.get("code")?.toString(),
      itemId: formData.get("itemId")?.toString(),
    };

    const parsed = authCodeSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("Invalid input data");
    }

    const { email, code, itemId } = parsed.data;

    // Find auth code
    const now = new Date();
    const authCode = await db.query.authCodes.findFirst({
      where: and(eq(authCodes.email, email), eq(authCodes.code, code)),
    });

    if (!authCode) {
      throw new Error("Invalid verification code");
    }

    // Explicitly check if code has expired
    if (now > authCode.expiresAt) {
      // Delete expired code so user can request a new one
      await db.delete(authCodes).where(eq(authCodes.id, authCode.id));
      throw new Error(
        "This verification code has expired. Please request a new one."
      );
    }

    // Find item with its transactions for ownership check
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemId),
      with: {
        transactions: {
          with: {
            block: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error("Item not found");
    }

    // Check if user is current owner using transactions
    const currentOwner = getCurrentOwner(item.transactions, item);

    if (currentOwner.currentOwnerEmail.toLowerCase() !== email.toLowerCase()) {
      throw new Error("No item found with this email");
    }

    // Create session
    const { sessionToken, expiresAt } = await createSession(item.id);

    // Delete used auth code
    await db.delete(authCodes).where(eq(authCodes.email, email));

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session_token", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      expires: expiresAt,
    });

    return {
      success: true,
      item: {
        id: item.id,
        serialNumber: item.serialNumber,
        mintNumber: item.mintNumber,
        nfcSerialNumber: item.nfcSerialNumber,
      },
    };
  } catch (error) {
    console.error("Error in verifyAuthCodeAction:", error);
    throw error;
  }
}
