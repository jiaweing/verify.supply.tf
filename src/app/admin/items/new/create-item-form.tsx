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
import { env } from "@/env.mjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Series {
  id: number;
  name: string;
  seriesNumber: string;
  totalPieces: number;
  currentMintNumber: number;
}

const itemSchema = z.object({
  seriesId: z.number().min(1, "Series is required"),
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
      // Default to today in local time
      purchaseDate: new Date().toLocaleDateString("en-CA"),
      purchasedFrom: "WEBSITE",
      manufactureDate: new Date().toLocaleDateString("en-CA"),
      producedAt: "SINGAPORE",
    },
  });

  interface Sku {
    id: number;
    code: string;
    seriesId: number;
  }

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);

  // Watch selected series for info display
  const selectedSeries = form.watch("seriesId");
  const seriesInfo =
    seriesList.find((s) => s.id === Number(selectedSeries)) || null;

  // Fetch series list on mount
  useEffect(() => {
    fetch("/api/series/all")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setSeriesList(data);
        }
      })
      .catch((error) => {
        console.error("Error fetching series list:", error);
      });
  }, []);

  // Fetch SKUs when series is selected
  useEffect(() => {
    if (selectedSeries) {
      fetch(`${env.NEXT_PUBLIC_APP_URL}/api/series/${selectedSeries}/skus`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setSkus(data);
          }
        })
        .catch((error) => {
          console.error("Error fetching SKUs:", error);
        });
    } else {
      setSkus([]);
    }
  }, [selectedSeries]);

  async function onSubmit(data: ItemFormValues) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      // Convert all values to strings
      const stringValue = value.toString();

      // Convert dates to UTC for API
      if (key === "purchaseDate" || key === "manufactureDate") {
        const date = new Date(stringValue);
        const utcDate = new Date(
          Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
        );
        formData.append(key, utcDate.toISOString());
      } else {
        formData.append(key, stringValue);
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <FormField
              control={form.control}
              name="seriesId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Series</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value?.toString()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select series" />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesList.map((series) => (
                          <SelectItem
                            key={series.id}
                            value={series.id.toString()}
                          >
                            {series.name} (#{series.seriesNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {seriesInfo && (
            <div className="rounded-lg border p-4 bg-muted">
              <h3 className="text-lg font-semibold mb-2">Series Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Mint</p>
                  <p className="font-medium">
                    {seriesInfo.currentMintNumber} / {seriesInfo.totalPieces}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Series Number</p>
                  <p className="font-medium">#{seriesInfo.seriesNumber}</p>
                </div>
              </div>
            </div>
          )}

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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedSeries || skus.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {skus.map((sku) => (
                          <SelectItem key={sku.id} value={sku.code}>
                            {sku.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
