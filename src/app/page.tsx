"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "@/components/verify-form";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const key = searchParams.get("key");
  const version = searchParams.get("version");

  React.useEffect(() => {
    async function verifyAndRedirect() {
      if (key && version) {
        try {
          const res = await fetch(
            `/api/items/verify?key=${key}&version=${version}`
          );
          const data = await res.json();

          if (res.ok) {
            router.push(
              `/items/${data.productId}/verify?key=${key}&version=${version}`
            );
          }
        } catch (err) {
          console.error("Error verifying link:", err);
          toast({
            title: "Error",
            description: "Invalid verification link",
            variant: "destructive",
          });
        }
      }
    }

    verifyAndRedirect();
  }, [key, version, router, toast]);

  const isNfcLink = key && version;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Verify Item</CardTitle>
          <CardDescription>
            {isNfcLink
              ? "Complete verification to view item details."
              : "Enter your item details to verify authenticity."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isNfcLink ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-500">Verifying link...</p>
              </div>
            ) : (
              <VerifyForm key={key} version={version} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
