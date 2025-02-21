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
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  seriesNumber: z.string().min(1, "Series number is required"),
  totalPieces: z.number().min(1, "Total pieces must be at least 1"),
});

type FormSchema = z.infer<typeof formSchema>;

interface ActionResponse {
  success: boolean;
  error?: string;
  data?: {
    id: number;
    name: string;
    seriesNumber: string;
    totalPieces: number;
  };
}

interface SeriesFormProps {
  initialData?: {
    id: number;
    name: string;
    seriesNumber: string;
    totalPieces: number;
  };
  action?: (formData: FormData) => Promise<ActionResponse>;
  onSubmit?: (values: FormSchema) => void;
}

export function SeriesForm({ initialData, action, onSubmit }: SeriesFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      seriesNumber: "",
      totalPieces: 1,
    },
  });

  const handleSubmit = async (values: FormSchema) => {
    setIsSubmitting(true);
    try {
      if (action) {
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          formData.append(key, value.toString());
        });
        const response = await action(formData);
        if (!response.success) {
          toast.error(response.error || "Failed to save series");
          return;
        }
        toast.success(initialData ? "Series updated" : "Series created");
        return initialData ? router.refresh() : router.push("/admin/series");
      } else if (onSubmit) {
        await Promise.resolve(onSubmit(values));
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-8 max-w-2xl"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Series name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="seriesNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Series Number</FormLabel>
              <FormControl>
                <Input placeholder="Series number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalPieces"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Pieces</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  placeholder="Total number of pieces"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {initialData ? "Updating..." : "Creating..."}
              </>
            ) : initialData ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/series")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
