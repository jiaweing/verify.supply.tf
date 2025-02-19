import { db } from "@/db";
import { userOwnershipVisibility } from "@/db/schema";
import { validateSession } from "@/lib/auth";
import { getCurrentOwner } from "@/lib/blockchain";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // First verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Validate session and get itemId
    const itemId = await validateSession(sessionToken);
    if (!itemId) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }

    const { email, visible } = await req.json();

    if (!email || typeof visible !== "boolean") {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    // Get item details
    const item = await db.query.items.findFirst({
      where: (items, { eq }) => eq(items.id, itemId),
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

    // Verify ownership
    const currentOwner = getCurrentOwner(item.transactions, item);
    if (currentOwner.currentOwnerEmail !== email) {
      return Response.json(
        {
          error:
            "Unauthorized - you can only modify your own visibility settings",
        },
        { status: 403 }
      );
    }

    // Upsert visibility preference if authorized
    await db
      .insert(userOwnershipVisibility)
      .values({
        email,
        visible,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userOwnershipVisibility.email,
        set: {
          visible,
          updatedAt: new Date(),
        },
      });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating visibility:", error);
    return Response.json(
      { error: "Failed to update visibility" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // For GET requests we don't require authentication since the visibility
    // status is public information that's already shown in the ownership table

    const preference = await db.query.userOwnershipVisibility.findFirst({
      where: eq(userOwnershipVisibility.email, email),
    });

    return Response.json({ visible: preference?.visible ?? false });
  } catch (error) {
    console.error("Error fetching visibility:", error);
    return Response.json(
      { error: "Failed to fetch visibility" },
      { status: 500 }
    );
  }
}
