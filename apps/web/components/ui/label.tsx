import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Label — native-`<label>` variant (no `@radix-ui/react-label`
 * dependency; the primitive isn't needed for our current form layouts).
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
