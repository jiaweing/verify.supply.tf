"use client";

import { getSessionAction } from "@/app/(auth)/admin/actions";
import { verifyNfcLink } from "@/app/items/verify/actions";
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
        const { session } = await getSessionAction();

        // Verify the NFC tag
        const formData = new FormData();
        formData.append("key", key);
        formData.append("version", version);

        // call verifyNfcLink function
        const item = await verifyNfcLink({ key, version });

        // If we have a valid session and matching item ID, redirect to item page
        if (session && session.itemId === item.productId) {
          router.push(`/items/${item.productId}`);
          return;
        }

        // For any other case, proceed to verification page
        router.push(
          `/items/${item.productId}/verify?key=${key}&version=${version}`
        );
      } catch (err) {
        console.error("Error verifying link:", err);
        setIsInvalid(true);
        toast.error("This link is invalid");
      }
    }

    verifyAndRedirect();
  }, [key, version, router]);

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
