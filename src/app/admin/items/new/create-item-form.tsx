"use client";

import { createItemAction } from "@/app/admin/items/actions";
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
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  getSeriesAction as getAllSeries,
  getSeriesSkusAction as getSeriesSkus,
} from "../../series/actions";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Watch selected series for info display
  const selectedSeries = form.watch("seriesId");
  const seriesInfo =
    seriesList.find((s) => s.id === Number(selectedSeries)) || null;

  // Load series list on mount
  useEffect(() => {
    async function loadSeries() {
      const response = await getAllSeries();
      if (!response.success) {
        toast.error(response.error);
        return;
      }
      setSeriesList(response.data || []);
    }
    loadSeries();
  }, []);

  // Load SKUs when series is selected
  useEffect(() => {
    async function loadSkus() {
      if (selectedSeries) {
        const response = await getSeriesSkus(selectedSeries);
        if (!response.success) {
          toast.error(response.error);
          return;
        }
        setSkus(response.data || []);
      } else {
        setSkus([]);
      }
    }
    loadSkus();
  }, [selectedSeries]);

  async function onSubmit(data: ItemFormValues) {
    setIsSubmitting(true);
    try {
      const formData = new FormData();

      if (!data.purchaseDate || !data.manufactureDate) {
        toast.error("Date fields are required");
        return;
      }

      // Add all non-date fields
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "purchaseDate" && key !== "manufactureDate") {
          formData.append(key, value.toString());
        }
      });

      // Handle date fields with correct casing
      const purchaseDate = new Date(data.purchaseDate);
      const manufactureDate = new Date(data.manufactureDate);

      formData.append(
        "PurchaseDate",
        new Date(
          Date.UTC(
            purchaseDate.getFullYear(),
            purchaseDate.getMonth(),
            purchaseDate.getDate()
          )
        ).toISOString()
      );
      formData.append(
        "manufactureDate",
        new Date(
          Date.UTC(
            manufactureDate.getFullYear(),
            manufactureDate.getMonth(),
            manufactureDate.getDate()
          )
        ).toISOString()
      );

      const response = await createItemAction(formData);
      if (!response.success) {
        toast.error(response.error);
        return;
      }

      toast.success("Item created successfully");
      router.push("/admin");
      router.refresh();
    } catch (error) {
      console.error("Error creating item:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
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
