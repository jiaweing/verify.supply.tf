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
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isInvalid, setIsInvalid] = React.useState(false);

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
          } else {
            setIsInvalid(true);
            toast({
              title: "Error",
              description: "This link is invalid",
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error("Error verifying link:", err);
          setIsInvalid(true);
          toast({
            title: "Error",
            description: "This link is invalid",
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
        {!isNfcLink && (
          <CardHeader>
            <CardTitle>Verify Item</CardTitle>
            <CardDescription>
              {isNfcLink
                ? "Complete verification to view item details."
                : "Enter your item details to verify authenticity."}
            </CardDescription>
          </CardHeader>
        )}
        <CardContent
          className={cn(
            isNfcLink &&
              "p-6 text-center text-muted-foreground flex items-center justify-center space-x-2"
          )}
        >
          {isNfcLink ? (
            <div className="flex items-center justify-center space-x-2">
              {isInvalid ? (
                <>
                  <X className="w-4 h-4 text-red-500" />
                  <p>This link is invalid</p>
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p>Verifying...</p>
                </>
              )}
            </div>
          ) : (
            <VerifyForm encryptionKey={key} version={version} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
