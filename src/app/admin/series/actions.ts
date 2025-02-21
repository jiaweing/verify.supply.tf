"use server";

import { db } from "@/db";
import { series, skus } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function getSeriesAction() {
  try {
    const allSeries = await db.query.series.findMany({
      orderBy: [desc(series.createdAt)],
    });
    return { success: true, data: allSeries };
  } catch (error) {
    console.error("Error fetching series:", error);
    return {
      success: false,
      error: "Failed to fetch series",
    };
  }
}

export async function getSeriesSkusAction(seriesId: number) {
  try {
    const seriesSkus = await db.query.skus.findMany({
      where: eq(skus.seriesId, seriesId),
    });
    return { success: true, data: seriesSkus };
  } catch (error) {
    console.error("Error fetching SKUs:", error);
    return {
      success: false,
      error: "Failed to fetch SKUs",
    };
  }
}

export async function createSeriesAction(formData: FormData) {
  try {
    const name = formData.get("name")?.toString();
    const seriesNumber = formData.get("seriesNumber")?.toString();
    const totalPieces = Number(formData.get("totalPieces"));

    if (!name || !seriesNumber || !totalPieces) {
      return { success: false, error: "Missing required fields" };
    }

    const [newSeries] = await db
      .insert(series)
      .values({
        name,
        seriesNumber,
        totalPieces,
      })
      .returning();

    return { success: true, data: newSeries };
  } catch (error) {
    console.error("Error creating series:", error);
    return {
      success: false,
      error: "An error occurred while creating the series",
    };
  }
}
