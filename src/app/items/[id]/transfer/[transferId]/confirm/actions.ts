"use server";

import { cookies } from "next/headers";
import { RedirectType, redirect } from "next/navigation";

import { createSession } from "@/lib/auth";

interface RedirectError extends Error {
  digest?: string;
  message: string;
}

export async function processTransfer(
  formData: FormData,
  itemId: string,
  transferId: string,
  action: "confirm" | "reject"
) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/items/${itemId}/transfer`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transferId,
          action,
        }),
      }
    );

    const responseData = await res.json();

    if (!res.ok) {
      const errorMessage =
        responseData.error ||
        `Failed to process transfer: ${res.status} ${res.statusText}`;
      console.error("Transfer error:", errorMessage);
      throw new Error(errorMessage);
    }

    if (action === "confirm") {
      // Create session for new owner
      const { sessionToken } = await createSession(itemId);
      const cookieStore = await cookies();
      cookieStore.set("session_token", sessionToken);
    }

    // Redirect to item page
    redirect(`/items/${itemId}`, RedirectType.replace);
  } catch (error) {
    // Check if it's a non-redirect error
    const isNonRedirectError =
      error instanceof Error &&
      error.message !== "NEXT_REDIRECT" &&
      !(error as RedirectError).digest?.startsWith("NEXT_REDIRECT");

    if (isNonRedirectError) {
      console.error("Error processing transfer:", error);
    }
    throw error;
    // Always throw the error to ensure redirects work
  }
}

export async function confirmTransfer(
  itemId: string,
  transferId: string,
  formData: FormData
) {
  await processTransfer(formData, itemId, transferId, "confirm");
}

export async function rejectTransfer(
  itemId: string,
  transferId: string,
  formData: FormData
) {
  await processTransfer(formData, itemId, transferId, "reject");
}
