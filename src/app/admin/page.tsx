import { ItemsTable } from "@/components/items-table";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { shortUrls } from "@/db/schema";
import { env } from "@/env.mjs";
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

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function AdminPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const isAuthenticated = await auth();
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  const { search } = await Promise.resolve(searchParams);

  // Fetch items including their short URLs
  const itemList = await db.query.items.findMany({
    orderBy: (items, { desc }) => [desc(items.createdAt)],
    with: {
      shortUrls: true,
    },
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

  // Create short URLs for items that don't have them
  for (const item of itemList) {
    if (!item.shortUrls?.length) {
      try {
        await db.insert(shortUrls).values({
          originalUrl: item.nfcLink,
          itemId: item.id,
        });
      } catch (error) {
        console.error("Error creating short URL for item:", item.id, error);
      }
    }
  }

  // Refetch items to get newly created short URLs
  const updatedItemList = await db.query.items.findMany({
    orderBy: (items, { desc }) => [desc(items.createdAt)],
    with: {
      shortUrls: true,
    },
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
          updatedItemList.map(async (item) => ({
            ...item,
            mintNumber: await formatMintNumber(item.id),
            shortUrl: item.shortUrls?.[0]
              ? `${env.NEXT_PUBLIC_APP_URL}/s/${item.shortUrls[0].shortPath}`
              : undefined,
          }))
        )}
      />
    </div>
  );
}
