"use server";

import { db } from "@/db";
import { items, userOwnershipVisibility } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getItemDetailsAction(id: string) {
  try {
    const item = await db.query.items.findFirst({
      where: eq(items.id, id),
      with: {
        transactions: {
          with: {
            block: true,
          },
        },
        ownershipHistory: true,
      },
    });

    if (!item) {
      throw new Error("Item not found");
    }

    // Get current owner's visibility preference
    const visibility = await db.query.userOwnershipVisibility.findFirst({
      where: eq(userOwnershipVisibility.email, item.originalOwnerEmail),
      columns: {
        visible: true,
      },
    });

    return {
      success: true,
      data: {
        ...item,
        visible: visibility?.visible ?? false,
      },
    };
  } catch (error) {
    console.error("Error fetching item details:", error);
    throw error;
  }
}
