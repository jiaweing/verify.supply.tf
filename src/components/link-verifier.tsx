"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ScanFaceIcon, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";

interface LinkVerifierProps {
  onShowForm?: () => void;
}

export function LinkVerifier({ onShowForm }: LinkVerifierProps) {
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
          // First check if user is already authenticated
          const sessionRes = await fetch("/api/session");
          const sessionData = await sessionRes.json();

          if (sessionRes.ok && sessionData.itemId) {
            // If authenticated, redirect directly to item page
            router.push(`/items/${sessionData.itemId}`);
            return;
          }

          // Otherwise verify the NFC link
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

  if (!key || !version) return null;

  return (
    <div className="space-y-4 mt-6">
      <div className="flex flex-col items-center space-y-2 text-muted-foreground">
        {isInvalid ? (
          <>
            <div className="flex items-center space-x-2">
              <X className="w-4 h-4 text-red-500" />
              <p>This tag you scanned is invalid</p>
            </div>
            {onShowForm && (
              <Button variant="outline" onClick={onShowForm} className="mt-4">
                <ScanFaceIcon /> Try Manual Verification
              </Button>
            )}
          </>
        ) : (
          <div className="flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <p>Verifying...</p>
          </div>
        )}
      </div>
    </div>
  );
}
