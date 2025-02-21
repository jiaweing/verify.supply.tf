"use client";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ClickableTableRowProps {
  id: string;
  serialNumber: string;
  sku: string;
  mintNumber: string;
  originalOwnerName: string;
  nfcLink: string;
  shortUrl?: string;
}

export function ClickableTableRow({
  id,
  serialNumber,
  sku,
  mintNumber,
  originalOwnerName,
  nfcLink,
  shortUrl,
}: ClickableTableRowProps) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => router.push(`/admin/items/${id}`)}
    >
      <TableCell>{serialNumber}</TableCell>
      <TableCell>{sku}</TableCell>
      <TableCell>{mintNumber}</TableCell>
      <TableCell>{originalOwnerName}</TableCell>
      <TableCell>
        <div
          className="flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
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
                toast.success("NFC Link copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
            </Button>
            <span className="text-sm text-muted-foreground">NFC Link</span>
          </div>

          {shortUrl && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={shortUrl} target="_blank" rel="noopener noreferrer">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(shortUrl);
                  toast.success("Short URL copied to clipboard");
                }}
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
              </Button>
              <span className="text-sm text-muted-foreground">Short URL</span>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
