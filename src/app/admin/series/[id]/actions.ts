"use server";

import { db } from "@/db";
import { series, skus } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function updateSeriesAction(formData: FormData) {
  try {
    const id = formData.get("id")?.toString();
    const name = formData.get("name")?.toString();
    const seriesNumber = formData.get("seriesNumber")?.toString();
    const totalPieces = formData.get("totalPieces")?.toString();

    if (!id || !name || !seriesNumber || !totalPieces) {
      return { success: false, error: "Missing required fields" };
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return { success: false, error: "Invalid series ID" };
    }

    const [updatedSeries] = await db
      .update(series)
      .set({
        name,
        seriesNumber,
        totalPieces: parseInt(totalPieces),
        updatedAt: new Date(),
      })
      .where(eq(series.id, parsedId))
      .returning();

    if (!updatedSeries) {
      return { success: false, error: "Series not found" };
    }

    return { success: true, data: updatedSeries };
  } catch (error) {
    console.error("Error updating series:", error);
    return {
      success: false,
      error: "An error occurred while updating the series",
    };
  }
}

export async function deleteSeriesAction(id: string) {
  try {
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return { success: false, error: "Invalid series ID" };
    }

    const [deletedSeries] = await db
      .delete(series)
      .where(eq(series.id, parsedId))
      .returning();

    if (!deletedSeries) {
      return { success: false, error: "Series not found" };
    }

    return { success: true, message: "Series deleted successfully" };
  } catch (error) {
    console.error("Error deleting series:", error);
    return {
      success: false,
      error: "An error occurred while deleting the series",
    };
  }
}

export async function createSkuAction(formData: FormData) {
  try {
    const seriesId = formData.get("seriesId")?.toString();
    const code = formData.get("code")?.toString();

    if (!seriesId || !code) {
      return { success: false, error: "Series ID and SKU code are required" };
    }

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku) {
      return { success: false, error: "SKU code already exists" };
    }

    const [newSku] = await db
      .insert(skus)
      .values({
        code,
        seriesId: parseInt(seriesId),
      })
      .returning();

    return { success: true, data: newSku };
  } catch (error) {
    console.error("Error creating SKU:", error);
    return {
      success: false,
      error: "An error occurred while creating the SKU",
    };
  }
}

export async function updateSkuAction(formData: FormData) {
  try {
    const skuId = formData.get("id")?.toString();
    const code = formData.get("code")?.toString();

    if (!skuId || !code) {
      return { success: false, error: "SKU ID and code are required" };
    }

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku && existingSku.id !== parseInt(skuId)) {
      return { success: false, error: "SKU code already exists" };
    }

    const [updatedSku] = await db
      .update(skus)
      .set({ code })
      .where(eq(skus.id, parseInt(skuId)))
      .returning();

    return { success: true, data: updatedSku };
  } catch (error) {
    console.error("Error updating SKU:", error);
    return {
      success: false,
      error: "An error occurred while updating the SKU",
    };
  }
}
