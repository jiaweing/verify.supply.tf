"use client";

import Footer from "@/components/footer";
import Header from "@/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "@/components/verify-form";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { verifyNfcLink } from "../../verify/actions";

export default function ItemVerifyPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const urlItemId = params.id as string;
  const [defaultValues, setDefaultValues] = useState<{
    itemId?: string;
    email?: string;
    serialNumber?: string;
  }>();
  const [isLoading, setIsLoading] = useState(true);
  const [verifyStep, setVerifyStep] = useState<"verify" | "code">("verify");

  const key = searchParams.get("key");
  const version = searchParams.get("version");

  // Handle initial loading state and parse encrypted key if present
  useEffect(() => {
    async function fetchItemDetails() {
      if (!key || !version) {
        setIsLoading(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("key", key);
        formData.append("version", version);
        const item = await verifyNfcLink({ key, version });

        setDefaultValues({
          itemId: item.productId,
          email: item.email,
          serialNumber: item.serialNumber,
        });
        // Keep the URL itemId for verification, but validate it matches the encrypted data
        if (item.productId !== urlItemId) {
          console.error("Verification failed");
          setIsLoading(false);
          return;
        }
      } catch {
        console.error("Verification process failed");
      } finally {
        setIsLoading(false);
      }
    }

    fetchItemDetails();
  }, [key, version, urlItemId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center flex-col gap-2 bg-background min-h-screen">
      <Header />
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>
            {verifyStep === "verify" ? "Verify Item" : "Check Your Email"}
          </CardTitle>
          <CardDescription>
            {verifyStep === "verify"
              ? "Complete verification to view item details"
              : "Enter the 6-digit code we sent to your email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyForm
            defaultValues={defaultValues}
            encryptionKey={key || undefined}
            version={version || undefined}
            itemId={urlItemId}
            onStepChange={setVerifyStep}
          />
        </CardContent>
      </Card>
      <Footer />
    </div>
  );
}
