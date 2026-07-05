import { listProviders } from "@repo/ai";
import { getInstanceSettings, listAuditLogs, listUsers } from "@repo/db";
import { getDb } from "@repo/db/client";
import { parseEnv } from "@repo/shared";
import {
  ArrowUpRight,
  KeyRound,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

/**
 * `/admin` — an at-a-glance dashboard summarising every panel. The
 * layout guard (`apps/web/app/admin/layout.tsx`) has already gated the
 * instance-admin permission, so this page can query the db directly.
 */
export default async function AdminIndexPage() {
  const db = getDb(parseEnv().DATABASE_URL);
  const [providers, users, settings, recent] = await Promise.all([
    listProviders(db),
    listUsers(db),
    getInstanceSettings(db),
    listAuditLogs(db, { limit: 5 }),
  ]);

  const defaultProvider = providers.find((p) => p.isDefault) ?? null;
  const admins = users.filter((u) => u.role === "admin").length;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Instance · Overview"
        title="Everything, at a glance"
        lede="A quick snapshot of your StanzaChat instance. Dive into any panel to make changes."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SummaryCard
          href="/admin/providers"
          icon={KeyRound}
          eyebrow="Providers"
          title={`${providers.length} configured`}
          detail={
            defaultProvider
              ? `Default · ${defaultProvider.label}`
              : "No default set yet"
          }
        />
        <SummaryCard
          href="/admin/users"
          icon={Users}
          eyebrow="Users"
          title={`${users.length} total`}
          detail={`${admins} instance admin${admins === 1 ? "" : "s"}`}
        />
        <SummaryCard
          href="/admin/settings"
          icon={Settings}
          eyebrow="Registration"
          title={settings?.registrationMode ?? "unknown"}
          detail={
            settings?.setupCompleted ? "Setup completed" : "First-run pending"
          }
        />
        <SummaryCard
          href="/admin/audit"
          icon={ScrollText}
          eyebrow="Audit log"
          title={`${recent.total.toLocaleString()} rows`}
          detail="Append-only — SPEC §5.5"
        />
      </section>

      <section className="rounded-2xl border border-hairline bg-surface-dark p-6 text-on-dark">
        <header className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-on-dark-soft uppercase">
              Recent activity
            </p>
            <p className="mt-1 font-display text-[24px] leading-tight tracking-tight text-on-dark">
              Latest audit rows
            </p>
          </div>
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-1 text-sm text-on-dark-soft hover:text-on-dark"
          >
            View all
            <ArrowUpRight className="size-3.5" />
          </Link>
        </header>
        {recent.rows.length > 0 ? (
          <ul className="mt-4 divide-y divide-white/5 font-mono text-[12px]">
            {recent.rows.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[minmax(0,180px)_minmax(0,220px)_minmax(0,1fr)] items-center gap-3 py-3"
              >
                <span className="text-on-dark-soft">
                  {new Date(row.createdAt)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 19)}
                </span>
                <span className="text-on-dark">
                  {row.actorEmail ?? row.actorUserId ?? "—"}
                </span>
                <span className="text-coral">{row.action}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 font-mono text-xs text-on-dark-soft">
            No audit rows yet. Actions will appear here as soon as they land.
          </p>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  href,
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-5 rounded-2xl border border-hairline bg-canvas p-6 transition hover:border-coral/40 hover:bg-surface-card"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-card text-body-strong transition group-hover:border-coral/30 group-hover:bg-coral/10 group-hover:text-coral">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{eyebrow}</p>
        <p className="mt-1 font-display text-[26px] leading-tight tracking-[-0.02em] text-ink">
          {title}
        </p>
        <p className="mt-1 text-sm text-muted-ink">{detail}</p>
      </div>
      <ArrowUpRight className="size-4 text-muted-ink transition group-hover:text-coral" />
    </Link>
  );
}
