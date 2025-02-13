import { db } from "@/db";
import { items, userPreferences } from "@/db/schema";
import { validateSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

const updatePreferencesSchema = z.object({
  showOwnershipHistory: z.boolean(),
});

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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
        { error: "Unauthorized to update this item's preferences" },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await req.json();
    const { showOwnershipHistory } = updatePreferencesSchema.parse(body);

    // Check if item exists
    const item = await db.query.items.findFirst({
      where: eq(items.id, itemid),
    });

    if (!item) {
      return Response.json({ error: "Item not found" }, { status: 404 });
    }

    // Update or create preferences
    const existingPreferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.itemid, itemid),
    });

    if (existingPreferences) {
      await db
        .update(userPreferences)
        .set({ showOwnershipHistory })
        .where(eq(userPreferences.itemid, itemid));
    } else {
      await db.insert(userPreferences).values({
        itemid,
        showOwnershipHistory,
      });
    }

    return Response.json({
      message: "Preferences updated successfully",
      preferences: { showOwnershipHistory },
    });
  } catch (error) {
    console.error("Error in /api/items/[id]/preferences:", error);
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
