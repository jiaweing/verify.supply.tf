"use server";

import { env } from "@/env.mjs";

export async function updateSeries(formData: FormData) {
  const seriesId = formData.get("id")?.toString();
  if (!seriesId) throw new Error("Series ID is required");

  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/series/${seriesId}`,
    {
      method: "PUT",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update series");
  }
}

export async function createSku(formData: FormData) {
  const seriesId = formData.get("seriesId")?.toString();
  if (!seriesId) throw new Error("Series ID is required");

  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/series/${seriesId}/skus`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create SKU");
  }
}

export async function updateSku(formData: FormData) {
  const seriesId = formData.get("seriesId")?.toString();
  if (!seriesId) throw new Error("Series ID is required");

  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/series/${seriesId}/skus`,
    {
      method: "PATCH",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update SKU");
  }
}
