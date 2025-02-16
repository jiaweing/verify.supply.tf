import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: "No session token found" },
      { status: 401 }
    );
  }

  try {
    const itemId = await validateSession(sessionToken);
    return NextResponse.json({ itemId });
  } catch (error) {
    console.log("Failed to validate session:", error);
    return NextResponse.json(
      { error: "Failed to validate session" },
      { status: 401 }
    );
  }
}
