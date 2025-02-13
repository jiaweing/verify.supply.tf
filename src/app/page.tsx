"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const verifySchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must be exactly 6 digits"),
  serialNumber: z
    .string()
    .min(1, "Serial number is required")
    .max(64, "Serial number must be less than 64 characters"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
});

type FormData = z.infer<typeof verifySchema>;

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const key = searchParams.get("key");
  const version = searchParams.get("version");

  React.useEffect(() => {
    async function verifyAndRedirect() {
      if (key && version) {
        try {
          const res = await fetch(
            `/api/items/verify?key=${key}&version=${version}`
          );
          const data = await res.json();

          if (res.ok) {
            router.push(
              `/items/${data.productId}/verify?key=${key}&version=${version}`
            );
          }
        } catch (err) {
          console.error("Error verifying link:", err);
          toast({
            title: "Error",
            description: "Invalid verification link",
            variant: "destructive",
          });
        }
      }
    }

    verifyAndRedirect();
  }, [key, version, router, toast]);

  const isNfcLink = key && version;

  const form = useForm<FormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      email: "",
      code: "",
      serialNumber: "",
      purchaseDate: new Date().toISOString().split("T")[0],
    },
  });

  const [step, setStep] = React.useState<"verify" | "code">("verify");

  async function onSubmit(values: FormData) {
    try {
      if (step === "verify") {
        // Request verification code
        const res = await fetch("/api/auth/request-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            serialNumber: values.serialNumber,
            purchaseDate: values.purchaseDate,
            key,
            version,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(
            error.message || "Failed to request verification code"
          );
        }

        toast({
          title: "Code sent",
          description: "Check your email for the verification code",
        });

        setStep("code");
      } else {
        // Verify code and get session
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            code: values.code,
            serialNumber: values.serialNumber,
            purchaseDate: values.purchaseDate,
            key,
            version,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to verify code");
        }

        const data = await res.json();
        router.push(`/items/${data.itemid}?session=${data.sessionToken}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Verification failed",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Verify Item</CardTitle>
          <CardDescription>
            {isNfcLink
              ? "Complete verification to view item details."
              : "Enter your item details to verify authenticity."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {step === "verify" ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-gray-500">Verifying link...</p>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-gray-500">Please wait...</p>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
