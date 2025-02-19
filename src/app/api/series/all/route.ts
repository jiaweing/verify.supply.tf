import { db } from "@/db";
import { series } from "@/db/schema";
import { desc } from "drizzle-orm";

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
