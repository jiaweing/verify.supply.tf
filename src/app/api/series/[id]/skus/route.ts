import { db } from "@/db";
import { skus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const seriesSkus = await db.query.skus.findMany({
      where: eq(skus.seriesId, parseInt(params.id)),
    });

    return Response.json(seriesSkus);
  } catch (error) {
    console.error("Error fetching SKUs:", error);
    return Response.json({ error: "Failed to fetch SKUs" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const formData = await request.formData();
    const code = formData.get("code") as string;

    if (!code) {
      return Response.json({ error: "SKU code is required" }, { status: 400 });
    }

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku) {
      return Response.json(
        { error: "SKU code already exists" },
        { status: 400 }
      );
    }

    const newSku = await db
      .insert(skus)
      .values({
        code,
        seriesId: parseInt(params.id),
      })
      .returning();

    return Response.json(newSku[0]);
  } catch (error) {
    console.error("Error creating SKU:", error);
    return Response.json({ error: "Failed to create SKU" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const formData = await request.formData();
    const skuId = formData.get("id") as string;
    const code = formData.get("code") as string;

    if (!skuId || !code) {
      return Response.json(
        { error: "SKU ID and code are required" },
        { status: 400 }
      );
    }

    const existingSku = await db.query.skus.findFirst({
      where: eq(skus.code, code),
    });

    if (existingSku && existingSku.id !== parseInt(skuId)) {
      return Response.json(
        { error: "SKU code already exists" },
        { status: 400 }
      );
    }

    const updatedSku = await db
      .update(skus)
      .set({ code })
      .where(eq(skus.id, parseInt(skuId)))
      .returning();

    return Response.json(updatedSku[0]);
  } catch (error) {
    console.error("Error updating SKU:", error);
    return Response.json({ error: "Failed to update SKU" }, { status: 500 });
  }
}
