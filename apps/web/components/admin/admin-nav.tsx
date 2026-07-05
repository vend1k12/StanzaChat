"use client";

import {
  ClipboardList,
  KeyRound,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Sidebar nav for `/admin/*`. Serif section header + icon rail rows.
 * Rendered inside the layout's cream sidebar on desktop and as a
 * horizontal chip row in the mobile header (`variant="compact"`).
 */
interface Item {
  href: string;
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const items: Item[] = [
  {
    href: "/admin/providers",
    label: "Providers",
    hint: "LLM keys · models",
    icon: KeyRound,
  },
  {
    href: "/admin/users",
    label: "Users",
    hint: "Roles · access",
    icon: Users,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    hint: "Registration mode",
    icon: Settings,
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    hint: "Append-only",
    icon: ScrollText,
  },
];

export interface AdminNavProps {
  variant?: "sidebar" | "compact";
}

export function AdminNav({ variant = "sidebar" }: AdminNavProps) {
  const pathname = usePathname() ?? "";

  if (variant === "compact") {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-surface-cream-strong text-ink"
                  : "text-muted-ink hover:bg-surface-card hover:text-ink",
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      <p className="eyebrow p-2">Manage</p>
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition",
              active
                ? "bg-surface-cream-strong text-ink shadow-[inset_0_0_0_1px_rgba(20,20,19,0.05)]"
                : "text-body hover:bg-surface-card hover:text-ink",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-canvas",
                active && "border-coral/40 bg-coral/10 text-coral",
              )}
            >
              <item.icon className="size-4" />
            </span>
            <span className="flex flex-col leading-tight">
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-ink" : "text-body-strong",
                )}
              >
                {item.label}
              </span>
              <ClipboardList className="hidden" />
              <span className="text-[11px] text-muted-ink">{item.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
