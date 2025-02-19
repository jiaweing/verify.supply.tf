"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { env } from "../env.mjs";
import { Button } from "./ui/button";

interface CancelTransferButtonProps {
  itemId: string;
  transferId: string;
}

export function CancelTransferButton({
  itemId,
  transferId,
}: CancelTransferButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_APP_URL}/api/items/${itemId}/transfer`,
        {
          method: "DELETE",
          body: JSON.stringify({
            transferId,
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to cancel transfer");
      }

      toast.success("Transfer cancelled");
      router.refresh();
    } catch (error) {
      console.error("Failed to cancel transfer:", error);
      toast.error("Failed to cancel transfer");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-700"
      onClick={handleCancel}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <X className="w-4 h-4" />
      )}
    </Button>
  );
}
