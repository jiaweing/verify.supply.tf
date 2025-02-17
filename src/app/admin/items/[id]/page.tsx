import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const item = await db.query.items.findFirst({
    where: (items, { eq }) => eq(items.id, id),
    with: {
      ownershipHistory: {
        orderBy: (history, { desc }) => [desc(history.createdAt)],
      },
      creationBlock: true,
      latestTransaction: {
        with: {
          block: true,
        },
      },
    },
  });

  if (!item) {
    notFound();
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
            <CardDescription>Basic item details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium">Serial Number</dt>
                <dd className="text-gray-500">{item.serialNumber}</dd>
              </div>
              <div>
                <dt className="font-medium">SKU</dt>
                <dd className="text-gray-500">{item.sku}</dd>
              </div>
              <div>
                <dt className="font-medium">Mint Number</dt>
                <dd className="text-gray-500">#{item.mintNumber}</dd>
              </div>
              <div>
                <dt className="font-medium">Weight</dt>
                <dd className="text-gray-500">{item.weight}</dd>
              </div>
              <div>
                <dt className="font-medium">NFC Serial Number</dt>
                <dd className="text-gray-500">{item.nfcSerialNumber}</dd>
              </div>
              <div>
                <dt className="font-medium">Order ID</dt>
                <dd className="text-gray-500">{item.orderId}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Origin Information */}
        <Card>
          <CardHeader>
            <CardTitle>Origin Information</CardTitle>
            <CardDescription>
              Original owner and purchase details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium">Original Owner Name</dt>
                <dd className="text-gray-500">{item.originalOwnerName}</dd>
              </div>
              <div>
                <dt className="font-medium">Original Owner Email</dt>
                <dd className="text-gray-500">{item.originalOwnerEmail}</dd>
              </div>
              <div>
                <dt className="font-medium">Purchase Date</dt>
                <dd className="text-gray-500">
                  {item.originalPurchaseDate.toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Purchased From</dt>
                <dd className="text-gray-500">{item.purchasedFrom}</dd>
              </div>
              <div>
                <dt className="font-medium">Manufacture Date</dt>
                <dd className="text-gray-500">
                  {item.manufactureDate.toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Produced At</dt>
                <dd className="text-gray-500">{item.producedAt}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Blockchain Data */}
        <Card>
          <CardHeader>
            <CardTitle>Blockchain Data</CardTitle>
            <CardDescription>Immutable blockchain information</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="font-medium">Creation Block Hash</dt>
                <dd className="text-gray-500 font-mono text-sm break-all">
                  {item.creationBlock?.hash}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Latest Block Hash</dt>
                <dd className="text-gray-500 font-mono text-sm break-all">
                  {item.latestTransaction?.block?.hash}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Previous Block Hash</dt>
                <dd className="text-gray-500 font-mono text-sm break-all">
                  {item.latestTransaction?.block?.previousHash}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Created At</dt>
                <dd className="text-gray-500">
                  {item.createdAt.toLocaleString()}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* NFC Data */}
        <Card>
          <CardHeader>
            <CardTitle>NFC Data</CardTitle>
            <CardDescription>NFC verification information</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4">
              <div>
                <dt className="font-medium">NFC Link</dt>
                <dd className="text-gray-500 font-mono text-sm break-all mt-1">
                  {item.nfcLink}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Item Encryption Key Hash</dt>
                <dd className="text-gray-500 font-mono text-sm break-all mt-1">
                  {item.itemEncryptionKeyHash}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Global Key Version</dt>
                <dd className="text-gray-500 font-mono text-sm mt-1">
                  {item.globalKeyVersion}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Ownership History */}
        <Card>
          <CardHeader>
            <CardTitle>Ownership History</CardTitle>
            <CardDescription>
              Complete history of ownership transfers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Transfer Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.ownershipHistory.length > 0 ? (
                  item.ownershipHistory.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell>{history.newOwnerName}</TableCell>
                      <TableCell>{history.newOwnerEmail}</TableCell>
                      <TableCell>
                        {history.createdAt.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-gray-500">
                      {item.originalOwnerName}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {item.originalOwnerEmail}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {item.createdAt.toLocaleString()}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
