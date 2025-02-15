"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "@/components/verify-form";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ItemVerifyPage() {
  const searchParams = useSearchParams();
  const [defaultValues, setDefaultValues] = useState<{
    email?: string;
    serialNumber?: string;
    purchaseDate?: string;
  }>();
  const [isLoading, setIsLoading] = useState(true);
  const [itemId, setItemId] = useState<string>();
  const [verifyStep, setVerifyStep] = useState<"verify" | "code">("verify");

  const key = searchParams.get("key");
  const version = searchParams.get("version");

  // Parse item details from encrypted key
  useEffect(() => {
    async function fetchItemDetails() {
      if (key && version) {
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
              purchaseDate: new Date(data.purchaseDate)
                .toISOString()
                .split("T")[0],
            });
            setItemId(data.productId);
          }
        } catch (err) {
          console.error("Error fetching item details:", err);
        } finally {
          setIsLoading(false);
        }
      }
    }

    fetchItemDetails();
  }, [key, version]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center bg-gray-100 min-h-screen">
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
            itemId={itemId}
            onStepChange={setVerifyStep}
          />
        </CardContent>
      </Card>
    </div>
  );
}
