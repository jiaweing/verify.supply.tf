import { BlockchainCard } from "@/components/blockchain-card";
import { EndSessionButton } from "@/components/end-session-button";
import { ItemImages } from "@/components/item-images";
import { OwnershipTable } from "@/components/ownership-table";
import { TransferItemButton } from "@/components/transfer-item-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VisibilitySection } from "@/components/visibility-section";
import { db } from "@/db";
import {
  type Block,
  type Item,
  type OwnershipTransfer,
  type Transaction,
} from "@/db/schema";
import { validateSession } from "@/lib/auth";
import { getCurrentOwner, verifyItemChain } from "@/lib/blockchain";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatMintNumber } from "@/lib/item";
import {
  fetchVisibilityPreferences,
  maskInfo,
  shouldShowInfo,
} from "@/lib/visibility";
import { ChevronLeft } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function ItemVerificationPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string; version?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // Check for active session
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  let isAuthenticated = false;
  type ItemWithRelations = Item & {
    transactions: (Transaction & { block: Block | null })[];
    ownershipHistory: OwnershipTransfer[];
    creationBlock: Block | null;
    latestTransaction: (Transaction & { block: Block | null }) | null;
    sku: {
      code: string;
      series: {
        name: string;
      };
    };
  };
  let item: ItemWithRelations | null = null;

  const paramsId = params.id;

  if (sessionToken) {
    const validatedItemId = await validateSession(sessionToken);

    if (validatedItemId) {
      // Make sure the validated item ID matches the requested item ID
      if (validatedItemId === paramsId) {
        isAuthenticated = true;
        const result = await db.query.items.findFirst({
          where: (items, { eq }) => eq(items.id, paramsId),
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
            transactions: {
              with: {
                block: true,
              },
            },
            sku: {
              with: {
                series: true,
              },
            },
          },
        });

        if (result) {
          item = result as ItemWithRelations;
        }
      }
    }
  }

  // Redirect to verification form if not authenticated
  if (!isAuthenticated) {
    const keyParam = searchParams.key ? `&key=${searchParams.key}` : "";
    const versionParam = searchParams.version
      ? `&version=${searchParams.version}`
      : "";
    redirect(
      `/items/${params.id}/verify?redirect=${params.id}${keyParam}${versionParam}`
    );
  }

  if (!item) {
    notFound();
  }

  // Verify blockchain chain
  const chainVerification = await verifyItemChain(db, item.id);
  const showHistory = true;

  const currentOwner = getCurrentOwner(item.transactions, item);
  const visibilityMap = await fetchVisibilityPreferences([
    item.originalOwnerEmail,
    currentOwner.currentOwnerEmail,
  ]);

  return (
    <div className="container max-w-4xl py-10 mx-auto space-y-6">
      <div className="w-full flex justify-start mb-4">
        <Link href="/">
          <Button variant="ghost">
            <ChevronLeft /> Back
          </Button>
        </Link>
      </div>
      <div className="flex flex-col justify-center items-center space-y-4">
        <ItemImages sku={item.sku.code} />
        <h1 className="text-xl font-semibold capitalize">
          {item.sku.series.name.toLowerCase()} {await formatMintNumber(item.id)}
        </h1>
      </div>
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div
              className={`w-24 h-24 rounded-full ${
                chainVerification.isValid ? "bg-green-100" : "bg-red-100"
              } flex items-center justify-center`}
            >
              {chainVerification.isValid ? (
                <svg
                  className="w-16 h-16 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-16 h-16 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
          </div>
          <CardTitle className="text-2xl">
            {chainVerification.isValid ? "Verified" : "Verification Failed"}
          </CardTitle>
          <CardDescription
            className={`text-lg ${
              chainVerification.isValid ? "text-green-600" : "text-red-600"
            }`}
          >
            {chainVerification.isValid
              ? "This item is original & authentic."
              : "This item's blockchain has been tampered with."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-8 text-center max-w-xl mx-auto">
            <div>
              <dt className="font-medium mb-1">Serial Number</dt>
              <dd className="text-muted-foreground">{item.serialNumber}</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">SKU</dt>
              <dd className="text-muted-foreground">{item.sku.code}</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">Mint Number</dt>
              <dd className="text-muted-foreground">
                {await formatMintNumber(item.id)}
              </dd>
            </div>
            <div>
              <dt className="font-medium mb-1">Weight</dt>
              <dd className="text-muted-foreground">{item.weight}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardHeader>
          <CardTitle>Current Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-8 text-center max-w-xl mx-auto">
            <div>
              <dt className="font-medium">Current Owner</dt>
              <dd className="text-muted-foreground">
                {shouldShowInfo(
                  getCurrentOwner(item.transactions, item).currentOwnerEmail,
                  getCurrentOwner(item.transactions, item).currentOwnerEmail,
                  visibilityMap
                )
                  ? `${
                      getCurrentOwner(item.transactions, item).currentOwnerName
                    } (${
                      getCurrentOwner(item.transactions, item).currentOwnerEmail
                    })`
                  : `${maskInfo(
                      getCurrentOwner(item.transactions, item).currentOwnerName
                    )} (${maskInfo(
                      getCurrentOwner(item.transactions, item).currentOwnerEmail
                    )})`}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Last Transfer</dt>
              <dd className="text-muted-foreground">
                {formatDateTime(
                  getCurrentOwner(item.transactions, item).lastTransferDate
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardHeader>
          <CardTitle>Origin Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-8 text-center max-w-xl mx-auto">
            <div>
              <dt className="font-medium">Original Owner</dt>
              <dd className="text-muted-foreground">
                {shouldShowInfo(
                  item.originalOwnerEmail,
                  getCurrentOwner(item.transactions, item).currentOwnerEmail,
                  visibilityMap
                )
                  ? `${item.originalOwnerName} (${item.originalOwnerEmail})`
                  : `${maskInfo(item.originalOwnerName)} (${maskInfo(
                      item.originalOwnerEmail
                    )})`}
              </dd>
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
            <div>
              <dt className="font-medium">Purchased From</dt>
              <dd className="text-muted-foreground">{item.purchasedFrom}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <BlockchainCard item={item} chainVerification={chainVerification} />

      <Card>
        <CardHeader className="text-center space-y-4">
          <CardTitle>Ownership History</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionToken && (
            <>
              <div className="mb-4">
                <VisibilitySection
                  email={
                    getCurrentOwner(item.transactions, item).currentOwnerEmail
                  }
                  itemId={params.id}
                  sessionToken={sessionToken}
                />
              </div>
              <OwnershipTable
                item={item}
                showHistory={showHistory}
                ownerEmail={currentOwner.currentOwnerEmail}
              />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <TransferItemButton itemId={item.id} />
        <EndSessionButton />
      </div>
    </div>
  );
}
