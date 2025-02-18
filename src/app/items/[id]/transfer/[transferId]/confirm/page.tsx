import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { items, ownershipTransfers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { confirmTransfer, rejectTransfer } from "./actions";

export default async function TransferConfirmPage({
  params,
}: {
  params: { id: string; transferId: string };
}) {
  const [id, transferId] = await Promise.all([params.id, params.transferId]);

  // Get transfer and item details
  const transfer = await db.query.ownershipTransfers.findFirst({
    where: eq(ownershipTransfers.id, transferId),
  });

  // Get item details
  const item = await db.query.items.findFirst({
    where: eq(items.id, id),
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
            <CardTitle>Transfer Already Processed</CardTitle>
            <CardDescription>
              This transfer has already been confirmed.
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
              This transfer request has expired. Please request a new transfer.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleConfirmTransfer = async (formData: FormData) => {
    "use server";
    await confirmTransfer(id, transferId, formData);
  };

  const handleRejectTransfer = async (formData: FormData) => {
    "use server";
    await rejectTransfer(id, transferId, formData);
  };

  return (
    <div className="container py-10 mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)]">
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
                <span className="font-medium">Serial Number:</span>{" "}
                {item.serialNumber}
              </div>
              <div>
                <span className="font-medium">SKU:</span> {item.sku}
              </div>
              <div>
                <span className="font-medium">Mint Number:</span>{" "}
                {item.mintNumber}
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
          <div className="flex justify-center gap-4">
            <form action={handleConfirmTransfer}>
              <Button type="submit" className="bg-green-500 hover:bg-green-600">
                Accept
              </Button>
            </form>
            <form action={handleRejectTransfer}>
              <Button
                type="submit"
                variant="outline"
                className="text-red-500 hover:text-red-600"
              >
                Decline
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
