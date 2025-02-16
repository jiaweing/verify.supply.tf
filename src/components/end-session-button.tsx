"use client";

import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "./ui/button";

export function EndSessionButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleEndSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/logout", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to end session");
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
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Ending...
        </>
      ) : (
        <>
          <LogOut className="mr-2" /> End Session
        </>
      )}
    </Button>
  );
}
