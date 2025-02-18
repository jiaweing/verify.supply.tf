"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Monitor, Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        if (theme === "light") setTheme("dark");
        else if (theme === "dark") setTheme("system");
        else setTheme("light");
      }}
    >
      <Sun
        className={`h-[1.2rem] w-[1.2rem] transition-all ${
          theme === "light"
            ? "rotate-0 scale-100"
            : "absolute rotate-90 scale-0"
        }`}
      />
      <Moon
        className={`h-[1.2rem] w-[1.2rem] transition-all ${
          theme === "dark" ? "rotate-0 scale-100" : "absolute rotate-90 scale-0"
        }`}
      />
      <Monitor
        className={`h-[1.2rem] w-[1.2rem] transition-all ${
          theme === "system"
            ? "rotate-0 scale-100"
            : "absolute rotate-90 scale-0"
        }`}
      />
    </Button>
  );
}
