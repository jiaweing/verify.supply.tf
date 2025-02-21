"use client";

import { logoutAction } from "@/app/(auth)/admin/actions";
import { DoorOpen, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function EndSessionButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleEndSession = async () => {
    setIsLoading(true);
    try {
      const result = await logoutAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Failed to end session:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="destructive"
      onClick={handleEndSession}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          Ending...
        </>
      ) : (
        <>
          <DoorOpen className="mr-1" /> End Session
        </>
      )}
    </Button>
  );
}
