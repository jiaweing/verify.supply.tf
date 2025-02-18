"use client";

import { Button } from "@/components/ui/button";
import { Loader2, ScanFaceIcon, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

interface LinkVerifierProps {
  onShowForm?: () => void;
}

export function LinkVerifier({ onShowForm }: LinkVerifierProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isInvalid, setIsInvalid] = React.useState(false);

  const key = searchParams.get("key");
  const version = searchParams.get("version");

  React.useEffect(() => {
    async function verifyAndRedirect() {
      if (!key || !version) return;

      try {
        // Get current session data
        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();

        // Verify the NFC tag
        const verifyRes = await fetch(
          `/api/items/verify?key=${key}&version=${version}`
        );
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          setIsInvalid(true);
          toast.error("This link is invalid");
          return;
        }

        // If we have a valid session and matching item ID, redirect to item page
        if (sessionRes.ok && sessionData.itemId === verifyData.productId) {
          router.push(`/items/${verifyData.productId}`);
          return;
        }

        // For any other case, proceed to verification page
        router.push(
          `/items/${verifyData.productId}/verify?key=${key}&version=${version}`
        );
      } catch (err) {
        console.error("Error verifying link:", err);
        setIsInvalid(true);
        toast.error("This link is invalid");
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
