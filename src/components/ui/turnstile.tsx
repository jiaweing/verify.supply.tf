"use client";

import { env } from "@/env.mjs";
import Turnstile from "react-turnstile";

interface TurnstileProps {
  onVerify: (token: string) => void;
}

export function TurnstileWidget({ onVerify }: TurnstileProps) {
  return (
    <div className="flex justify-center">
      <Turnstile
        sitekey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        onVerify={onVerify}
      />
    </div>
  );
}
