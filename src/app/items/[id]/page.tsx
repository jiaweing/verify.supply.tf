import { EndSessionButton } from "@/components/end-session-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { validateSession } from "@/lib/auth";
import { cookies } from "next/headers";
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
    <div className="container max-w-4xl py-10 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Item Verification</CardTitle>
          <CardDescription>
            This item has been verified as authentic
          </CardDescription>
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
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Origin Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
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

      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Ownership History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(item.ownershipHistory ?? []).map((history, index) => (
                <div
                  key={history.id}
                  className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{history.ownerName}</div>
                    <div className="text-sm text-gray-500">
                      {history.transferDate.toLocaleDateString()}
                    </div>
                  </div>
                  {index === 0 && (
                    <div className="text-sm font-medium text-green-600">
                      Current Owner
                    </div>
                  )}
                </div>
              ))}
              {(item.ownershipHistory ?? []).length === 0 && (
                <div className="text-center text-gray-500">
                  No ownership transfers yet
                </div>
              )}
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
