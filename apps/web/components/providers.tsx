"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { ConfirmProvider } from "@/components/confirm-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

/**
 * Client-side provider tree composed once at the root layout.
 *
 * Ordering rationale:
 * - `QueryClientProvider` is outermost so every descendant (incl. theme
 *   toast callbacks) can access the query cache.
 * - `ThemeProvider` (next-themes) sets the `class` strategy so the
 *   `.dark` variant in `globals.css` toggles token palettes; hydration
 *   mismatch is suppressed at `<html>` in the root layout.
 * - `Toaster` is mounted inside the theme scope so sonner inherits the
 *   active theme via `next-themes`'s `useTheme`.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <ConfirmProvider>{children}</ConfirmProvider>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
