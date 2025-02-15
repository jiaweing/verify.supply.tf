import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateItemForm } from "./create-item-form";

export default async function NewItemPage() {
  const isAuthenticated = await auth();
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">New Item</h1>
      </div>

      <CreateItemForm />
    </div>
  );
}
