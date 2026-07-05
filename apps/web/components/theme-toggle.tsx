"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal theme toggle — sun/moon icon button. Uses `next-themes`
 * `useTheme` so the toggle works regardless of where it lives in the
 * component tree. Avoids hydration flicker by rendering nothing until
 * the theme is mounted client-side.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md",
          className,
        )}
      />
    );
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-ink transition hover:bg-surface-card hover:text-ink",
        className,
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
