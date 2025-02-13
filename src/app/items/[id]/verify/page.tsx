"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ItemVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState<string>();
  const [itemId, setItemId] = useState<string>();
  const [purchaseDate, setPurchaseDate] = useState<string>();
  const [serialNumber, setSerialNumber] = useState<string>();

  const key = searchParams.get("key");
  const version = searchParams.get("version");
  const step = searchParams.get("step");
  const email = searchParams.get("email");

  // Parse item details from encrypted key
  useEffect(() => {
    async function fetchItemDetails() {
      if (key && version) {
        try {
          const res = await fetch(
            `/api/items/verify?key=${key}&version=${version}`,
            {
              method: "GET",
            }
          );

          if (res.ok) {
            const data = await res.json();
            setDefaultEmail(data.email);
            setItemId(data.productId);
            setSerialNumber(data.serialNumber);
            setPurchaseDate(new Date(data.purchaseDate).toLocaleDateString());
          }
        } catch (err) {
          console.error("Error fetching item details:", err);
        }
      }
    }

    fetchItemDetails();
  }, [key, version]);

  async function onRequestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.append("action", "request-code");
    formData.append("productId", itemId!);

    try {
      const res = await fetch("/api/items/verify", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      // Redirect to code entry step
      const redirectParam = searchParams.get("redirect")
        ? `&redirect=${searchParams.get("redirect")}`
        : "";
      const keyParam = key ? `&key=${key}` : "";
      const versionParam = version ? `&version=${version}` : "";
      const emailParam = `&email=${encodeURIComponent(
        formData.get("email") as string
      )}`;

      router.push(
        `/items/${itemId}/verify?step=code${emailParam}${redirectParam}${keyParam}${versionParam}`
      );
    } catch (err: unknown) {
      console.error("Error requesting code:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.append("action", "verify-code");
    formData.append("productId", itemId!);
    formData.append("email", email!);

    try {
      const res = await fetch("/api/items/verify", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      // Redirect to item page
      router.push(`/items/${itemId}`);
    } catch (err: unknown) {
      console.error("Error verifying code:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const isCodeStep = step === "code";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="w-full max-w-lg px-4">
        <Card>
          <CardHeader>
            <CardTitle>Verify Item</CardTitle>
            <CardDescription className="space-y-2">
              {purchaseDate && !isCodeStep && (
                <p className="text-sm text-muted-foreground">
                  Purchase Date: {purchaseDate}
                </p>
              )}
              {serialNumber && !isCodeStep && (
                <p className="text-sm text-muted-foreground">
                  Serial Number: {serialNumber}
                </p>
              )}
              <p className="text-sm text-muted-foreground"></p>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 text-sm text-red-500" role="alert">
                {error}
              </div>
            )}

            {isCodeStep ? (
              <form onSubmit={onVerifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    name="code"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={onRequestCode} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    required
                    disabled={isLoading}
                    defaultValue={defaultEmail}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isCodeStep
                    ? "Enter the verification code sent to your email"
                    : "Enter your email to verify ownership"}
                </p>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Code"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
