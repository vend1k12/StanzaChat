import type { ReactNode } from "react";

/**
 * Editorial page header for admin pages: uppercase eyebrow, serif h1,
 * humanist sans lede, and an optional right-side actions slot.
 *
 * Server component — safe to import from admin page files (both server
 * and "use client").
 */
export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, lede, actions }: PageHeaderProps) {
  return (
    <header className="mb-10 flex flex-col gap-6 border-b border-hairline pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow mb-4">{eyebrow}</p>
        <h1 className="font-display text-[44px] leading-[1.05] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        {lede ? (
          <p className="mt-3 text-base leading-relaxed text-body">{lede}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
