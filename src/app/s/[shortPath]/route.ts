import { db } from "@/db";
import { shortUrls } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const shortPath = req.nextUrl.pathname.split("/s/")[1];
    if (shortPath.length !== 36) {
      // UUID length
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const shortUrl = await db.query.shortUrls.findFirst({
      where: eq(shortUrls.shortPath, shortPath),
    });

    if (!shortUrl) {
      return Response.json({ error: "Not Found" }, { status: 404 });
    }

    return Response.redirect(shortUrl.originalUrl);
  } catch (error) {
    console.error("Error looking up short URL:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
