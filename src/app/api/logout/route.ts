import { deleteSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return NextResponse.json(
      { error: "No session token found" },
      { status: 400 }
    );
  }

  try {
    await deleteSession(sessionToken);
    cookieStore.delete("session_token");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Failed to delete session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
