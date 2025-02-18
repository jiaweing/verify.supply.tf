import { db } from "@/db";
import {
  authCodes,
  globalEncryptionKeys,
  items,
  transactions,
} from "@/db/schema";
import { createSession } from "@/lib/auth";
import { Block, TransactionData } from "@/lib/blockchain";
import { sendEmail } from "@/lib/email";
import { EncryptionService } from "@/lib/encryption";
import crypto from "crypto";

function stableStringify(obj: unknown): string {
  if (typeof obj !== "object" || obj === null) {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map(stableStringify).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj).sort();
  const items = sortedKeys.map((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return `"${key}":${stableStringify(value)}`;
  });
  return "{" + items.join(",") + "}";
}

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
    const masterKeyHex = env.MASTER_KEY!.replace(/[^0-9a-f]/gi, "");
    const masterKey = Buffer.from(masterKeyHex, "hex");

    if (masterKey.length !== 32) {
      throw new Error("MASTER_KEY must be a 32-byte hex string");
    }

    const encryptedKey = Buffer.from(globalKey.encryptedKey, "base64");
    const iv = encryptedKey.subarray(0, 12);
    const authTag = encryptedKey.subarray(encryptedKey.length - 16);
    const encrypted = encryptedKey.subarray(12, encryptedKey.length - 16);

    const itemKey = (await EncryptionService.decrypt({
      encrypted,
      key: masterKey,
      iv,
      authTag,
      raw: true,
    })) as Buffer;

    // Verify NFC link with decrypted key
    const { itemid } = await EncryptionService.verifyNfcLink(
      key,
      version,
      itemKey
    );

    // Get item details
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemid),
      with: {
        latestTransaction: true,
      },
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Get current owner from ownership history or original owner if no transfers
    const latestTransactionData = item.latestTransaction
      ?.data as TransactionData;
    let currentEmail: string;
    if (latestTransactionData.type === "transfer") {
      currentEmail = latestTransactionData.data.to.email;
    } else {
      currentEmail = latestTransactionData.data.item.originalOwnerEmail;
    }

    if (currentEmail !== item.originalOwnerEmail) {
      return {
        isValid: false,
        error: "Current ownership does not match latest transaction",
      };
    }

    return Response.json({
      productId: item.id.toString(),
      email: currentEmail,
      serialNumber: item.serialNumber,
      purchaseDate: item.originalPurchaseDate,
    });
  } catch (err) {
    console.error("Error verifying NFC link:", err);
    return Response.json(
      { error: "Invalid verification key" },
      { status: 400 }
    );
  }
}

// Verify blockchain integrity by checking the chain of blocks
async function verifyBlockchain(productId: string) {
  // Get item with its latest transaction and associated block
  const item = await db.query.items.findFirst({
    where: eq(items.id, productId),
    with: {
      latestTransaction: {
        with: {
          block: true,
        },
      },
    },
  });

  if (!item) {
    return { isValid: false, error: "Item not found" };
  }

  if (!item.latestTransaction) {
    return { isValid: false, error: "No transaction history found" };
  }

  // Get all transactions for this item
  const itemTransactions = await db.query.transactions.findMany({
    where: eq(transactions.itemId, productId),
    with: {
      block: true,
      item: true,
    },
    orderBy: (t, { asc }) => [asc(t.timestamp)],
  });

  if (itemTransactions.length === 0) {
    return { isValid: false, error: "No transactions found" };
  }

  // Verify each block in the chain
  for (let i = 0; i < itemTransactions.length; i++) {
    const transaction = itemTransactions[i];
    const block = transaction.block;

    if (!block) {
      return {
        isValid: false,
        error: `Block not found for transaction ${transaction.id}`,
      };
    }

    // Create Block instance for verification using the Block class
    const blockInstance = new Block(
      Number(block.blockNumber),
      block.previousHash,
      [transaction.data as TransactionData],
      block.timestamp.toISOString(),
      Number(block.nonce)
    );

    const computedBlockHash = blockInstance.calculateHash();

    if (computedBlockHash !== block.hash) {
      return {
        isValid: false,
        error: `Invalid block hash at block ${block.blockNumber}`,
      };
    }

    // Verify transaction hash
    const computedTransactionHash = crypto
      .createHash("sha256")
      .update(stableStringify(transaction.data))
      .digest("hex");

    if (computedTransactionHash !== transaction.hash) {
      return {
        isValid: false,
        error: `Invalid transaction hash at block ${block.blockNumber}`,
      };
    }

    // Verify merkle root (simple implementation since we only have one transaction per block)
    if (computedTransactionHash !== block.merkleRoot) {
      return {
        isValid: false,
        error: `Invalid merkle root at block ${block.blockNumber}`,
      };
    }

    // Verify chain link
    if (i > 0) {
      const previousBlock = itemTransactions[i - 1].block!;
      if (block.previousHash !== previousBlock.hash) {
        return {
          isValid: false,
          error: `Broken chain link at block ${block.blockNumber}`,
        };
      }
    }
  }

  // Verify latest transaction matches item state
  const latestTransaction = itemTransactions[itemTransactions.length - 1];
  const transactionData = latestTransaction.data as TransactionData;
  let currentEmail: string;
  if (transactionData.type === "transfer") {
    currentEmail = transactionData.data.to.email;
  } else {
    currentEmail = transactionData.data.item.originalOwnerEmail;
  }

  if (currentEmail !== item.originalOwnerEmail) {
    return {
      isValid: false,
      error: "Current ownership does not match latest transaction",
    };
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
      where: (items, { eq }) => eq(items.id, productId),
      with: {
        latestTransaction: true,
      },
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Get current owner from latest transaction or original owner
    const latestTransactionData = item.latestTransaction
      ?.data as TransactionData;
    let currentEmail: string;
    if (latestTransactionData.type === "transfer") {
      currentEmail = latestTransactionData.data.to.email;
    } else {
      currentEmail = latestTransactionData.data.item.originalOwnerEmail;
    }

    // Only allow verification by current owner
    if (currentEmail.toLowerCase() !== email.toLowerCase()) {
      return Response.json(
        { error: "Email does not match current owner" },
        { status: 403 }
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
    const { isValid, error } = await verifyBlockchain(productId);
    if (!isValid) {
      return Response.json(
        { error: `Blockchain verification failed: ${error}` },
        { status: 400 }
      );
    }

    // Create session
    const { sessionToken, expiresAt } = await createSession(productId);

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
