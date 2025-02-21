"use server";

import { db } from "@/db";
import { items, userOwnershipVisibility } from "@/db/schema";
import { validateSession } from "@/lib/auth";
import { getCurrentOwner } from "@/lib/blockchain";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

const emailArraySchema = z.array(z.string().email());
const uuidSchema = z.string().uuid("Invalid UUID format");
const updatePreferencesSchema = z.object({
  showOwnershipHistory: z.boolean(),
});

export async function getVisibilityPreferencesAction(emails: string[]) {
  try {
    const validatedEmails = emailArraySchema.parse(emails);

    const preferences = await db.query.userOwnershipVisibility.findMany({
      where: inArray(userOwnershipVisibility.email, validatedEmails),
      columns: {
        email: true,
        visible: true,
      },
    });

    // Convert to map of email -> visibility
    const visibilityMap = Object.fromEntries(
      preferences.map((pref) => [pref.email, pref.visible])
    );

    return {
      success: true,
      data: visibilityMap,
    };
  } catch (error) {
    console.error("Error fetching visibility preferences:", error);
    return {
      success: false,
      error: "An error occurred while fetching visibility preferences",
    };
  }
}

export async function updateItemPreferencesAction(
  itemId: string,
  sessionToken: string,
  preferences: { showOwnershipHistory: boolean }
) {
  try {
    // Validate authentication
    if (!sessionToken) {
      return { success: false, error: "Authentication required" };
    }

    const authenticatedItemId = await validateSession(sessionToken);
    if (!authenticatedItemId) {
      return { success: false, error: "Invalid or expired session" };
    }

    // Validate UUID format
    const validatedId = uuidSchema.parse(itemId);
    if (authenticatedItemId !== validatedId) {
      return {
        success: false,
        error: "Unauthorized to update this item's preferences",
      };
    }

    // Get item with transactions to verify ownership
    const item = await db.query.items.findFirst({
      where: eq(items.id, validatedId),
      with: {
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

    // Verify ownership
    const currentOwner = getCurrentOwner(item.transactions, item);
    if (!currentOwner) {
      return { success: false, error: "Could not determine current owner" };
    }

    const { showOwnershipHistory } = updatePreferencesSchema.parse(preferences);

    // Update visibility for current owner's email
    await db
      .insert(userOwnershipVisibility)
      .values({
        email: currentOwner.currentOwnerEmail,
        visible: showOwnershipHistory,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userOwnershipVisibility.email,
        set: {
          visible: showOwnershipHistory,
          updatedAt: new Date(),
        },
      });

    return {
      success: true,
      message: "Preferences updated successfully",
      data: { showOwnershipHistory },
    };
  } catch (error) {
    console.error("Error updating preferences:", error);
    return {
      success: false,
      error: "An error occurred while updating preferences",
    };
  }
}
