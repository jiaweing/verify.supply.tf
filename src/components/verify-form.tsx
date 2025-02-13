"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const verifySchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().optional(),
  serialNumber: z
    .string()
    .min(1, "Serial number is required")
    .max(64, "Serial number must be less than 64 characters"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
});

type FormData = z.infer<typeof verifySchema>;

interface VerifyFormProps {
  defaultValues?: Partial<FormData>;
  encryptionKey?: string | null;
  version?: string | null;
  itemId?: string;
  onSuccess?: (data: { itemId: string; sessionToken: string }) => void;
}

export function VerifyForm({
  defaultValues,
  encryptionKey,
  version,
  itemId,
  onSuccess,
}: VerifyFormProps) {
  const effectiveKey = encryptionKey || undefined;
  const effectiveVersion = version || undefined;
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      email: "",
      code: "",
      serialNumber: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      ...defaultValues,
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
            key: effectiveKey,
            version: effectiveVersion,
            itemId,
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
        if (!values.code || values.code.length !== 6) {
          toast({
            title: "Error",
            description: "Please enter a valid 6-digit code",
            variant: "destructive",
          });
          return;
        }

        // Verify code and get session
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            code: values.code,
            serialNumber: values.serialNumber,
            purchaseDate: values.purchaseDate,
            key: effectiveKey,
            version: effectiveVersion,
            itemId,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to verify code");
        }

        const data = await res.json();
        if (onSuccess) {
          onSuccess(data);
        } else {
          router.push(`/items/${data.itemId}?session=${data.sessionToken}`);
        }
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
    <Form {...form}>
      <div className="space-y-4">
        {step === "verify" ? (
          <>
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter serial number"
                      {...field}
                      disabled={!!defaultValues?.serialNumber}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={!!defaultValues?.purchaseDate}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              className="w-full"
              onClick={form.handleSubmit(onSubmit)}
            >
              Verify
            </Button>
          </>
        ) : (
          <>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              className="w-full"
              onClick={form.handleSubmit(onSubmit)}
            >
              Submit Code
            </Button>
          </>
        )}
      </div>
    </Form>
  );
}
