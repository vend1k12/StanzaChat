"use client";

import { LayoutGrid, Rows3 } from "lucide-react";

import { cn } from "@/lib/utils";
import { type AdminViewMode } from "@/store/ui-store";

/**
 * Segmented "Cards | Table" toggle used on admin list pages.
 *
 * Renders as two flush buttons on the warm-canvas sidebar surface with
 * a cream-strong pill highlighting the active mode. Keeps the accent
 * palette (`bg-surface-cream-strong`, `text-ink`) consistent with the
 * rest of the admin chrome.
 */
export interface ViewToggleProps {
  value: AdminViewMode;
  onChange: (next: AdminViewMode) => void;
  labels?: {
    cards?: string;
    table?: string;
  };
}

export function ViewToggle({ value, onChange, labels }: ViewToggleProps) {
  const cardsLabel = labels?.cards ?? "Cards";
  const tableLabel = labels?.table ?? "Table";
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex items-center gap-0.5 rounded-md border border-hairline bg-canvas p-0.5"
    >
      <ToggleButton
        active={value === "cards"}
        onClick={() => onChange("cards")}
        label={cardsLabel}
        icon={<LayoutGrid className="size-3.5" />}
      />
      <ToggleButton
        active={value === "table"}
        onClick={() => onChange("table")}
        label={tableLabel}
        icon={<Rows3 className="size-3.5" />}
      />
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}

function ToggleButton({ active, onClick, label, icon }: ToggleButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium transition",
        active
          ? "bg-surface-cream-strong text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          : "text-muted-ink hover:bg-surface-card hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
