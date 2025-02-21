import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSeriesAction } from "../actions";
import { SeriesForm } from "../series-form";

export default async function NewSeriesPage() {
  const isAuthenticated = await auth();
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">New Series</h1>
      </div>

      <SeriesForm action={createSeriesAction} />
    </div>
  );
}
