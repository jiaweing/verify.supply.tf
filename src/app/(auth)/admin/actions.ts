"use server";

import { db } from "@/db";
import { sessions } from "@/db/schema";
import { deleteSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function getSessionAction() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return { session: null };
    }

    // Get session data from database
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.sessionToken, sessionToken),
      with: {
        item: {
          with: {
            latestTransaction: true,
            transactions: {
              with: {
                block: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return { session: null };
    }

    return {
      session: {
        itemId: session.itemId,
        expiresAt: session.expiresAt,
        item: session.item,
      },
    };
  } catch (error) {
    console.error("Error in getSessionAction:", error);
    return {
      success: false,
      error: "An error occurred while fetching the session",
    };
  }
}

export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (!sessionToken) {
      return { success: false, error: "No session token found" };
    }

    await deleteSession(sessionToken);
    cookieStore.delete("session_token");
    return { success: true };
  } catch (error) {
    console.error("Error in logoutAction:", error);
    return {
      success: false,
      error: "An error occurred while logging out",
    };
  }
}
