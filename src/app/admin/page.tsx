import { ItemsTable } from "@/components/items-table";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { formatMintNumber } from "@/lib/item";
import { sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface SearchParams {
  page?: string;
  search?: string;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const isAuthenticated = await auth();
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  const { search } = await Promise.resolve(searchParams);

  // Fetch items with search filter and pagination
  const itemList = await db.query.items.findMany({
    orderBy: (items, { desc }) => [desc(items.createdAt)],
    where: search
      ? (items, { or, like }) =>
          or(
            like(
              sql`LOWER(${items.serialNumber})`,
              `%${search.toLowerCase()}%`
            ),
            like(sql`LOWER(${items.sku})`, `%${search.toLowerCase()}%`),
            like(
              sql`LOWER(${items.originalOwnerName})`,
              `%${search.toLowerCase()}%`
            )
          )
      : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Items</h1>
        <Button asChild>
          <Link href="/admin/items/new">
            <Plus /> New
          </Link>
        </Button>
      </div>

      <ItemsTable
        items={await Promise.all(
          itemList.map(async (item) => ({
            ...item,
            mintNumber: await formatMintNumber(item.id),
          }))
        )}
      />
    </div>
  );
}
