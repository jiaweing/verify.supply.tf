import { env } from "@/env.mjs";
import { adminLogin } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const data = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    // Validate input
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }

    // Attempt login
    const token = await adminLogin(parsed.data.email, parsed.data.password);
    if (!token) {
      return Response.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Set cookie and redirect
    const cookieStore = await cookies();
    cookieStore.set("admin_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return Response.redirect(new URL("/admin", request.url));
  } catch (error) {
    console.error("Error in /api/auth/admin/login:", error);
    return Response.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
