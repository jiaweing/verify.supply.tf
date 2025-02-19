"use client";

import { AlertCircle, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { env } from "../env.mjs";
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
      const res = await fetch(
        `${env.NEXT_PUBLIC_APP_URL}/api/items/${itemId}/transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newOwnerName,
            newOwnerEmail,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to transfer item");
      }

      setIsOpen(false);
      toast.success(
        "Transfer invitation sent. The recipient will receive an email with instructions to accept ownership within 24 hours."
      );
      router.refresh();
    } catch (error) {
      console.error("Failed to transfer item:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to transfer item"
      );
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
          <p className="text-muted-foreground mt-2 justify-center text-xs items-center flex flex-row gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />{" "}
            <div>
              This is irreversible! Please double check before transferring.
            </div>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
