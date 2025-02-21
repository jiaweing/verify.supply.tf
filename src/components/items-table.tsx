"use client";

import { ClickableTableRow } from "@/components/clickable-table-row";
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
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Item {
  id: string;
  serialNumber: string;
  sku: string;
  mintNumber: string;
  originalOwnerName: string;
  nfcLink: string;
  shortUrl?: string;
}

interface ItemsTableProps {
  items: Item[];
}

export function ItemsTable({ items }: ItemsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const page = Number(params.get("page")) || 1;
  const search = params.get("search") || "";

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const newParams = new URLSearchParams(params.toString());
      if (value) {
        newParams.set(name, value);
      } else {
        newParams.delete(name);
      }
      // Reset to page 1 when searching
      if (name === "search") {
        newParams.set("page", "1");
      }
      return newParams.toString();
    },
    [params]
  );

  const debouncedSearch = useCallback(
    (term: string) => {
      const queryString = createQueryString("search", term);
      router.push(`${pathname}?${queryString}`);
    },
    [router, pathname, createQueryString]
  );

  const itemsPerPage = 10;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = items.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            defaultValue={search}
            onChange={(e) => {
              const timer = setTimeout(() => {
                debouncedSearch(e.target.value);
              }, 500);
              return () => clearTimeout(timer);
            }}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Mint Number</TableHead>
              <TableHead>Original Owner</TableHead>
              <TableHead>Link</TableHead>
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
                originalOwnerName={item.originalOwnerName}
                nfcLink={item.nfcLink}
                shortUrl={item.shortUrl}
              />
            ))}
            {items.length === 0 && (
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
  );
}
