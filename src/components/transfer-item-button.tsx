"use client";

import { transferItem } from "@/app/items/[id]/transfer/actions";
import { AlertCircle, Forward, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface TransferItemButtonProps {
  itemId: string;
}

export function TransferItemButton({ itemId }: TransferItemButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [newOwnerName, setNewOwnerName] = React.useState("");
  const [newOwnerEmail, setNewOwnerEmail] = React.useState("");

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("itemId", itemId);
      formData.append("newOwnerName", newOwnerName);
      formData.append("newOwnerEmail", newOwnerEmail);

      const response = await transferItem(formData);
      if (!response.success) {
        toast.error(
          "error" in response ? response.error : "Failed to transfer item"
        );
        return;
      }

      setIsOpen(false);
      toast.success("Transfer invitation sent.", {
        description:
          "The recipient will receive an email with instructions to accept ownership within 24 hours.",
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to transfer item:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="mr-4">
          <Forward className="mr-1" /> Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New Owner</DialogTitle>
          <DialogDescription>
            They will receive an email invitation to accept ownership.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newOwnerName">New Owner Name</Label>
            <Input
              id="newOwnerName"
              required
              value={newOwnerName}
              onChange={(e) => setNewOwnerName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newOwnerEmail">New Owner Email</Label>
            <Input
              id="newOwnerEmail"
              type="email"
              required
              value={newOwnerEmail}
              onChange={(e) => setNewOwnerEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer"
            )}
          </Button>
          <div className="text-muted-foreground mt-2 justify-center text-xs items-center flex flex-row gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />{" "}
            <div>
              This is irreversible! Please double check before transferring.
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
