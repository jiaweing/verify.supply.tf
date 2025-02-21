import { BlockchainCard } from "@/components/blockchain-card";
import { NfcDataCard } from "@/components/nfc-data-card";
import { OwnershipTable } from "@/components/ownership-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { shortUrls } from "@/db/schema";
import { auth } from "@/lib/auth";
import { verifyItemChain } from "@/lib/blockchain";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatMintNumber } from "@/lib/item";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid UUID format");

export default async function ItemPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const isAuthenticated = await auth();
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  let id: string;
  try {
    id = uuidSchema.parse(params.id);
  } catch {
    notFound();
  }

  const itemResult = await db.query.items.findFirst({
    where: (items, { eq }) => eq(items.id, id),
    with: {
      transactions: {
        with: {
          block: true,
        },
      },
      ownershipHistory: {
        orderBy: (history, { desc }) => [desc(history.createdAt)],
      },
      creationBlock: true,
      latestTransaction: {
        with: {
          block: true,
        },
      },
      shortUrls: true,
    },
  });

  if (!itemResult) {
    notFound();
  }

  let item = itemResult;

  // Create short URL if it doesn't exist
  if (!item.shortUrls?.length) {
    try {
      await db.insert(shortUrls).values({
        originalUrl: item.nfcLink,
        itemId: item.id,
      });

      // Refetch item to get the new short URL
      const updatedItem = await db.query.items.findFirst({
        where: (items, { eq }) => eq(items.id, id),
        with: {
          transactions: {
            with: {
              block: true,
            },
          },
          ownershipHistory: {
            orderBy: (history, { desc }) => [desc(history.createdAt)],
          },
          creationBlock: true,
          latestTransaction: {
            with: {
              block: true,
            },
          },
          shortUrls: true,
        },
      });

      if (updatedItem) {
        item = updatedItem;
      }
    } catch (error) {
      console.error("Error creating short URL:", error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Item Details</h1>
        <Button asChild variant="outline">
          <Link href="/admin">
            Items <ChevronRight />
          </Link>
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Item Information */}
        <Card>
          <CardHeader>
            <CardTitle>Item Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium">Serial Number</dt>
                <dd className="text-muted-foreground">{item.serialNumber}</dd>
              </div>
              <div>
                <dt className="font-medium">SKU</dt>
                <dd className="text-muted-foreground">{item.sku}</dd>
              </div>
              <div>
                <dt className="font-medium">Mint Number</dt>
                <dd className="text-muted-foreground">
                  {await formatMintNumber(item.id)}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Weight</dt>
                <dd className="text-muted-foreground">{item.weight}</dd>
              </div>
              <div>
                <dt className="font-medium">NFC Serial Number</dt>
                <dd className="text-muted-foreground">
                  {item.nfcSerialNumber}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Order ID</dt>
                <dd className="text-muted-foreground">{item.orderId}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Origin Information */}
        <Card>
          <CardHeader>
            <CardTitle>Origin Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium">Original Owner Name</dt>
                <dd className="text-muted-foreground">
                  {item.originalOwnerName}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Original Owner Email</dt>
                <dd className="text-muted-foreground">
                  {item.originalOwnerEmail}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Purchase Date</dt>
                <dd className="text-muted-foreground">
                  {formatDateTime(item.originalPurchaseDate)}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Purchased From</dt>
                <dd className="text-muted-foreground">{item.purchasedFrom}</dd>
              </div>
              <div>
                <dt className="font-medium">Manufacture Date</dt>
                <dd className="text-muted-foreground">
                  {formatDate(item.manufactureDate)}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Produced At</dt>
                <dd className="text-muted-foreground">{item.producedAt}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <BlockchainCard
          item={item}
          chainVerification={await verifyItemChain(db, item.id)}
          centered={false}
        />

        <NfcDataCard
          nfcLink={item.nfcLink}
          shortPath={item.shortUrls?.[0]?.shortPath}
          blockchainVersion={item.blockchainVersion}
          globalKeyVersion={item.globalKeyVersion}
        />

        {/* Ownership History */}
        <Card>
          <CardHeader>
            <CardTitle>Ownership History</CardTitle>
          </CardHeader>
          <CardContent>
            <OwnershipTable item={item} isAdmin={true} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
