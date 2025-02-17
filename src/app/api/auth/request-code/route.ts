import { db } from "@/db";
import { authCodes, items } from "@/db/schema";
import { generateAuthCode } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

interface TransferData {
  type: "transfer";
  itemId: string;
  timestamp: string;
  to: {
    name: string;
    email: string;
  };
}

const requestCodeSchema = z.object({
  email: z.string().email(),
  serialNumber: z.string().min(1),
  purchaseDate: z.string().min(1),
  key: z.string().optional(),
  version: z.string().optional(),
  itemId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request
    const body = await req.json();
    const { email, serialNumber, purchaseDate, key, version } =
      requestCodeSchema.parse(body);

    console.log("email: ", email);
    console.log("serialNumber: ", serialNumber);
    console.log("purchaseDate: ", purchaseDate);
    console.log("key: ", key);
    console.log("version: ", version);

    // Create base conditions
    const conditions = [
      eq(items.serialNumber, serialNumber),
      eq(items.originalPurchaseDate, new Date(purchaseDate)),
    ];

    if (version) {
      conditions.push(eq(items.globalKeyVersion, version));
    }

    // Check if item exists with all conditions
    const item = await db.query.items.findFirst({
      where: and(...conditions),
      with: {
        latestTransaction: true,
      },
    });

    if (!item) {
      return Response.json(
        { error: "No item found matching these details" },
        { status: 404 }
      );
    }

    // Get current owner from latest transaction or original owner
    const currentEmail = item.latestTransaction?.data
      ? (item.latestTransaction.data as TransferData).to?.email ||
        item.originalOwnerEmail
      : item.originalOwnerEmail;

    // Verify email matches current owner
    if (currentEmail.toLowerCase() !== email.toLowerCase()) {
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
