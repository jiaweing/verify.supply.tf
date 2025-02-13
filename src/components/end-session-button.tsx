"use client";

import { Button } from "./ui/button";

export function EndSessionButton() {
  const handleEndSession = () => {
    // call the api
    fetch("/api/session", {
      method: "DELETE",
    });
    window.location.reload();
  };

  return (
    <Button variant="outline" onClick={handleEndSession}>
      End Session
    </Button>
  );
}
