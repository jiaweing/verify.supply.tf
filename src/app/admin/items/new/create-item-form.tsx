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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

const itemSchema = z.object({
  serialNumber: z.string().min(1, "Serial number is required"),
  sku: z.string().min(1, "SKU is required"),
  weight: z.string().min(1, "Weight is required"),
  nfcSerialNumber: z.string().min(1, "NFC serial number is required"),
  orderId: z.string().min(1, "Order ID is required"),
  originalOwnerName: z.string().min(1, "Original owner name is required"),
  originalOwnerEmail: z.string().email("Invalid email address"),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchasedFrom: z.string().min(1, "Vendor name is required"),
  manufactureDate: z.string().min(1, "Manufacture date is required"),
  producedAt: z.string().min(1, "Production location is required"),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export function CreateItemForm() {
  const router = useRouter();
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      serialNumber: "",
      sku: "",
      weight: "",
      nfcSerialNumber: "",
      orderId: "",
      originalOwnerName: "",
      originalOwnerEmail: "",
      purchaseDate: new Date(
        new Date().getTime() - new Date().getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0],
      purchasedFrom: "WEBSITE",
      manufactureDate: new Date(
        new Date().getTime() - new Date().getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0],
      producedAt: "SINGAPORE",
    },
  });

  async function onSubmit(data: ItemFormValues) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (key === "purchaseDate" || key === "manufactureDate") {
        const date = new Date(value);
        formData.append(
          key,
          date.toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })
        );
      } else {
        formData.append(key, value);
      }
    });

    const response = await fetch("/api/items", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      form.setError("root", {
        message: error.message || "Something went wrong",
      });
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-8 max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Serial Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter S/N" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="Enter SKU" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight</FormLabel>
                <FormControl>
                  <Input placeholder="Enter weight" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nfcSerialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NFC Serial Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter NFC S/N" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter order ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="originalOwnerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Owner Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter owner name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="originalOwnerEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original Owner Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter owner email"
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
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="purchasedFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchased From</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEBSITE">WEBSITE</SelectItem>
                      <SelectItem value="SHOPEE">SHOPEE</SelectItem>
                      <SelectItem value="DIRECT">DIRECT</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="manufactureDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Manufacture Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="producedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Produced At</FormLabel>
                <FormControl>
                  <Input placeholder="Enter production location" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {form.formState.errors.root && (
          <div className="text-sm font-medium text-red-500">
            {form.formState.errors.root.message}
          </div>
        )}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Item"
          )}
        </Button>
      </form>
    </Form>
  );
}
