import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const isAuthenticated = await auth();
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  // Fetch items sorted by creation date
  const itemList = await db.query.items.findMany({
    orderBy: (items, { desc }) => [desc(items.createdAt)],
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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Mint Number</TableHead>
              <TableHead>Current Owner</TableHead>
              <TableHead>NFC Link</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemList.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.serialNumber}</TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell>#{item.mintNumber}</TableCell>
                <TableCell>{item.currentOwnerName}</TableCell>
                <TableCell className="font-mono text-sm">
                  <Link href={item.nfcLink} className="text-primary">
                    {item.nfcLink}
                  </Link>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/items/${item.id}`}>
                      View <ChevronRight />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {itemList.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No items found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
