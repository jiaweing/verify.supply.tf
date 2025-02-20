import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { series, skus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesForm } from "../series-form";
import { SkuForm } from "../sku-form";
import { createSku, updateSeries, updateSku } from "./actions";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const seriesData = await db.query.series.findFirst({
    where: eq(series.id, parseInt(params.id)),
  });

  if (!seriesData) {
    notFound();
  }

  return {
    title: `Edit Series: ${seriesData.name}`,
  };
}

export default async function EditSeriesPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const seriesData = await db.query.series.findFirst({
    where: eq(series.id, parseInt(params.id)),
  });

  if (!seriesData) {
    notFound();
  }

  const skusData = await db.query.skus.findMany({
    where: eq(skus.seriesId, parseInt(params.id)),
  });

  async function handleSeriesFormAction(formData: FormData) {
    "use server";
    formData.append("id", params.id);
    await updateSeries(formData);
  }

  async function handleSkuCreateAction(formData: FormData) {
    "use server";
    formData.append("seriesId", params.id);
    await createSku(formData);
  }

  function createSkuUpdateAction(skuId: number) {
    return async (formData: FormData) => {
      "use server";
      formData.append("seriesId", params.id);
      formData.append("id", skuId.toString());
      await updateSku(formData);
    };
  }

  return (
    <div className="grid grid-cols-1 gap-8 max-w-2xl">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Edit Series: {seriesData.name}
          </h1>
        </div>

        <SeriesForm initialData={seriesData} action={handleSeriesFormAction} />
      </div>

      <div className="space-y-6 lg:mt-[52px]">
        <h2 className="text-2xl font-bold">SKUs</h2>

        <SkuForm seriesId={params.id} action={handleSkuCreateAction} />

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Existing SKUs</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skusData.map((sku) => (
              <TableRow key={sku.id}>
                <TableCell>
                  <SkuForm
                    seriesId={params.id}
                    initialData={sku}
                    action={createSkuUpdateAction(sku.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
