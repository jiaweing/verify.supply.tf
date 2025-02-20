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
    throw new Error("Failed to fetch series");
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
    throw error;
  }
}

export async function createSeriesSkuAction(
  seriesId: number,
  formData: FormData
) {
  try {
    const code = formData.get("code")?.toString();

    if (!code) {
      throw new Error("SKU code is required");
    }

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku) {
      throw new Error("SKU code already exists");
    }

    const [newSku] = await db
      .insert(skus)
      .values({
        code,
        seriesId,
      })
      .returning();

    return { success: true, data: newSku };
  } catch (error) {
    console.error("Error creating SKU:", error);
    throw error;
  }
}

export async function updateSeriesSkuAction(formData: FormData) {
  try {
    const skuId = formData.get("id")?.toString();
    const code = formData.get("code")?.toString();

    if (!skuId || !code) {
      throw new Error("SKU ID and code are required");
    }

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku && existingSku.id !== parseInt(skuId)) {
      throw new Error("SKU code already exists");
    }

    const [updatedSku] = await db
      .update(skus)
      .set({ code })
      .where(eq(skus.id, parseInt(skuId)))
      .returning();

    return { success: true, data: updatedSku };
  } catch (error) {
    console.error("Error updating SKU:", error);
    throw error;
  }
}
export async function getSeriesByIdAction(id: number) {
  try {
    if (isNaN(id)) {
      throw new Error("Invalid series ID");
    }

    const seriesItem = await db.query.series.findFirst({
      where: eq(series.id, id),
    });

    if (!seriesItem) {
      throw new Error("Series not found");
    }

    return { success: true, data: seriesItem };
  } catch (error) {
    console.error("Error fetching series:", error);
    throw error;
  }
}

export async function updateSeriesAction(id: number, formData: FormData) {
  try {
    if (isNaN(id)) {
      throw new Error("Invalid series ID");
    }

    const name = formData.get("name")?.toString();
    const seriesNumber = formData.get("seriesNumber")?.toString();
    const totalPieces = Number(formData.get("totalPieces"));

    if (!name || !seriesNumber || !totalPieces) {
      throw new Error("Missing required fields");
    }

    const [updatedSeries] = await db
      .update(series)
      .set({
        name,
        seriesNumber,
        totalPieces,
        updatedAt: new Date(),
      })
      .where(eq(series.id, id))
      .returning();

    if (!updatedSeries) {
      throw new Error("Series not found");
    }

    return { success: true, data: updatedSeries };
  } catch (error) {
    console.error("Error updating series:", error);
    throw error;
  }
}

export async function deleteSeriesAction(id: number) {
  try {
    if (isNaN(id)) {
      throw new Error("Invalid series ID");
    }

    const [deletedSeries] = await db
      .delete(series)
      .where(eq(series.id, id))
      .returning();

    if (!deletedSeries) {
      throw new Error("Series not found");
    }

    return { success: true, message: "Series deleted successfully" };
  } catch (error) {
    console.error("Error deleting series:", error);
    throw error;
  }
}
export async function createSeriesAction(formData: FormData) {
  try {
    const name = formData.get("name")?.toString();
    const seriesNumber = formData.get("seriesNumber")?.toString();
    const totalPieces = Number(formData.get("totalPieces"));

    if (!name || !seriesNumber || !totalPieces) {
      throw new Error("Missing required fields");
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
    throw error;
  }
}
