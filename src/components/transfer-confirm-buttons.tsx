"use client";

import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";

interface RedirectError extends Error {
  digest?: string;
  message: string;
}

interface TransferConfirmButtonsProps {
  onConfirm: (formData: FormData) => Promise<void>;
  onReject: (formData: FormData) => Promise<void>;
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="bg-green-500 hover:bg-green-600"
      disabled={pending}
    >
      {pending ? "Accepting..." : "Accept"}
    </Button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      className="text-red-500 hover:text-red-600"
      disabled={pending}
    >
      {pending ? "Declining..." : "Decline"}
    </Button>
  );
}

async function onSubmitWithToast(
  formData: FormData,
  action: (formData: FormData) => Promise<void>,
  type: "accept" | "decline"
) {
  try {
    await action(formData);
    toast.success(
      type === "accept"
        ? "Transfer accepted successfully"
        : "Transfer declined successfully"
    );
  } catch (error) {
    // Allow redirect errors to propagate
    if (
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" ||
        (error as RedirectError).digest?.startsWith("NEXT_REDIRECT"))
    ) {
      throw error;
    }
    toast.error(
      type === "accept"
        ? "Failed to accept transfer"
        : "Failed to decline transfer"
    );
    throw error;
  }
}

export function TransferConfirmButtons({
  onConfirm,
  onReject,
}: TransferConfirmButtonsProps) {
  return (
    <div className="flex justify-center gap-4">
      <form
        action={async (formData: FormData) => {
          await onSubmitWithToast(formData, onConfirm, "accept");
        }}
      >
        <ConfirmButton />
      </form>
      <form
        action={async (formData: FormData) => {
          await onSubmitWithToast(formData, onReject, "decline");
        }}
      >
        <RejectButton />
      </form>
    </div>
  );
}
