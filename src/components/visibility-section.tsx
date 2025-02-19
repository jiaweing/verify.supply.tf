"use client";

import { VisibilityToggle } from "./visibility-toggle";

interface VisibilitySectionProps {
  email: string;
}

export function VisibilitySection({ email }: VisibilitySectionProps) {
  return (
    <VisibilityToggle
      email={email}
      onVisibilityChange={() => {
        window.location.reload();
      }}
    />
  );
}
