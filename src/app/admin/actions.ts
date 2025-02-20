"use server";

import { env } from "@/env.mjs";
import { adminLogin } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  password: z.string().min(1),
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
      throw new Error("Invalid email or password");
    }

    // Attempt login
    const token = await adminLogin(parsed.data.email, parsed.data.password);
    if (!token) {
      throw new Error("Invalid email or password");
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("admin_token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4, // 4 hours
    });

    redirect("/admin");
  } catch (error) {
    console.error("Error in admin login:", error);
    throw error;
  }
}

export async function adminLogoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_token");
  redirect("/admin/login");
}

import { db } from "@/db";
import { series } from "@/db/schema";

const seriesSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  skuPrefix: z.string().min(3).max(5),
  mintLimit: z.number().min(1),
});

export async function createSeriesAction(formData: FormData) {
  try {
    const name = formData.get("name");
    const skuPrefix = formData.get("skuPrefix");
    const mintLimit = formData.get("mintLimit");

    if (!name || !skuPrefix || !mintLimit) {
      throw new Error("Missing required fields");
    }

    const data = {
      name: name.toString(),
      skuPrefix: skuPrefix.toString(),
      mintLimit: Number(mintLimit),
      seriesNumber: skuPrefix.toString(), // Using skuPrefix as seriesNumber
      totalPieces: Number(mintLimit), // Using mintLimit as totalPieces
      currentMintNumber: 0, // Starting mint number
    };

    const parsed = seriesSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("Invalid series data");
    }

    await db.insert(series).values({
      name: parsed.data.name,
      seriesNumber: data.seriesNumber,
      totalPieces: data.totalPieces,
      currentMintNumber: data.currentMintNumber,
    });

    return { success: true, message: "Series created successfully" };
  } catch (error) {
    console.error("Error creating series:", error);
    throw error;
  }
}
