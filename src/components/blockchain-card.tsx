import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Item } from "@/db/schema";
import { getCurrentOwner, type TransactionHistoryItem } from "@/lib/blockchain";
import { formatDateTime } from "@/lib/date";
import { AlertCircle, Link as Chain, Verified, X } from "lucide-react";

interface BlockchainCardProps {
  /** Set to false to left align content (default is center aligned) */
  centered?: boolean;
  item: Item & {
    creationBlock: { hash: string } | null;
    latestTransaction: { block: { hash: string } | null } | null;
    transactions: TransactionHistoryItem[];
  };
  chainVerification: { isValid: boolean; error?: string };
}

export function BlockchainCard({
  centered = true,
  item,
  chainVerification,
}: BlockchainCardProps) {
  return (
    <Card className={centered ? "text-center" : undefined}>
      <CardHeader>
        <CardTitle
          className={`flex flex-row ${centered ? "justify-center" : ""} gap-2`}
        >
          Blockchain
          <Popover>
            <PopoverTrigger asChild>
              {chainVerification.isValid ? (
                <Badge
                  variant="outline"
                  className=" border-green-500 bg-green-100 text-green-500"
                >
                  <Verified className="h-4 w-4 mr-1 fill-green-500 text-white" />{" "}
                  Valid
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className=" border-red-500 bg-red-100 text-red-500"
                >
                  <AlertCircle className="h-4 w-4 mr-1" /> Invalid
                </Badge>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-[600px]">
              <div className="space-y-4">
                <div>
                  {chainVerification.isValid ? (
                    <>
                      <h4 className="font-semibold text-green-600 flex items-center">
                        <Verified className="h-4 w-4 mr-1" /> Valid Chain
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        The blockchain hash chain is valid and has not been
                        tampered with.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="font-semibold text-red-600 flex items-center">
                        <X className="h-4 w-4 mr-1" /> Invalid Chain
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {chainVerification.error ? (
                          chainVerification.error.includes(
                            "Item data does not match"
                          ) ? (
                            <>
                              The current owner information has been modified
                              outside of proper blockchain transactions. This
                              indicates unauthorized changes to the item&apos;s
                              data.
                            </>
                          ) : (
                            <>{chainVerification.error}</>
                          )
                        ) : (
                          "Unknown verification error"
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex flex-row items-center gap-2">
                    Hash Comparison
                    <div className="text-xs font-mono break-all text-muted-foreground">
                      (generated at {formatDateTime(new Date())})
                    </div>
                  </h4>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          Creation Block
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Original)
                        </span>
                      </div>
                      <div className="text-xs font-mono break-all">
                        {item.creationBlock?.hash}
                      </div>
                    </div>
                    <div className="flex items-center justify-center relative">
                      <Chain className="text-muted-foreground py-1.5 absolute bg-background" />
                      <div className="w-px h-20 bg-muted" />
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="mb-1">
                        <span className="text-sm font-medium text-muted-foreground">
                          Latest Block
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Current)
                        </span>
                      </div>
                      <div className="text-xs font-mono break-all">
                        {item.latestTransaction?.block?.hash}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl
          className={`grid grid-cols-2 gap-8 ${
            centered ? "max-w-xl mx-auto" : ""
          }`}
        >
          <div>
            <dt className="font-medium">Created At</dt>
            <dd className="text-muted-foreground">
              {formatDateTime(item.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Transfer Count</dt>
            <dd className="text-muted-foreground">
              {getCurrentOwner(item.transactions, item).transferCount}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
