"use server";

import { db } from "@/db";
import { series, skus } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAllSeries() {
  try {
    const allSeries = await db.query.series.findMany({
      orderBy: [desc(series.createdAt)],
    });
    return allSeries;
  } catch (error) {
    console.error("Error fetching series:", error);
    throw new Error("Failed to fetch series");
  }
}

export async function createSeries(formData: FormData) {
  try {
    const name = formData.get("name")?.toString();
    const seriesNumber = formData.get("seriesNumber")?.toString();
    const totalPieces = Number(formData.get("totalPieces"));

    if (!name || !seriesNumber || !totalPieces) {
      throw new Error("Missing required fields");
    }

    const newSeries = await db
      .insert(series)
      .values({
        name,
        seriesNumber,
        totalPieces,
      })
      .returning();

    revalidatePath("/admin/series");
    return newSeries[0];
  } catch (error) {
    console.error("Error creating series:", error);
    throw error;
  }
}

export async function getSeriesSkus(seriesId: string) {
  try {
    const seriesSkus = await db.query.skus.findMany({
      where: eq(skus.seriesId, parseInt(seriesId)),
    });
    return seriesSkus;
  } catch (error) {
    console.error("Error fetching SKUs:", error);
    throw new Error("Failed to fetch SKUs");
  }
}

export async function getSeries(id: string) {
  try {
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new Error("Invalid series ID");
    }

    const seriesItem = await db.query.series.findFirst({
      where: eq(series.id, parsedId),
    });

    if (!seriesItem) {
      throw new Error("Series not found");
    }

    return seriesItem;
  } catch (error) {
    console.error("Error fetching series:", error);
    throw error;
  }
}

export async function updateSeries(formData: FormData) {
  try {
    const id = formData.get("id")?.toString();
    const name = formData.get("name")?.toString();
    const seriesNumber = formData.get("seriesNumber")?.toString();
    const totalPieces = Number(formData.get("totalPieces"));

    if (!id || !name || !seriesNumber || !totalPieces) {
      throw new Error("Missing required fields");
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new Error("Invalid series ID");
    }

    const updatedSeries = await db
      .update(series)
      .set({
        name,
        seriesNumber,
        totalPieces,
        updatedAt: new Date(),
      })
      .where(eq(series.id, parsedId))
      .returning();

    if (!updatedSeries.length) {
      throw new Error("Series not found");
    }

    revalidatePath(`/admin/series/${id}`);
    return updatedSeries[0];
  } catch (error) {
    console.error("Error updating series:", error);
    throw error;
  }
}

export async function deleteSeries(id: string) {
  try {
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      throw new Error("Invalid series ID");
    }

    const deletedSeries = await db
      .delete(series)
      .where(eq(series.id, parsedId))
      .returning();

    if (!deletedSeries.length) {
      throw new Error("Series not found");
    }

    revalidatePath("/admin/series");
    return { message: "Series deleted successfully" };
  } catch (error) {
    console.error("Error deleting series:", error);
    throw error;
  }
}

export async function createSku(formData: FormData) {
  try {
    const seriesId = formData.get("seriesId")?.toString();
    const code = formData.get("code") as string;

    if (!seriesId) throw new Error("Series ID is required");
    if (!code) throw new Error("SKU code is required");

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku) {
      throw new Error("SKU code already exists");
    }

    const newSku = await db
      .insert(skus)
      .values({
        code,
        seriesId: parseInt(seriesId),
      })
      .returning();

    revalidatePath(`/admin/series/${seriesId}`);
    return newSku[0];
  } catch (error) {
    console.error("Error creating SKU:", error);
    throw error;
  }
}

export async function updateSku(formData: FormData) {
  try {
    const skuId = formData.get("id")?.toString();
    const code = formData.get("code") as string;
    const seriesId = formData.get("seriesId")?.toString();

    if (!skuId || !code) {
      throw new Error("SKU ID and code are required");
    }

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku && existingSku.id !== parseInt(skuId)) {
      throw new Error("SKU code already exists");
    }

    const updatedSku = await db
      .update(skus)
      .set({ code })
      .where(eq(skus.id, parseInt(skuId)))
      .returning();

    revalidatePath(`/admin/series/${seriesId}`);
    return updatedSku[0];
  } catch (error) {
    console.error("Error updating SKU:", error);
    throw error;
  }
}
