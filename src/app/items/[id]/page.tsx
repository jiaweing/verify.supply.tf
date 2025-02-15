import { EndSessionButton } from "@/components/end-session-button";
import { ItemImages } from "@/components/item-images";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { validateSession } from "@/lib/auth";
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
  let item = null;

  if (sessionToken) {
    const itemId = await validateSession(sessionToken);
    console.log(itemId);
    if (itemId) {
      isAuthenticated = true;
      item = await db.query.items.findFirst({
        where: (items, { eq }) => eq(items.id, itemId),
        with: {
          userPreferences: true,
          ownershipHistory: {
            orderBy: (history, { desc }) => [desc(history.transferDate)],
          },
        },
      });
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
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
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
            </div>
          </div>
          <CardTitle className="text-2xl">Verified</CardTitle>
          <CardDescription className="text-lg">
            This item is original & authentic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-8 text-center max-w-xl mx-auto">
            <div>
              <dt className="font-medium mb-1">Serial Number</dt>
              <dd className="text-gray-500">{item.serialNumber}</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">SKU</dt>
              <dd className="text-gray-500">{item.sku}</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">Mint Number</dt>
              <dd className="text-gray-500">#{item.mintNumber}</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">Weight</dt>
              <dd className="text-gray-500">{item.weight}</dd>
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
              <dt className="font-medium">Name</dt>
              <dd className="text-gray-500">{item.currentOwnerName}</dd>
            </div>
            <div>
              <dt className="font-medium">Purchase Date</dt>
              <dd className="text-gray-500">
                {item.purchaseDate.toLocaleDateString()}
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
              <dd className="text-gray-500">{item.originalOwnerName}</dd>
            </div>
            <div>
              <dt className="font-medium">Original Owner Email</dt>
              <dd className="text-gray-500">{item.originalOwnerEmail}</dd>
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
            <div>
              <dt className="font-medium">Purchased From</dt>
              <dd className="text-gray-500">{item.purchasedFrom}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardHeader>
          <CardTitle>Blockchain Data</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-8 text-center max-w-xl mx-auto">
            <div>
              <dt className="font-medium">Block ID</dt>
              <dd className="text-gray-500 font-mono text-sm break-all">
                {item.blockId}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Current Block Hash</dt>
              <dd className="text-gray-500 font-mono text-sm break-all">
                {item.currentBlockHash}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Previous Block Hash</dt>
              <dd className="text-gray-500 font-mono text-sm break-all">
                {item.previousBlockHash}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Created At</dt>
              <dd className="text-gray-500">
                {item.createdAt.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Modified At</dt>
              <dd className="text-gray-500">
                {item.modifiedAt.toLocaleString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {showHistory && (
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Ownership History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xl mx-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left font-medium px-4 py-2">
                      Owner Name
                    </th>
                    <th className="text-left font-medium px-4 py-2">Email</th>
                    <th className="text-left font-medium px-4 py-2">
                      Transfer Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(item.ownershipHistory ?? []).map((history) => (
                    <tr key={history.id}>
                      <td className="px-4 py-2 text-gray-500">
                        {history.ownerName}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {history.ownerEmail}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {history.transferDate.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {(item.ownershipHistory ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-center text-gray-500 px-4 py-2"
                      >
                        No ownership transfers yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <EndSessionButton />
      </div>
    </div>
  );
}
