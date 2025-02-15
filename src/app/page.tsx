import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "@/components/verify-form";
import { validateSession } from "@/lib/auth";
import { ChevronRight, Clock } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function HomePage() {
  // Check for active session
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  let itemId = null;

  if (sessionToken) {
    itemId = await validateSession(sessionToken);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="space-y-4">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Verify Item</CardTitle>
            <CardDescription>
              Enter your item details to verify authenticity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerifyForm />
          </CardContent>
        </Card>

        {itemId && (
          <Card className="w-[400px]">
            <CardHeader>
              <CardTitle className="text-xl flex flex-row items-center space-x-2">
                <Clock className="h-5 w-5 text-muted-foreground" />{" "}
                <div>Recently Viewed</div>
              </CardTitle>
              <CardDescription>
                You are still logged in. Continue viewing your previously
                verified item.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/items/${itemId}`}>
                <Button className="w-full" variant="secondary">
                  Continue <ChevronRight />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
