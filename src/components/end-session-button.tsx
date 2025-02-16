"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function EndSessionButton() {
  const router = useRouter();
  const handleEndSession = () => {
    // call the api
    fetch("/api/logout", {
      method: "DELETE",
    });
    router.push("/");
  };

  return (
    <Button variant="destructive" onClick={handleEndSession}>
      <LogOut /> End Session
    </Button>
  );
}
