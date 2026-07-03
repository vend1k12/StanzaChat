import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Skeleton — new-york style. Plain animated placeholder, no
 * Radix dependency.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}

export { Skeleton };
