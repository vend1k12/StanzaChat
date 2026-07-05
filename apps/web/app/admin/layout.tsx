import { can } from "@repo/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

/**
 * Server-side guard for the `/admin` segment (SPEC §5.5).
 *
 * Non-admin visitors are bounced — this is defence in depth: every
 * `/api/admin/*` route still enforces `requireInstanceAdmin` server
 * side (guardrails #7). Route Handler 403s remain the load-bearing
 * check; this redirect just avoids rendering an unreachable UI.
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
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b bg-muted/40 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Admin</h1>
            <p className="text-xs text-muted-foreground">
              Signed in as {session.user.email}
            </p>
          </div>
          <Link
            href="/chats"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to chats
          </Link>
        </div>
        <nav className="mt-3 flex gap-4 text-sm">
          <AdminNavLink href="/admin/providers" label="Providers" />
          <AdminNavLink href="/admin/users" label="Users" />
          <AdminNavLink href="/admin/settings" label="Settings" />
          <AdminNavLink href="/admin/audit" label="Audit log" />
        </nav>
      </header>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

function AdminNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
}
