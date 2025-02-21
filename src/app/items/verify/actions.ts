"use server";

import { db } from "@/db";
import { authCodes, globalEncryptionKeys } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { getCurrentOwner, verifyItemChain } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { EncryptionService } from "@/lib/encryption";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { env } from "process";

export async function verifyNfcLink(searchParams: {
  key: string;
  version: string;
}): Promise<{
  success: boolean;
  error?: string;
  data?: {
    email: string;
    productId: string;
    serialNumber: string;
    purchaseDate: Date;
  };
}> {
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
        return { success: false, error: "No active encryption keys" };
      }

      return { success: false, error: "Please use the most recent NFC link" };
    }

    if (globalKey.activeTo < new Date()) {
      return {
        success: false,
        error:
          "Expired key version. Please scan the item again to get a new link.",
      };
    }

    // Decrypt the encryption key
    const masterKeyHex = env.MASTER_KEY!.replace(/[^0-9a-f]/gi, "");
    const masterKey = Buffer.from(masterKeyHex, "hex");

    if (masterKey.length !== 32) {
      return {
        success: false,
        error: "MASTER_KEY must be a 32-byte hex string",
      };
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
    const verifiedResult = await EncryptionService.verifyNfcLink(
      key,
      version,
      itemKey
    );

    if (!verifiedResult.success) {
      return { success: false, error: "Invalid verification key" };
    }

    // Get item details and verify all fields match
    const item = await db.query.items.findFirst({
      where: (items, { and, eq }) =>
        and(
          eq(items.id, verifiedResult.data?.itemId ?? ''),
          eq(items.serialNumber, verifiedResult.data?.serialNumber ?? ''),
          eq(items.nfcSerialNumber, verifiedResult.data?.nfcSerialNumber ?? '')
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
      return { success: false, error: "Item not found" };
    }
    const currentOwner = getCurrentOwner(item.transactions, item);
    return {
      success: true,
      data: {
        productId: item.id.toString(),
        email: currentOwner.currentOwnerEmail,
        serialNumber: item.serialNumber,
        purchaseDate: currentOwner.lastTransferDate,
      },
    };
  } catch (err) {
    console.error("Error verifying NFC link:", err);
    return { success: false, error: "Invalid verification key" };
  }
}

export async function requestVerificationCode(formData: FormData) {
  const email = formData.get("email")?.toString();
  const serialNumber = formData.get("serialNumber")?.toString();

  if (!email) {
    return { success: false, error: "Email is required" };
  }

  if (!serialNumber) {
    return { success: false, error: "Serial number is required" };
  }

  const item = await db.query.items.findFirst({
    where: (items, { eq }) => eq(items.serialNumber, serialNumber),
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
    return { success: false, error: "Item not found" };
  }

  // Get current owner info
  const currentOwner = getCurrentOwner(item.transactions, item);

  // Only allow verification by current owner
  if (currentOwner.currentOwnerEmail.toLowerCase() !== email.toLowerCase()) {
    return { success: false, error: "Email does not match current owner" };
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

  return {
    success: true,
    data: {
      itemId: item.id,
    },
  };
}

export async function verifyCode(formData: FormData) {
  const code = formData.get("code")?.toString();
  const email = formData.get("email")?.toString();
  const productId = formData.get("productId")?.toString();

  if (!code || !email) {
    return { success: false, error: "Code and email are required" };
  }

  if (!productId) {
    return { success: false, error: "Item ID is required" };
  }

  // Atomically update and return the auth code
  const [authCode] = await db
    .update(authCodes)
    .set({ isUsed: true })
    .where(
      and(
        eq(authCodes.email, email),
        eq(authCodes.code, code),
        eq(authCodes.isUsed, false)
      )
    )
    .returning();

  if (!authCode) {
    return { success: false, error: "Invalid code" };
  }

  if (authCode.expiresAt < new Date()) {
    return { success: false, error: "Code has expired" };
  }

  // Use the robust blockchain verification that checks the entire chain
  const { isValid, error } = await verifyItemChain(db, productId);
  if (!isValid) {
    return {
      success: false,
      error: `Blockchain verification failed: ${error}`,
    };
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
