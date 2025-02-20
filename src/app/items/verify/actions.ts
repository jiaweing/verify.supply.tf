"use server";

import { db } from "@/db";
import { authCodes, globalEncryptionKeys } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { getCurrentOwner, verifyItemChain } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { EncryptionService } from "@/lib/encryption";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { env } from "process";

export async function verifyNfcLink(searchParams: {
  key: string;
  version: string;
}) {
  const { key, version } = searchParams;

  try {
    // Get the encryption key
    const globalKey = await db.query.globalEncryptionKeys.findFirst({
      where: eq(globalEncryptionKeys.version, version),
    });

    if (!globalKey) {
      // Get most recent active key instead
      const recentKey = await db.query.globalEncryptionKeys.findFirst({
        orderBy: (keys, { desc }) => [desc(keys.activeFrom)],
      });

      if (!recentKey) {
        throw new Error("No active encryption keys");
      }

      throw new Error("Please use the most recent NFC link");
    }

    if (globalKey.activeTo < new Date()) {
      throw new Error(
        "Expired key version. Please scan the item again to get a new link."
      );
    }

    // Decrypt the encryption key
    const masterKeyHex = env.MASTER_KEY!.replace(/[^0-9a-f]/gi, "");
    const masterKey = Buffer.from(masterKeyHex, "hex");

    if (masterKey.length !== 32) {
      throw new Error("MASTER_KEY must be a 32-byte hex string");
    }

    // First decrypt the item key
    const encryptedItemKey = Buffer.from(globalKey.encryptedKey, "base64");
    const keyIV = encryptedItemKey.subarray(0, 12);
    const keyAuthTag = encryptedItemKey.subarray(encryptedItemKey.length - 16);
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

    // Then verify the NFC link which is already in the correct base64url format
    const verifiedData = await EncryptionService.verifyNfcLink(
      key,
      version,
      itemKey
    );

    // Get item details and verify all fields match
    const item = await db.query.items.findFirst({
      where: (items, { and, eq }) =>
        and(
          eq(items.id, verifiedData.itemId),
          eq(items.serialNumber, verifiedData.serialNumber),
          eq(items.nfcSerialNumber, verifiedData.nfcSerialNumber)
        ),
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
      throw new Error("Item not found");
    }

    // Get current owner info including latest transfer date
    const currentOwner = getCurrentOwner(item.transactions, item);

    return {
      productId: item.id.toString(),
      email: currentOwner.currentOwnerEmail,
      serialNumber: item.serialNumber,
      purchaseDate: currentOwner.lastTransferDate,
    };
  } catch (err) {
    console.error("Error verifying NFC link:", err);
    throw new Error("Invalid verification key");
  }
}

export async function requestVerificationCode(formData: FormData) {
  const email = formData.get("email")?.toString();
  const itemId = formData.get("itemId")?.toString();

  if (!email) {
    throw new Error("Email is required");
  }

  if (!itemId) {
    throw new Error("Item ID is required");
  }

  const item = await db.query.items.findFirst({
    where: (items, { eq }) => eq(items.id, itemId),
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
    throw new Error("Item not found");
  }

  // Get current owner info
  const currentOwner = getCurrentOwner(item.transactions, item);

  // Only allow verification by current owner
  if (currentOwner.currentOwnerEmail.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Email does not match current owner");
  }

  // Generate and store auth code
  const code = await EncryptionService.generateAuthCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

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
}

export async function verifyCode(formData: FormData) {
  const code = formData.get("code")?.toString();
  const email = formData.get("email")?.toString();
  const productId = formData.get("productId")?.toString();

  if (!code || !email) {
    throw new Error("Code and email are required");
  }

  if (!productId) {
    throw new Error("Item ID is required");
  }

  // Verify code
  const authCode = await db.query.authCodes.findFirst({
    where: (
      { email: emailCol, code: codeCol, isUsed: isUsedCol },
      { eq, and }
    ) => and(eq(emailCol, email), eq(codeCol, code), eq(isUsedCol, false)),
  });

  if (!authCode) {
    throw new Error("Invalid code");
  }

  if (authCode.expiresAt < new Date()) {
    throw new Error("Code has expired");
  }

  // Mark the code as used before proceeding
  await db
    .update(authCodes)
    .set({ isUsed: true })
    .where(eq(authCodes.id, authCode.id));

  // Use the robust blockchain verification that checks the entire chain
  const { isValid, error } = await verifyItemChain(db, productId);
  if (!isValid) {
    throw new Error(`Blockchain verification failed: ${error}`);
  }

  // Create session
  const { sessionToken, expiresAt } = await createSession(productId);

  // Set session cookie - need to await the cookies() promise
  const cookieStore = await cookies();
  cookieStore.set("session_token", sessionToken, {
    expires: expiresAt,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return { success: true };
}
