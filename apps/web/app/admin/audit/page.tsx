"use client";

import { AUDIT_ACTIONS } from "@repo/shared";
import { Filter, RefreshCcw } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuditLogs } from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const ALL_ACTIONS = "__all__";

const ACTION_TONE: Record<string, string> = {
  "provider.create": "text-accent-teal",
  "provider.update": "text-body",
  "provider.delete": "text-error",
  "settings.update": "text-accent-amber",
  "user.role_change": "text-coral",
  "user.ban": "text-error",
  "user.unban": "text-accent-teal",
};

/**
 * `/admin/audit` — SPEC §5.5.
 *
 * Read-only append-only viewer over `audit_logs` (guardrails #9). Filters
 * by actor / action / date range, offset pagination. Metadata rendered
 * as inline JSON on the navy code surface so it reads like structured
 * event data rather than styled prose.
 */
export default function AdminAuditPage() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState<string>(ALL_ACTIONS);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [offset, setOffset] = useState(0);

  const query = useAuditLogs({
    actorUserId: actor || undefined,
    action: action === ALL_ACTIONS ? undefined : action,
    since: since || undefined,
    until: until || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const total = query.data?.total ?? 0;
  const shown = query.data?.logs ?? [];
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  function resetFilters() {
    setActor("");
    setAction(ALL_ACTIONS);
    setSince("");
    setUntil("");
    setOffset(0);
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Instance · Audit log"
        title="Every admin action, forever"
        lede="Append-only record of provider, user, and settings mutations. Filter by actor, action, or date."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              disabled={
                !actor &&
                action === ALL_ACTIONS &&
                !since &&
                !until &&
                offset === 0
              }
            >
              <Filter className="size-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCcw
                className={cn("size-3.5", query.isFetching && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <section className="rounded-lg border border-hairline bg-surface-card p-5">
        <p className="eyebrow mb-4">Filters</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="actor">Actor user ID</Label>
            <Input
              id="actor"
              value={actor}
              placeholder="ulid…"
              onChange={(event) => {
                setActor(event.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="action">Action</Label>
            <Select
              value={action}
              onValueChange={(value) => {
                setAction(value);
                setOffset(0);
              }}
            >
              <SelectTrigger id="action">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ACTIONS}>Any</SelectItem>
                {AUDIT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="since">Since</Label>
            <Input
              id="since"
              type="datetime-local"
              value={since}
              onChange={(event) => {
                setSince(event.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="until">Until</Label>
            <Input
              id="until"
              type="datetime-local"
              value={until}
              onChange={(event) => {
                setUntil(event.target.value);
                setOffset(0);
              }}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-hairline bg-surface-dark text-on-dark shadow-[0_30px_70px_-40px_rgba(20,20,19,0.6)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
          <div>
            <p className="font-mono text-[11px] tracking-widest text-on-dark-soft uppercase">
              audit_logs
            </p>
            <p className="mt-1 text-sm text-on-dark">
              <span className="font-display text-[22px] leading-none tracking-tight">
                {total.toLocaleString()}
              </span>{" "}
              <span className="text-on-dark-soft">
                {total === 1 ? "row" : "rows"} · showing{" "}
                {shown.length === 0
                  ? "0"
                  : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}`}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              className="border-white/15 bg-transparent text-on-dark hover:bg-white/5 hover:text-on-dark"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              className="border-white/15 bg-transparent text-on-dark hover:bg-white/5 hover:text-on-dark"
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </header>

        {query.isLoading ? (
          <div className="p-10 text-center font-mono text-xs text-on-dark-soft">
            loading…
          </div>
        ) : query.error ? (
          <div className="p-10 text-center font-mono text-xs text-error">
            {query.error instanceof Error
              ? query.error.message
              : "Failed to load"}
          </div>
        ) : shown.length > 0 ? (
          <ul
            className="divide-y divide-white/5 font-mono text-[12px]"
            data-testid="audit-log-table"
          >
            {shown.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[minmax(0,180px)_minmax(0,220px)_minmax(0,180px)_minmax(0,180px)_minmax(0,1fr)] items-start gap-4 px-6 py-4 hover:bg-white/[0.02]"
                data-testid={`audit-row-${row.action}`}
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
                <span
                  className={cn(
                    "font-medium",
                    ACTION_TONE[row.action] ?? "text-on-dark",
                  )}
                >
                  {row.action}
                </span>
                <span className="text-on-dark-soft">
                  {row.targetType
                    ? `${row.targetType}/${row.targetId ?? "—"}`
                    : "—"}
                </span>
                <span className="break-words whitespace-pre-wrap text-on-dark-soft">
                  {row.metadata ? JSON.stringify(row.metadata) : ""}
                  {row.ip ? (
                    <span className="ml-2 rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] text-on-dark-soft">
                      ip {row.ip}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-10 text-center font-mono text-xs text-on-dark-soft">
            No rows match the current filters.
          </div>
        )}
      </section>
    </div>
  );
}
