import { db } from "@/db";
import { authCodes, items } from "@/db/schema";
import { generateAuthCode } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

const requestCodeSchema = z.object({
  email: z.string().email(),
  serialNumber: z.string().min(1),
  purchaseDate: z.string().min(1),
  key: z.string().optional(),
  version: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request
    const body = await req.json();
    const { email, serialNumber, purchaseDate, key, version } =
      requestCodeSchema.parse(body);

    // Create base conditions
    const conditions = [
      eq(items.currentOwnerEmail, email),
      eq(items.serialNumber, serialNumber),
      eq(items.purchaseDate, new Date(purchaseDate)),
    ];

    // Add optional key and version conditions if provided
    if (key && version) {
      conditions.push(
        eq(items.itemEncryptionKeyHash, key),
        eq(items.globalKeyVersion, version)
      );
    }

    // Check if item exists with all conditions
    const item = await db.query.items.findFirst({
      where: and(...conditions),
    });

    if (!item) {
      return Response.json(
        { error: "No item found matching these details" },
        { status: 404 }
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

    // TODO: Send email with code
    console.log(`Auth code for ${email}: ${code}`);

    return Response.json({ message: "Auth code sent" });
  } catch (error) {
    console.error("Error in /api/auth/request-code:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
