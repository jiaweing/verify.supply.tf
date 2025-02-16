"use client";

import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/admin/logout", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to logout");
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Failed to logout:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Logging out...
        </>
      ) : (
        <>
          <LogOut className="mr-2" /> Logout
        </>
      )}
    </Button>
  );
}
