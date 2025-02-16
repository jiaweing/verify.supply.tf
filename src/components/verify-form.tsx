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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
  onStepChange?: (step: "verify" | "code") => void;
}

export function VerifyForm({
  defaultValues,
  encryptionKey,
  version,
  itemId,
  onSuccess,
  onStepChange,
}: VerifyFormProps) {
  const effectiveKey = encryptionKey || undefined;
  const effectiveVersion = version || undefined;
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      email: defaultValues?.email || "",
      serialNumber: defaultValues?.serialNumber || "",
      purchaseDate:
        defaultValues?.purchaseDate || new Date().toISOString().split("T")[0],
      code: "", // Always initialize code as empty
    },
  });

  const [step, setStep] = React.useState<"verify" | "code">("verify");
  const [isLoading, setIsLoading] = React.useState(false);

  // Notify parent component of step changes
  React.useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  // Reset code field when switching steps
  React.useEffect(() => {
    if (step === "code") {
      form.setValue("code", "");
    }
  }, [step, form]);

  const [verifiedData, setVerifiedData] = React.useState<Partial<FormData>>({});

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      if (step === "verify") {
        // Store the verified data before requesting code
        setVerifiedData({
          email: values.email,
          serialNumber: values.serialNumber,
          purchaseDate: values.purchaseDate,
        });

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

        toast.success("Check your email for the verification code");

        setStep("code");
        setIsLoading(false);
      } else {
        if (!values.code || values.code.length !== 6) {
          toast.error("Please enter a valid 6-digit code");
          return;
        }

        // Verify code and get session
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: verifiedData.email!,
            code: values.code,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to verify code");
        }

        const data = await res.json();
        setIsLoading(false);
        if (onSuccess) {
          onSuccess(data);
        } else {
          const itemPath = itemId || data.item.id;
          router.push(`/items/${itemPath}`);
        }
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(
        error instanceof Error ? error.message : "Verification failed"
      );
    }
  }

  return (
    <Form {...form}>
      <div className="space-y-6">
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
                      disabled={!!defaultValues?.email}
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
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
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
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={field.value}
                        onChange={field.onChange}
                        render={({ slots }) => (
                          <>
                            <InputOTPGroup>
                              {slots.slice(0, 3).map((slot, index) => (
                                <InputOTPSlot
                                  key={index}
                                  index={index}
                                  {...slot}
                                  className="w-12 h-12 text-2xl"
                                />
                              ))}
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              {slots.slice(3, 6).map((slot, index) => (
                                <InputOTPSlot
                                  key={index + 3}
                                  index={index + 3}
                                  {...slot}
                                  className="w-12 h-12 text-2xl"
                                />
                              ))}
                            </InputOTPGroup>
                          </>
                        )}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              className="w-full"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Code"
              )}
            </Button>
          </>
        )}
      </div>
    </Form>
  );
}
