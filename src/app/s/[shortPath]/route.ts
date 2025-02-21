import { db } from "@/db";
import { shortUrls } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { shortPath: string } }
) {
  try {
    if (params.shortPath.length !== 36) {
      // UUID length
      return new Response("Not Found", { status: 404 });
    }

    const shortUrl = await db.query.shortUrls.findFirst({
      where: eq(shortUrls.shortPath, params.shortPath),
    });

    if (!shortUrl) {
      return new Response("Not Found", { status: 404 });
    }

    return Response.redirect(shortUrl.originalUrl);
  } catch (error) {
    console.error("Error looking up short URL:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
