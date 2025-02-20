"use client";

import {
  requestVerificationCode,
  verifyCode,
} from "@/app/items/verify/actions";
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
import { TurnstileWidget } from "@/components/ui/turnstile";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Forward, Loader2 } from "lucide-react";
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
  turnstileToken: z.string().optional(),
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
      code: "", // Always initialize code as empty
      turnstileToken: "",
    },
  });

  const [step, setStep] = React.useState<"verify" | "code">("verify");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [verifiedData, setVerifiedData] = React.useState<Partial<FormData>>({});
  const [turnstileToken, setTurnstileToken] = React.useState<string>("");
  const [canResend, setCanResend] = React.useState(false);
  const [resendTimer, setResendTimer] = React.useState(60);

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

  // Start timer effect when entering code step
  React.useEffect(() => {
    if (step === "code") {
      setResendTimer(60);
      setCanResend(false);
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      if (step === "verify") {
        if (!turnstileToken) {
          toast.error("Please complete the CAPTCHA verification");
          setIsSubmitting(false);
          return;
        }

        // Store the verified data before requesting code
        setVerifiedData({
          email: values.email,
          serialNumber: values.serialNumber,
        });

        // Request verification code
        const formData = new FormData();
        formData.append("email", values.email);
        formData.append("serialNumber", values.serialNumber);
        if (effectiveKey) formData.append("key", effectiveKey);
        if (effectiveVersion) formData.append("version", effectiveVersion);
        if (itemId) formData.append("itemId", itemId);
        formData.append("turnstileToken", turnstileToken);

        await requestVerificationCode(formData);

        toast.success("Check your email for the verification code");
        setStep("code");
      } else {
        if (!values.code || values.code.length !== 6) {
          toast.error("Please enter a valid 6-digit code");
          return;
        }

        // Verify code and get session
        const formData = new FormData();
        formData.append("email", verifiedData.email!);
        formData.append("code", values.code);
        formData.append("productId", itemId!);

        await verifyCode(formData);
        if (onSuccess) {
          onSuccess({ itemId: itemId!, sessionToken: "verified" });
        } else {
          router.push(`/items/${itemId}`);
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    try {
      setIsResending(true);
      const formData = new FormData();
      formData.append("email", verifiedData.email!);
      formData.append("serialNumber", verifiedData.serialNumber!);
      if (effectiveKey) formData.append("key", effectiveKey);
      if (effectiveVersion) formData.append("version", effectiveVersion);
      if (itemId) formData.append("itemId", itemId);
      formData.append("turnstileToken", turnstileToken);

      await requestVerificationCode(formData);

      toast.success("New verification code sent to your email");
      setCanResend(false);
      setResendTimer(60);
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend code"
      );
    } finally {
      setIsResending(false);
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

            <TurnstileWidget onVerify={setTurnstileToken} />

            <Button
              type="button"
              className="w-full"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSubmitting || isResending}
            >
              {isSubmitting ? (
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

            <div className="space-y-1">
              <Button
                type="button"
                className="w-full"
                onClick={form.handleSubmit(onSubmit)}
                disabled={isSubmitting || isResending}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying code...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleResendCode}
                disabled={!canResend || isSubmitting || isResending}
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resending...
                  </>
                ) : canResend ? (
                  <div className="flex flex-row gap-2">
                    <Forward className="text-muted-foreground" />
                    Resend Code
                  </div>
                ) : (
                  `Resend Code (${resendTimer}s)`
                )}
              </Button>
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={() => setStep("verify")}
                >
                  <ChevronLeft /> Back
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Form>
  );
}
