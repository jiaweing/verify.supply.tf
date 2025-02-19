import { env } from "@/env.mjs";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SeriesForm } from "../series-form";

export default async function NewSeriesPage() {
  const isAuthenticated = await auth();
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  async function handleSeriesFormAction(formData: FormData) {
    "use server";

    const response = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/series`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to create series");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">New Series</h1>
      </div>

      <SeriesForm action={handleSeriesFormAction} />
    </div>
  );
}
