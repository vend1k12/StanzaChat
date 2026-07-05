import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Two-column shell used by `/auth/sign-in` and `/auth/sign-up`.
 *
 * Left: warm cream brand panel with the Anthropic-style spike-mark,
 *       product framing, and a subtle terminal artifact preview.
 * Right: the form card on the plain canvas.
 *
 * Kept as a server component — the interactive form is passed in as
 * `children`. No client-only APIs here so the shell can prerender.
 */
export interface AuthShellProps {
  eyebrow: string;
  headline: ReactNode;
  lede: string;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  headline,
  lede,
  children,
}: AuthShellProps) {
  return (
    <main className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <aside className="relative hidden overflow-hidden bg-surface-soft lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link
          href="/"
          className="flex items-center gap-2 text-ink hover:opacity-80"
        >
          <span className="spike-mark" aria-hidden />
          <span className="font-display text-[22px] leading-none tracking-tight">
            StanzaChat
          </span>
        </Link>

        <div className="max-w-lg">
          <p className="eyebrow mb-6">{eyebrow}</p>
          <h1 className="font-display text-[52px] leading-[1.05] tracking-[-0.03em] text-ink">
            {headline}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-body">{lede}</p>
        </div>

        <div className="surface-dark max-w-md rounded-xl p-5 shadow-[0_20px_60px_-30px_rgba(20,20,19,0.35)]">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <span className="size-2 rounded-full bg-[#f0776e]" />
            <span className="size-2 rounded-full bg-[#f5c04a]" />
            <span className="size-2 rounded-full bg-[#5db872]" />
            <span className="ml-3 font-mono text-[10px] tracking-wider text-on-dark-soft">
              stanzachat › first-run
            </span>
          </div>
          <pre className="mt-4 font-mono text-[12px] leading-relaxed text-on-dark">
            {`$ docker compose up
✔  postgres ready
✔  migrations applied
✔  first user → instance admin
› ready on http://localhost:3000`}
          </pre>
        </div>
      </aside>

      <section className="flex flex-col justify-center bg-canvas px-6 py-16 lg:px-16">
        <div className="mx-auto flex w-full max-w-sm flex-col">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-ink hover:opacity-80 lg:hidden"
          >
            <span className="spike-mark" aria-hidden />
            <span className="font-display text-lg leading-none tracking-tight">
              StanzaChat
            </span>
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
