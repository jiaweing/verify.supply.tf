import { db } from "@/db";
import { skus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const sku = await db.query.skus.findFirst({
      where: eq(skus.code, params.code),
      with: {
        series: true,
      },
    });

    if (!sku || !sku.series) {
      return Response.json(
        { error: "SKU or series not found" },
        { status: 404 }
      );
    }

    return Response.json(sku.series);
  } catch (error) {
    console.error("Error fetching series by SKU:", error);
    return Response.json(
      { error: "Failed to fetch series data" },
      { status: 500 }
    );
  }
}
