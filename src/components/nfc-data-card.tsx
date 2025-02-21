"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/env.mjs";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface NfcDataCardProps {
  nfcLink: string;
  shortPath?: string;
  blockchainVersion: string;
  globalKeyVersion: string;
}

export function NfcDataCard({
  nfcLink,
  shortPath,
  blockchainVersion,
  globalKeyVersion,
}: NfcDataCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>NFC Data</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4">
          <div>
            <dt className="font-medium">NFC Link</dt>
            <dd className="text-muted-foreground font-mono text-sm break-all mt-1">
              <div className="flex items-center gap-2">
                <span>{nfcLink}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(nfcLink);
                    toast.success("NFC Link copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </dd>
          </div>
          {shortPath && (
            <div>
              <dt className="font-medium">Short URL</dt>
              <dd className="text-muted-foreground font-mono text-sm break-all mt-1">
                <div className="flex items-center gap-2">
                  <span>{`${env.NEXT_PUBLIC_APP_URL}/s/${shortPath}`}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${env.NEXT_PUBLIC_APP_URL}/s/${shortPath}`
                      );
                      toast.success("Short URL copied to clipboard");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </dd>
            </div>
          )}
          <div>
            <dt className="font-medium">Blockchain Version</dt>
            <dd className="text-muted-foreground font-mono text-sm break-all mt-1">
              {blockchainVersion}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Global Key Version</dt>
            <dd className="text-muted-foreground font-mono text-sm mt-1">
              {globalKeyVersion}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
