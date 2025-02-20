import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { series } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function SeriesPage() {
  const seriesList = await db.query.series.findMany({
    orderBy: [desc(series.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Series</h1>
        <Button asChild>
          <Link href="/admin/series/new">
            <Plus /> New
          </Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {seriesList.map((series) => (
          <Card key={series.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-bold">
                {series.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/admin/series/${series.id}`}>Edit</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Series Number</p>
                  <p className="font-medium">#{series.seriesNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="font-medium">
                    {series.currentMintNumber} / {series.totalPieces} pieces
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {seriesList.length === 0 && (
          <div className="text-center text-muted-foreground">
            No series found.
          </div>
        )}
      </div>
    </div>
  );
}
