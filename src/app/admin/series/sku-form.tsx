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
import { Sku } from "@/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const skuFormSchema = z.object({
  code: z.string().min(1, "SKU code is required"),
});

type SkuFormValues = z.infer<typeof skuFormSchema>;

type SkuFormProps = {
  action: (formData: FormData) => Promise<ActionResponse>;
  initialData?: Sku;
  seriesId: string;
};

interface ActionResponse {
  success: boolean;
  error?: string;
  data?: {
    code: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    seriesId: number;
  };
}

export function SkuForm({ action, initialData, seriesId }: SkuFormProps) {
  const router = useRouter();
  const form = useForm<SkuFormValues>({
    resolver: zodResolver(skuFormSchema),
    defaultValues: {
      code: initialData?.code || "",
    },
  });

  const handleSubmit = async (values: SkuFormValues) => {
    const formData = new FormData();
    formData.append("code", values.code);
    formData.append("seriesId", seriesId);
    try {
      await action(formData);
      if (!initialData) {
        form.reset();
      }

      toast.success("SKU saved successfully");
      return router.refresh();
    } catch (error) {
      console.error("Error submitting form:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU Code</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">{initialData ? "Update" : "Create"}</Button>
      </form>
    </Form>
  );
}
