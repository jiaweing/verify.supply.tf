"use client";

import { VisibilityToggle } from "./visibility-toggle";

interface VisibilitySectionProps {
  email: string;
  itemId: string;
  sessionToken: string;
}

export function VisibilitySection({
  email,
  itemId,
  sessionToken,
}: VisibilitySectionProps) {
  return (
    <VisibilityToggle
      email={email}
      itemId={itemId}
      sessionToken={sessionToken}
      onVisibilityChange={() => {
        window.location.reload();
      }}
    />
  );
}
