"use client";

import { Loader2, Send } from "lucide-react";
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
      const res = await fetch(`/api/items/${itemId}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newOwnerName,
          newOwnerEmail,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to transfer item");
      }

      setIsOpen(false);
      toast.success(
        "Transfer invitation sent. The recipient will receive an email with instructions to accept ownership within 24 hours."
      );
      router.refresh();
    } catch (error) {
      console.error("Failed to transfer item:", error);
      toast.error("Failed to transfer item");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="mr-4">
          <Send className="mr-2" /> Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New Owner</DialogTitle>
          <DialogDescription>
            Enter the details of the person you want to transfer this item to.
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
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
