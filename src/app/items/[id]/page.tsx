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
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Ownership History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-w-xl mx-auto">
              {(item.ownershipHistory ?? []).map((history, index) => (
                <div
                  key={history.id}
                  className="grid grid-cols-2 gap-4 items-center border-b last:border-0 pb-4 last:pb-0"
                >
                  <div className="text-center">
                    <div className="font-medium">{history.ownerName}</div>
                    <div className="text-sm text-gray-500">
                      {history.transferDate.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-center">
                    {index === 0 && (
                      <div className="text-sm font-medium text-green-600">
                        Current Owner
                      </div>
                    )}
                  </div>
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
