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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { db } from "@/db";
import { validateSession } from "@/lib/auth";
import { getCurrentOwner, verifyItemChain } from "@/lib/blockchain";
import { Link as Chain, ChevronLeft, Verified, X } from "lucide-react";
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
  let item = null;

  const paramsId = params.id;

  if (sessionToken) {
    const validatedItemId = await validateSession(sessionToken);

    if (validatedItemId) {
      // Make sure the validated item ID matches the requested item ID
      if (validatedItemId === paramsId) {
        isAuthenticated = true;
        item = await db.query.items.findFirst({
          where: (items, { eq }) => eq(items.id, paramsId),
          with: {
            userPreferences: true,
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
          },
        });
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
  const showHistory = item.userPreferences?.[0]?.showOwnershipHistory ?? true;

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
        <ItemImages sku={item.sku} />
        <h1 className="text-xl font-semibold capitalize">
          {item.sku.split("_")[0].toLowerCase()}
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
              <dd className="text-muted-foreground">{item.sku}</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">Mint Number</dt>
              <dd className="text-muted-foreground">#{item.mintNumber}</dd>
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
                {getCurrentOwner(item.transactions, item).currentOwnerName} (
                {getCurrentOwner(item.transactions, item).currentOwnerEmail})
              </dd>
            </div>
            <div>
              <dt className="font-medium">Last Transfer</dt>
              <dd className="text-muted-foreground">
                {getCurrentOwner(
                  item.transactions,
                  item
                ).lastTransferDate.toLocaleString()}
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
              <dt className="font-medium">Manufacture Date</dt>
              <dd className="text-muted-foreground">
                {item.manufactureDate.toLocaleDateString()}
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

      <Card className="text-center">
        <CardHeader>
          <CardTitle>Blockchain</CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              {chainVerification.isValid ? (
                <Button
                  variant="ghost"
                  className="text-green-600 font-semibold"
                >
                  <Verified className="h-4 w-4 mr-1" /> The chain is valid
                </Button>
              ) : (
                <Button variant="ghost" className="text-red-600 font-semibold">
                  <X className="h-4 w-4 mr-1" /> Invalid chain detected
                </Button>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-[600px]">
              <div className="space-y-4">
                <div>
                  {chainVerification.isValid ? (
                    <>
                      <h4 className="font-semibold text-green-600 flex items-center">
                        <Verified className="h-4 w-4 mr-1" /> Valid Chain
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        The blockchain hash chain is valid and has not been
                        tampered with.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-semibold text-red-600 flex items-center">
                        <X className="h-4 w-4 mr-1" /> Invalid Chain
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {chainVerification.error ? (
                          chainVerification.error.includes(
                            "Item data does not match"
                          ) ? (
                            <>
                              <span className="font-medium text-red-600">
                                Data Tampering Detected
                              </span>
                              <br />
                              The current owner information has been modified
                              outside of proper blockchain transactions. This
                              indicates unauthorized changes to the item&apos;s
                              data.
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-red-600">
                                Blockchain Error:
                              </span>
                              <br />
                              {chainVerification.error}
                            </>
                          )
                        ) : (
                          "Unknown verification error"
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex flex-row items-center gap-2">
                    Hash Comparison
                    <div className="text-xs font-mono break-all text-muted-foreground">
                      (generated at {new Date().toISOString()})
                    </div>
                  </h4>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          Creation Block
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Original)
                        </span>
                      </div>
                      <div className="text-xs font-mono break-all">
                        {item.creationBlock?.hash}
                      </div>
                    </div>
                    <div className="flex items-center justify-center relative">
                      <Chain className="text-muted-foreground py-1.5 absolute bg-background" />
                      <div className="w-px h-20 bg-muted" />
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          Latest Block
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Current)
                        </span>
                      </div>
                      <div className="text-xs font-mono break-all">
                        {item.latestTransaction?.block?.hash}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-8 text-center max-w-xl mx-auto">
            <div>
              <dt className="font-medium">Created At</dt>
              <dd className="text-muted-foreground">
                {item.createdAt.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Transfer Count</dt>
              <dd className="text-muted-foreground">
                {getCurrentOwner(item.transactions, item).transferCount}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardHeader>
          <CardTitle>Ownership History</CardTitle>
        </CardHeader>
        <CardContent>
          <OwnershipTable item={item} showHistory={showHistory} />
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <TransferItemButton itemId={item.id} />
        <EndSessionButton />
      </div>
    </div>
  );
}
