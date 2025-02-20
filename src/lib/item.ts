import { db } from "@/db";
import { items, series, skus } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function formatMintNumber(itemId: string): Promise<string> {
  // Get the item and join through to series to get total pieces
  const result = await db
    .select({
      mintNumber: items.mintNumber,
      totalPieces: series.totalPieces,
    })
    .from(items)
    .innerJoin(skus, eq(items.sku, skus.code))
    .innerJoin(series, eq(skus.seriesId, series.id))
    .where(eq(items.id, itemId))
    .limit(1);

  if (!result.length) {
    throw new Error("Item not found");
  }

  const { mintNumber, totalPieces } = result[0];

  // Calculate padding length based on total pieces
  const padLength = totalPieces.toString().length;

  // Remove any existing formatting (like #) and convert to number
  const numberOnly = parseInt(mintNumber.replace(/\D/g, ""));

  // Format with proper padding
  return `#${numberOnly.toString().padStart(padLength, "0")}`;
}
