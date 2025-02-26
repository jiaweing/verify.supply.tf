"use client";

import { Badge } from "@/components/ui/badge";
import {
  type Block,
  type Item,
  type OwnershipTransfer,
  type Transaction,
} from "@/db/schema";
import { TransactionData } from "@/lib/blockchain";
import { formatDateTime } from "@/lib/date";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CancelTransferButton } from "./cancel-transfer-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

import {
  fetchVisibilityPreferences,
  maskInfo,
  shouldShowInfo,
} from "@/lib/visibility";

interface OwnershipTableProps {
  item: Item & {
    transactions: (Transaction & { block: Block | null })[];
    ownershipHistory: OwnershipTransfer[];
  };
  showHistory?: boolean;
  ownerEmail?: string;
  isAdmin?: boolean;
}

export function OwnershipTable({
  item,
  showHistory = true,
  ownerEmail,
  isAdmin = false,
}: OwnershipTableProps) {
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisibility = async () => {
      const emails = new Set<string>();
      // Add original owner
      emails.add(item.originalOwnerEmail);

      // Add all transfer emails
      item.transactions
        .filter((tx) => tx.transactionType === "transfer")
        .forEach((tx) => {
          const data = tx.data as { data: { to: { email: string } } };
          emails.add(data.data.to.email);
        });

      // Add pending transfer emails
      item.ownershipHistory
        .filter(
          (history) => !history.isConfirmed && new Date() < history.expiresAt
        )
        .forEach((history) => {
          emails.add(history.newOwnerEmail);
        });

      // Get visibility preferences using provided session token
      // Get actual visibility preferences from database
      const visibilityPrefs = await fetchVisibilityPreferences(
        Array.from(emails)
      );

      // For admin view, override all preferences to visible
      const finalPrefs = isAdmin
        ? Object.fromEntries(Array.from(emails).map((email) => [email, true]))
        : visibilityPrefs.data ?? {};

      setVisibilityMap(finalPrefs);
      setLoading(false);
    };

    fetchVisibility();
  }, [item]);

  if (!showHistory || loading) {
    return null;
  }

  if (!showHistory) {
    return null;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Owner Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Transfer Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* Original owner */}
        <TableRow>
          <TableCell>
            {shouldShowInfo(item.originalOwnerEmail, ownerEmail, visibilityMap)
              ? item.originalOwnerName
              : maskInfo(item.originalOwnerName)}
          </TableCell>
          <TableCell>
            {shouldShowInfo(item.originalOwnerEmail, ownerEmail, visibilityMap)
              ? item.originalOwnerEmail
              : maskInfo(item.originalOwnerEmail)}
          </TableCell>
          <TableCell>{formatDateTime(item.createdAt)}</TableCell>
          <TableCell>
            <Badge variant="secondary">Original</Badge>
          </TableCell>
          <TableCell className="h-20"></TableCell>
        </TableRow>

        {/* Confirmed transfers from blockchain */}
        {item.transactions
          .filter((tx) => tx.transactionType === "transfer")
          .map((tx) => {
            const data = tx.data as TransactionData;
            const isLatestTransfer =
              tx ===
              item.transactions
                .filter((t) => t.transactionType === "transfer")
                .at(-1);
            return (
              <TableRow key={tx.id}>
                <TableCell>
                  {shouldShowInfo(data.data.to.email, ownerEmail, visibilityMap)
                    ? data.data.to.name
                    : maskInfo(data.data.to.name)}
                </TableCell>
                <TableCell>
                  {shouldShowInfo(data.data.to.email, ownerEmail, visibilityMap)
                    ? data.data.to.email
                    : maskInfo(data.data.to.email)}
                </TableCell>
                <TableCell>{formatDateTime(tx.timestamp)}</TableCell>
                <TableCell>
                  {isLatestTransfer && <Badge variant="default">Current</Badge>}
                </TableCell>
                <TableCell className="h-20"></TableCell>
              </TableRow>
            );
          })}

        {/* Pending transfers */}
        {item.ownershipHistory
          .filter(
            (history) => !history.isConfirmed && new Date() < history.expiresAt
          )
          .map((history) => (
            <TableRow key={history.id}>
              <TableCell>
                {shouldShowInfo(
                  history.newOwnerEmail,
                  ownerEmail,
                  visibilityMap
                )
                  ? history.newOwnerName
                  : maskInfo(history.newOwnerName)}
              </TableCell>
              <TableCell>
                {shouldShowInfo(
                  history.newOwnerEmail,
                  ownerEmail,
                  visibilityMap
                )
                  ? history.newOwnerEmail
                  : maskInfo(history.newOwnerEmail)}
              </TableCell>
              <TableCell>{formatDateTime(history.createdAt)}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  <Loader2 className="animate-spin text-muted-foreground h-3 w-3 mr-1" />
                  Pending
                </Badge>
              </TableCell>
              <TableCell className="h-20">
                <CancelTransferButton
                  itemId={item.id}
                  transferId={history.id}
                />
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
