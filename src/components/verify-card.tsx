"use client";

import { LinkVerifier } from "@/components/link-verifier";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerifyForm } from "@/components/verify-form";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function VerifyCard() {
  const searchParams = useSearchParams();
  const hasNfcParams = searchParams.has("key") && searchParams.has("version");
  const [showForm, setShowForm] = useState(false);

  return (
    <Card>
      {(!hasNfcParams || showForm) && (
        <CardHeader>
          <CardTitle>Verify Item</CardTitle>
          <CardDescription>
            Enter your item details to verify authenticity.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {hasNfcParams ? (
            !showForm ? (
              <LinkVerifier onShowForm={() => setShowForm(true)} />
            ) : (
              <VerifyForm />
            )
          ) : (
            <VerifyForm />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
