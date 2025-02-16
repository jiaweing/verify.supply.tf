import { ClickableTableRow } from "@/components/clickable-table-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import { Plus, Search } from "lucide-react";
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

  const { page: pageParam, search: searchParam } = await Promise.resolve(
    searchParams
  );
  const page = Number(pageParam) || 1;
  const search = searchParam || "";
  const itemsPerPage = 10;

  // Fetch items with search filter and pagination
  const itemList = await db.query.items.findMany({
    orderBy: (items, { desc }) => [desc(items.createdAt)],
    where: (items, { or, ilike }) =>
      or(
        ilike(items.serialNumber, `%${search}%`),
        ilike(items.sku, `%${search}%`),
        ilike(items.currentOwnerName, `%${search}%`)
      ),
  });

  // Calculate pagination
  const totalItems = itemList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = itemList.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

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

      <div className="space-y-4">
        <form>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                defaultValue={search}
                name="search"
                className="pl-8"
              />
            </div>
          </div>
        </form>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial Number</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Mint Number</TableHead>
                <TableHead>Current Owner</TableHead>
                <TableHead>NFC Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <ClickableTableRow
                  key={item.id}
                  id={item.id}
                  serialNumber={item.serialNumber}
                  sku={item.sku}
                  mintNumber={item.mintNumber}
                  currentOwnerName={item.currentOwnerName}
                  nfcLink={item.nfcLink}
                />
              ))}
              {itemList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={`?page=${page - 1}&search=${search}`}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href={`?page=${pageNumber}&search=${search}`}
                      isActive={page === pageNumber}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href={`?page=${page + 1}&search=${search}`}
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
