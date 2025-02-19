import { db } from "@/db";
import { series } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";

// GET /api/series - List all series
export async function GET() {
  try {
    const allSeries = await db.query.series.findMany({
      orderBy: [desc(series.createdAt)],
    });
    return Response.json(allSeries);
  } catch (error) {
    console.error("Error fetching series:", error);
    return Response.json({ error: "Failed to fetch series" }, { status: 500 });
  }
}

// POST /api/series - Create a new series
export async function POST(request: NextRequest) {
  try {
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

    const newSeries = await db
      .insert(series)
      .values({
        name,
        seriesNumber,
        totalPieces,
      })
      .returning();

    return Response.json(newSeries[0], { status: 201 });
  } catch (error) {
    console.error("Error creating series:", error);
    return Response.json({ error: "Failed to create series" }, { status: 500 });
  }
}
