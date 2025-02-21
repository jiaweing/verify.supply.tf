"use client";

import {
  confirmTransfer,
  rejectTransfer,
} from "@/app/items/[id]/transfer/[transferId]/confirm/actions";
import { Loader2, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

interface TransferConfirmButtonsProps {
  id: string;
  transferId: string;
}

export function TransferConfirmButtons({
  id,
  transferId,
}: TransferConfirmButtonsProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const result = await confirmTransfer(id, transferId);
      if (result.success && "redirectTo" in result) {
        toast.success("Transfer confirmed. Redirecting you in a few seconds..");
        setTimeout(() => router.replace(result.redirectTo), 2000);
      } else if (!result.success && "error" in result) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(
        `Failed to confirm transfer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const result = await rejectTransfer(id, transferId);
      if (result.success) {
        toast.success("Transfer rejected");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(
        `Failed to reject transfer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="flex justify-center gap-4">
      <Button
        onClick={handleConfirm}
        disabled={isConfirming}
        className="bg-green-500 hover:bg-green-600"
      >
        {isConfirming ? (
          <div className="flex flex-row items-center justify-center gap-2">
            <Loader2 className="animate-spin" />
            Accepting...
          </div>
        ) : (
          <div className="flex flex-row items-center justify-center gap-2">
            <UserCheck /> Accept
          </div>
        )}
      </Button>

      <Button
        onClick={handleReject}
        disabled={isRejecting}
        className="hover:bg-red-600 bg-red-500"
      >
        {isRejecting ? (
          <>
            <Loader2 className="animate-spin" />
            Declining...
          </>
        ) : (
          <>
            <UserX /> Decline
          </>
        )}
      </Button>
    </div>
  );
}
