import { db } from "@/db";
import { authCodes, items, ownershipTransfers } from "@/db/schema";
import { authCodeSchema, createSession } from "@/lib/auth";
import { and, eq, gt } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Parse and validate request
    const body = await req.json();
    const { email, code, itemId } = authCodeSchema.parse(body);

    // Find valid auth code
    const now = new Date();
    const authCode = await db.query.authCodes.findFirst({
      where: and(
        eq(authCodes.email, email),
        eq(authCodes.code, code),
        gt(authCodes.expiresAt, now)
      ),
    });

    if (!authCode) {
      return Response.json(
        { error: "Invalid or expired code" },
        { status: 401 }
      );
    }

    // Find specific item and its latest ownership transfer
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemId),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Get latest ownership transfer if any
    const latestTransfer = await db.query.ownershipTransfers.findFirst({
      where: eq(ownershipTransfers.itemId, itemId),
      orderBy: (transfers, { desc }) => [desc(transfers.createdAt)],
    });

    // Check if user is the original owner or current owner through transfer
    const isOriginalOwner = item.originalOwnerEmail === email;
    const isCurrentOwner = latestTransfer?.currentOwnerEmail === email;

    if (!isOriginalOwner && !isCurrentOwner) {
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
