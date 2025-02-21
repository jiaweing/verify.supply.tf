"use server";

import { env } from "@/env.mjs";
import { adminLogin } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";

const loginSchema = z.object({
  email: z
    .string()
    .email()
    .refine(
      (email) => {
        return (
          email.length <= 254 && // RFC 5321
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
            email
          ) &&
          !email.includes("..") // No consecutive dots
        );
      },
      { message: "Invalid email format" }
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
});

export async function adminLoginAction(formData: FormData) {
  try {
    const data = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    // Validate input
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid email or password" };
    }

    // Attempt login
    const token = await adminLogin(parsed.data.email, parsed.data.password);
    if (!token) {
      return { success: false, error: "Invalid email or password" };
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_token", token, {
      httpOnly: true, // Prevent JavaScript access
      secure: env.NODE_ENV === "production", // Require HTTPS in production
      sameSite: "strict", // Enhanced security: only send cookie to same site
      path: "/",
      maxAge: 60 * 60 * 4, // 4 hours
    });

    return { success: true };
  } catch (error) {
    console.error("Error in admin login:", error);
    return {
      success: false,
      error: "An error occurred during login. Please try again.",
    };
  }
}

export async function adminLogoutAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("admin_token");
    return { success: true };
  } catch (error) {
    console.error("Error during admin logout:", error);
    return {
      success: false,
      error: "An error occurred during logout. Please try again.",
    };
  }
}
