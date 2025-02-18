"use server";

import { redirect } from "next/navigation";

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
          transferId: parseInt(transferId),
          action,
        }),
      }
    );

    if (!res.ok) {
      throw new Error("Failed to process transfer");
    }

    // Redirect to item page
    redirect(`/items/${itemId}`);
  } catch (error) {
    console.error("Error processing transfer:", error);
    throw error;
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
