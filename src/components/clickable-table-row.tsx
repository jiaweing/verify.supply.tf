"use client";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ClickableTableRowProps {
  id: string;
  serialNumber: string;
  sku: string;
  mintNumber: number | string;
  currentOwnerName: string;
  nfcLink: string;
}

export function ClickableTableRow({
  id,
  serialNumber,
  sku,
  mintNumber,
  currentOwnerName,
  nfcLink,
}: ClickableTableRowProps) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/admin/items/${id}`)}
    >
      <TableCell>{serialNumber}</TableCell>
      <TableCell>{sku}</TableCell>
      <TableCell>
        #{typeof mintNumber === "string" ? mintNumber : mintNumber.toString()}
      </TableCell>
      <TableCell>{currentOwnerName}</TableCell>
      <TableCell>
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="outline" size="sm" asChild>
            <Link href={nfcLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(nfcLink);
              toast.success("NFC link copied to clipboard");
            }}
          >
            <Copy className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
