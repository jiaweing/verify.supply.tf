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
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  seriesNumber: z.string().min(1, "Series number is required"),
  totalPieces: z.number().min(1, "Total pieces must be at least 1"),
});

type FormSchema = z.infer<typeof formSchema>;

interface SeriesFormProps {
  initialData?: {
    id: number;
    name: string;
    seriesNumber: string;
    totalPieces: number;
  };
  action?: (formData: FormData) => void;
  onSubmit?: (values: FormSchema) => void;
}

export function SeriesForm({ initialData, action, onSubmit }: SeriesFormProps) {
  const router = useRouter();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      seriesNumber: "",
      totalPieces: 1,
    },
  });

  const handleSubmit = async (values: FormSchema) => {
    try {
      if (action) {
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          formData.append(key, value.toString());
        });
        await Promise.resolve(action(formData));
      } else if (onSubmit) {
        await Promise.resolve(onSubmit(values));
      }
      router.push("/admin/series");
      router.refresh();
    } catch (error) {
      console.error("Error submitting form:", error);
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
          <Button type="submit">{initialData ? "Update" : "Create"}</Button>
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
