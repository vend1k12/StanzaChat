import { can } from "@repo/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { getSession } from "@/lib/session";

/**
 * Server-side guard for the `/admin` segment (SPEC §5.5).
 *
 * Non-admin visitors are bounced back to `/chats` — this is defence in
 * depth: every `/api/admin/*` route still enforces `requireInstanceAdmin`
 * (guardrails #7). Route Handler 403s remain load-bearing; this
 * redirect just avoids rendering an unreachable UI.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/sign-in?redirect=/admin");
  }
  const permitted = can(
    { instanceRole: session.user.role as "admin" | "user" },
    "provider.manage",
  );
  if (!permitted) {
    redirect("/chats");
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden border-r border-hairline bg-surface-soft lg:flex lg:flex-col">
        <div className="border-b border-hairline px-6 py-5">
          <Link
            href="/chats"
            className="flex items-center gap-2 text-ink hover:opacity-80"
          >
            <span className="spike-mark" aria-hidden />
            <span className="font-display text-[20px] leading-none tracking-tight">
              StanzaChat
            </span>
          </Link>
          <p className="eyebrow mt-4">Instance admin</p>
        </div>
        <AdminNav />
        <div className="mt-auto border-t border-hairline p-4">
          <AdminUserMenu
            email={session.user.email}
            name={session.user.name ?? null}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-hairline bg-canvas/70 px-8 py-4 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <Link
              href="/chats"
              className="rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-body-strong transition hover:bg-surface-card"
            >
              ← Back to chats
            </Link>
            <span className="hidden text-xs text-muted-ink sm:inline">
              Signed in as{" "}
              <span className="font-mono text-body">{session.user.email}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 lg:hidden">
            <AdminNav variant="compact" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 lg:px-10 lg:py-14">
          {children}
        </main>
      </div>
    </div>
  );
}
