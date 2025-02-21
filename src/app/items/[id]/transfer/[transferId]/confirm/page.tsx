import Footer from "@/components/footer";
import Header from "@/components/header";
import { TransferConfirmButtons } from "@/components/transfer-confirm-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { items, ownershipTransfers } from "@/db/schema";
import { formatMintNumber } from "@/lib/item";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function TransferConfirmPage({
  params,
}: {
  params: Promise<{ id: string; transferId: string }>;
}) {
  const { id, transferId } = await params;
  // Get transfer and item details
  const transfer = await db.query.ownershipTransfers.findFirst({
    where: eq(ownershipTransfers.id, transferId),
  });

  // Get item details
  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
    with: {
      sku: {
        with: {
          series: true,
        },
      },
    },
  });

  if (!transfer || !item) {
    notFound();
  }

  // Check if transfer matches item
  if (transfer.itemId !== id) {
    notFound();
  }

  // Check if transfer is already confirmed
  if (transfer.isConfirmed) {
    return (
      <div className="container py-10 mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Transfer Completed</CardTitle>
            <CardDescription>
              This transfer has already been completed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Check if transfer is expired
  if (new Date() > transfer.expiresAt) {
    return (
      <div className="container py-10 mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Transfer Expired</CardTitle>
            <CardDescription>
              This transfer request has expired. Please request a new transfer
              from the current owner.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10 mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] space-y-4">
      <Header />
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Accept Transfer</CardTitle>
          <CardDescription>
            Would you like to accept ownership of this item?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Item Details</h4>
            <div className="rounded-md border p-4 text-sm font-mono space-y-2">
              <div>
                <span className="font-medium">Series:</span>{" "}
                {item.sku.series.name}
              </div>
              <div>
                <span className="font-medium">Mint Number:</span>{" "}
                {await formatMintNumber(item.id)}
              </div>
              <div>
                <span className="font-medium">Serial Number:</span>{" "}
                {item.serialNumber}
              </div>
              <div>
                <span className="font-medium">SKU:</span> {item.sku.code}
              </div>
              {item.weight && (
                <div>
                  <span className="font-medium">Weight:</span> {item.weight}
                </div>
              )}
              <div>
                <span className="font-medium">From:</span>{" "}
                {transfer.currentOwnerEmail}
              </div>
            </div>
          </div>
          <TransferConfirmButtons id={id} transferId={transferId} />
        </CardContent>
      </Card>
      <Footer />
    </div>
  );
}
