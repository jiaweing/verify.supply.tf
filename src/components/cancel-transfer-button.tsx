"use client";

import { cancelTransfer } from "@/app/items/[id]/transfer/actions";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
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
      const formData = new FormData();
      formData.append("itemId", itemId);
      formData.append("transferId", transferId);

      const result = await cancelTransfer(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer invitation has been cancelled.");
      router.refresh();
    } catch (error) {
      console.error("Failed to cancel transfer:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel transfer"
      );
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
