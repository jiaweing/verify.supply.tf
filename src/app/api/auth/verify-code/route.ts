import { db } from "@/db";
import { authCodes, items } from "@/db/schema";
import { authCodeSchema, createSession } from "@/lib/auth";
import { getCurrentOwner } from "@/lib/blockchain";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request
    const body = await req.json();
    const { email, code, itemId } = authCodeSchema.parse(body);

    // Find auth code
    const now = new Date();
    const authCode = await db.query.authCodes.findFirst({
      where: and(eq(authCodes.email, email), eq(authCodes.code, code)),
    });

    if (!authCode) {
      return Response.json(
        { error: "Invalid verification code" },
        { status: 401 }
      );
    }

    // Explicitly check if code has expired
    if (now > authCode.expiresAt) {
      // Delete expired code so user can request a new one
      await db.delete(authCodes).where(eq(authCodes.id, authCode.id));
      return Response.json(
        {
          error:
            "This verification code has expired. Please request a new one.",
        },
        { status: 401 }
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
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if user is current owner using transactions
    const currentOwner = getCurrentOwner(item.transactions, item);

    if (currentOwner.currentOwnerEmail.toLowerCase() !== email.toLowerCase()) {
      return Response.json(
        { error: "No item found with this email" },
        { status: 404 }
      );
    }

    // Create session
    const { sessionToken, expiresAt } = await createSession(item.id);

    // Delete used auth code
    await db.delete(authCodes).where(eq(authCodes.email, email));

    // Create response with session token cookie
    const response = Response.json({
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      item: {
        id: item.id,
        serialNumber: item.serialNumber,
        mintNumber: item.mintNumber,
        nfcSerialNumber: item.nfcSerialNumber,
      },
    });

    // Set session cookie that expires at the same time as the session
    response.headers.set(
      "Set-Cookie",
      `session_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expiresAt.toUTCString()}`
    );

    return response;
  } catch (error) {
    console.error("Error in /api/auth/verify-code:", error);
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
