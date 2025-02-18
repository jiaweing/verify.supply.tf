"use client";

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

export default function ItemVerifyPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const urlItemId = params.id as string;
  const [defaultValues, setDefaultValues] = useState<{
    email?: string;
    serialNumber?: string;
    purchaseDate?: string;
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
        const res = await fetch(
          `/api/items/verify?key=${key}&version=${version}`,
          {
            method: "GET",
          }
        );

        if (res.ok) {
          const data = await res.json();
          setDefaultValues({
            email: data.email,
            serialNumber: data.serialNumber,
            purchaseDate: data.purchaseDate,
          });
          // Keep the URL itemId for verification, but validate it matches the encrypted data
          if (data.productId !== urlItemId) {
            console.error("Item ID mismatch between URL and encrypted data");
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching item details:", err);
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
    <div className="flex items-center justify-center bg-background min-h-screen">
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
    </div>
  );
}
