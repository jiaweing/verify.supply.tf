import { Badge } from "@/components/ui/badge";
import {
  type Block,
  type Item,
  type OwnershipTransfer,
  type Transaction,
} from "@/db/schema";
import { TransactionData } from "@/lib/blockchain";
import { CancelTransferButton } from "./cancel-transfer-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface OwnershipTableProps {
  item: Item & {
    transactions: (Transaction & { block: Block | null })[];
    ownershipHistory: OwnershipTransfer[];
  };
  showHistory?: boolean;
}

export function OwnershipTable({
  item,
  showHistory = true,
}: OwnershipTableProps) {
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
          <TableCell>{item.originalOwnerName}</TableCell>
          <TableCell>{item.originalOwnerEmail}</TableCell>
          <TableCell>{item.createdAt.toLocaleString()}</TableCell>
          <TableCell>
            <Badge variant="secondary">Original</Badge>
          </TableCell>
          <TableCell></TableCell>
        </TableRow>

        {/* Confirmed transfers from blockchain */}
        {item.transactions
          .filter((tx) => tx.transactionType === "transfer")
          .map((tx) => {
            const data = tx.data as TransactionData;
            return (
              <TableRow key={tx.id}>
                <TableCell>{data.data.to.name}</TableCell>
                <TableCell>{data.data.to.email}</TableCell>
                <TableCell>{tx.timestamp.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="default">Current</Badge>
                </TableCell>
                <TableCell></TableCell>
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
              <TableCell>{history.newOwnerName}</TableCell>
              <TableCell>{history.newOwnerEmail}</TableCell>
              <TableCell>{history.createdAt.toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant="outline">Pending</Badge>
              </TableCell>
              <TableCell>
                <CancelTransferButton itemId={item.id} />
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
