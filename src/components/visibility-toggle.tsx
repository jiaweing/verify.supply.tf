"use client";

import {
  getVisibilityPreferencesAction,
  updateItemPreferencesAction,
} from "@/app/items/[id]/preferences/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface VisibilityToggleProps {
  email: string;
  itemId: string;
  sessionToken: string;
  onVisibilityChange?: (visible: boolean) => void;
}

export function VisibilityToggle({
  email,
  itemId,
  sessionToken,
  onVisibilityChange,
}: VisibilityToggleProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisibility = async () => {
      try {
        const preferences = await getVisibilityPreferencesAction([email]);
        setVisible(
          preferences.success ? preferences.data?.[email] ?? false : false
        );
      } catch (error) {
        console.error("Error fetching visibility:", error);
        toast.error("Failed to load visibility settings");
      } finally {
        setLoading(false);
      }
    };

    fetchVisibility();
  }, [email]);

  const handleToggle = async (checked: boolean) => {
    try {
      const result = await updateItemPreferencesAction(itemId, sessionToken, {
        showOwnershipHistory: checked,
      });
      if (!result.success) {
        toast.error(result.error);
      }

      setVisible(checked);
      onVisibilityChange?.(checked);

      toast.success(
        checked
          ? "Your information is now visible in ownership history"
          : "Your information is now hidden in ownership history"
      );
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update visibility settings"
      );
      // Revert the UI state if update failed
      setVisible(!checked);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="visibility-toggle"
        checked={visible}
        onCheckedChange={handleToggle}
      />
      <Label htmlFor="visibility-toggle">
        Show my name and email in all item histories
      </Label>
    </div>
  );
}
