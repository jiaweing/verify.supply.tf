"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function EndSessionButton() {
  const router = useRouter();
  const handleEndSession = () => {
    // call the api
    fetch("/api/session", {
      method: "DELETE",
    });
    router.push("/");
  };

  return (
    <Button variant="outline" onClick={handleEndSession}>
      End Session
    </Button>
  );
}
