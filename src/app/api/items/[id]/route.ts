import { db } from "@/db";
import { items } from "@/db/schema";
import { validateSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Validate authentication
    const sessionToken = req.headers.get("authorization")?.split(" ")[1];
    if (!sessionToken) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const authenticatedItemId = await validateSession(sessionToken);
    if (!authenticatedItemId) {
      return Response.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // Verify item access
    const itemid = parseInt(params.id);
    if (authenticatedItemId !== itemid) {
      return Response.json(
        { error: "Unauthorized to access this item" },
        { status: 403 }
      );
    }

    // Fetch item with ownership history
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemid),
      with: {
        ownershipHistory: {
          orderBy: (history, { desc }) => [desc(history.transferDate)],
        },
      },
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Check user preferences for ownership history visibility
    const userPreferences = await db.query.userPreferences.findFirst({
      where: eq(items.id, itemid),
    });

    const showHistory = userPreferences?.showOwnershipHistory ?? true;

    // Prepare response
    const response = {
      id: item.id,
      serialNumber: item.serialNumber,
      mintNumber: item.mintNumber,
      nfcSerialNumber: item.nfcSerialNumber,
      weight: item.weight,
      manufactureDate: item.manufactureDate,
      producedAt: item.producedAt,
      currentOwnerName: item.currentOwnerName,
      currentOwnerEmail: item.currentOwnerEmail,
      blockId: item.blockId,
      currentBlockHash: item.currentBlockHash,
      previousBlockHash: item.previousBlockHash,
      ownershipHistory: showHistory ? item.ownershipHistory : undefined,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Error in /api/items/[id]:", error);
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
