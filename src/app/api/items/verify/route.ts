import { db } from "@/db";
import {
  authCodes,
  globalEncryptionKeys,
  items,
  ownershipHistory,
} from "@/db/schema";
import { createSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { EncryptionService } from "@/lib/encryption";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { env } from "process";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const version = searchParams.get("version");

  if (!key || !version) {
    return Response.json({ error: "Missing key or version" }, { status: 400 });
  }

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
        return Response.json(
          { error: "No active encryption keys" },
          { status: 400 }
        );
      }

      return Response.json(
        { error: "Please use the most recent NFC link" },
        { status: 400 }
      );
    }

    if (globalKey.activeTo < new Date()) {
      return Response.json(
        {
          error:
            "Expired key version. Please scan the item again to get a new link.",
        },
        { status: 400 }
      );
    }

    // Decrypt the encryption key
    const masterKey = Buffer.from(env.MASTER_KEY!, "base64");
    const encryptedKey = Buffer.from(globalKey.encryptedKey, "base64");
    const iv = encryptedKey.subarray(0, 12);
    const authTag = encryptedKey.subarray(12, 28);
    const encrypted = encryptedKey.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
    decipher.setAuthTag(authTag);

    const itemKey = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    // Verify and decode the NFC link
    const { itemid } = await EncryptionService.verifyNfcLink(
      key,
      version,
      itemKey
    );

    // Get item details
    const item = await db.query.items.findFirst({
      where: eq(items.blockId, itemid),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    return Response.json({
      productId: item.id.toString(),
      email: item.currentOwnerEmail,
      serialNumber: item.serialNumber,
      purchaseDate: item.purchaseDate,
    });
  } catch (err) {
    console.error("Error verifying NFC link:", err);
    return Response.json(
      { error: "Invalid verification key" },
      { status: 400 }
    );
  }
}

// Verify blockchain integrity by checking the chain of block hashes
async function verifyBlockchain(productId: number) {
  // Get item and its ownership history
  const item = await db.query.items.findFirst({
    where: eq(items.id, productId),
  });

  if (!item) {
    return { isValid: false, error: "Item not found" };
  }

  const history = await db.query.ownershipHistory.findMany({
    where: eq(ownershipHistory.itemId, productId),
    orderBy: (history, { asc }) => [asc(history.transferDate)],
  });

  // Verify genesis block
  if (item.previousBlockHash !== "0".repeat(64)) {
    return {
      isValid: false,
      error: "Invalid genesis block hash",
    };
  }

  // Verify initial block hash
  const initialBlockHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        blockId: item.blockId,
        serialNumber: item.serialNumber,
        sku: item.sku,
        mintNumber: item.mintNumber,
        weight: item.weight,
        nfcSerialNumber: item.nfcSerialNumber,
        orderId: item.orderId,
        originalOwnerName: item.originalOwnerName,
        originalOwnerEmail: item.originalOwnerEmail,
        currentOwnerName: item.originalOwnerName,
        currentOwnerEmail: item.originalOwnerEmail,
        purchaseDate: item.purchaseDate.toISOString(),
        purchasedFrom: item.purchasedFrom,
        manufactureDate: item.manufactureDate.toISOString(),
        producedAt: item.producedAt,
        timestamp: item.timestamp.toISOString(),
      })
    )
    .digest("hex");

  if (item.currentBlockHash !== initialBlockHash) {
    return {
      isValid: false,
      error: "Initial block hash mismatch",
    };
  }

  // For each ownership transfer, verify the chain of block hashes
  for (const transfer of history) {
    // Previous owner's block hash should match current block's previousBlockHash
    if (transfer.transferDate <= item.modifiedAt) {
      const expectedBlockHash = crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            blockId: item.blockId,
            serialNumber: item.serialNumber,
            sku: item.sku,
            mintNumber: item.mintNumber,
            weight: item.weight,
            nfcSerialNumber: item.nfcSerialNumber,
            orderId: item.orderId,
            currentOwnerName: transfer.ownerName,
            currentOwnerEmail: transfer.ownerEmail,
            timestamp: transfer.transferDate.toISOString(),
          })
        )
        .digest("hex");

      if (expectedBlockHash !== item.previousBlockHash) {
        return {
          isValid: false,
          error: "Block hash mismatch in ownership history",
        };
      }
    }
  }

  return { isValid: true };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "request-code") {
    const email = formData.get("email") as string;
    const productId = formData.get("productId") as string;

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    if (!productId) {
      return Response.json({ error: "Item ID is required" }, { status: 400 });
    }

    const item = await db.query.items.findFirst({
      where: (items, { eq }) => eq(items.id, parseInt(productId)),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Only allow verification by current owner
    if (item.currentOwnerEmail.toLowerCase() !== email.toLowerCase()) {
      return Response.json(
        { error: "Email does not match current owner" },
        { status: 403 }
      );
    }

    // Verify blockchain integrity
    const { isValid, error } = await verifyBlockchain(parseInt(productId));
    if (!isValid) {
      return Response.json(
        { error: `Blockchain verification failed: ${error}` },
        { status: 400 }
      );
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

    return Response.json({ success: true });
  }

  if (action === "verify-code") {
    const code = formData.get("code") as string;
    const email = formData.get("email") as string;
    const productId = formData.get("productId") as string;

    if (!code || !email) {
      return Response.json(
        { error: "Code and email are required" },
        { status: 400 }
      );
    }

    if (!productId) {
      return Response.json({ error: "Item ID is required" }, { status: 400 });
    }

    // Verify code
    const authCode = await db.query.authCodes.findFirst({
      where: ({ email: emailCol, code: codeCol }, { eq, and }) =>
        and(eq(emailCol, email), eq(codeCol, code)),
    });

    if (!authCode || authCode.expiresAt < new Date()) {
      return Response.json(
        { error: "Invalid or expired code" },
        { status: 403 }
      );
    }

    // Verify blockchain integrity
    const { isValid, error } = await verifyBlockchain(parseInt(productId));
    if (!isValid) {
      return Response.json(
        { error: `Blockchain verification failed: ${error}` },
        { status: 400 }
      );
    }

    // Create session
    const { sessionToken, expiresAt } = await createSession(
      parseInt(productId)
    );

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("session_token", sessionToken, {
      expires: expiresAt,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    // Clean up auth code
    await db.delete(authCodes).where(eq(authCodes.id, authCode.id));

    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
