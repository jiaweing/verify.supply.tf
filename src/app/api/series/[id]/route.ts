import { db } from "@/db";
import { series } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

// GET /api/series/[id] - Get a single series
export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid series ID" }, { status: 400 });
    }

    const seriesItem = await db.query.series.findFirst({
      where: eq(series.id, id),
    });

    if (!seriesItem) {
      return Response.json({ error: "Series not found" }, { status: 404 });
    }

    return Response.json(seriesItem);
  } catch (error) {
    console.error("Error fetching series:", error);
    return Response.json({ error: "Failed to fetch series" }, { status: 500 });
  }
}

// PUT /api/series/[id] - Update a series
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid series ID" }, { status: 400 });
    }

    const formData = await request.formData();
    const name = formData.get("name")?.toString();
    const seriesNumber = formData.get("seriesNumber")?.toString();
    const totalPieces = Number(formData.get("totalPieces"));

    if (!name || !seriesNumber || !totalPieces) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const updatedSeries = await db
      .update(series)
      .set({
        name,
        seriesNumber,
        totalPieces,
        updatedAt: new Date(),
      })
      .where(eq(series.id, id))
      .returning();

    if (!updatedSeries.length) {
      return Response.json({ error: "Series not found" }, { status: 404 });
    }

    return Response.json(updatedSeries[0]);
  } catch (error) {
    console.error("Error updating series:", error);
    return Response.json({ error: "Failed to update series" }, { status: 500 });
  }
}

// DELETE /api/series/[id] - Delete a series
export async function DELETE(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid series ID" }, { status: 400 });
    }

    const deletedSeries = await db
      .delete(series)
      .where(eq(series.id, id))
      .returning();

    if (!deletedSeries.length) {
      return Response.json({ error: "Series not found" }, { status: 404 });
    }

    return Response.json({ message: "Series deleted successfully" });
  } catch (error) {
    console.error("Error deleting series:", error);
    return Response.json({ error: "Failed to delete series" }, { status: 500 });
  }
}
