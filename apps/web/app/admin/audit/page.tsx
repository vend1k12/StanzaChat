"use client";

import { AUDIT_ACTIONS } from "@repo/shared";
import { Filter, RefreshCcw } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { ViewToggle } from "@/components/admin/view-toggle";
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
import { useUiStore } from "@/store/ui-store";

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
 * by actor / action / date range, offset pagination. Two view modes:
 * `table` (default) — dense, terminal-tinted rows; `cards` — one event
 * per card with metadata pretty-printed for forensic reads.
 */
export default function AdminAuditPage() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState<string>(ALL_ACTIONS);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [offset, setOffset] = useState(0);

  const viewMode = useUiStore((s) => s.adminViewMode.audit);
  const setViewMode = useUiStore((s) => s.setAdminViewMode);

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
            <ViewToggle
              value={viewMode}
              onChange={(mode) => setViewMode("audit", mode)}
              labels={{ cards: "Cards", table: "Table" }}
            />
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

      <section
        className={cn(
          "overflow-hidden rounded-2xl border shadow-[0_30px_70px_-40px_rgba(20,20,19,0.6)]",
          viewMode === "table"
            ? "border-hairline bg-surface-dark text-on-dark"
            : "border-hairline bg-canvas text-ink",
        )}
      >
        <header
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4",
            viewMode === "table"
              ? "border-white/5"
              : "border-hairline bg-surface-soft",
          )}
        >
          <div>
            <p
              className={cn(
                "font-mono text-[11px] tracking-widest uppercase",
                viewMode === "table" ? "text-on-dark-soft" : "text-muted-ink",
              )}
            >
              audit_logs
            </p>
            <p
              className={cn(
                "mt-1 text-sm",
                viewMode === "table" ? "text-on-dark" : "text-ink",
              )}
            >
              <span className="font-display text-[22px] leading-none tracking-tight">
                {total.toLocaleString()}
              </span>{" "}
              <span
                className={
                  viewMode === "table" ? "text-on-dark-soft" : "text-muted-ink"
                }
              >
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
              className={cn(
                viewMode === "table" &&
                  "border-white/15 bg-transparent text-on-dark hover:bg-white/5 hover:text-on-dark",
              )}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              className={cn(
                viewMode === "table" &&
                  "border-white/15 bg-transparent text-on-dark hover:bg-white/5 hover:text-on-dark",
              )}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </header>

        {query.isLoading ? (
          <div
            className={cn(
              "p-10 text-center font-mono text-xs",
              viewMode === "table" ? "text-on-dark-soft" : "text-muted-ink",
            )}
          >
            loading…
          </div>
        ) : query.error ? (
          <div className="p-10 text-center font-mono text-xs text-error">
            {query.error instanceof Error
              ? query.error.message
              : "Failed to load"}
          </div>
        ) : shown.length > 0 ? (
          viewMode === "table" ? (
            <ul
              className="divide-y divide-white/5 font-mono text-[12px]"
              data-testid="audit-log-table"
            >
              {shown.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[minmax(0,180px)_minmax(0,220px)_minmax(0,180px)_minmax(0,180px)_minmax(0,1fr)] items-start gap-4 px-6 py-3 hover:bg-white/[0.02]"
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
            <ul
              className="divide-y divide-hairline"
              data-testid="audit-log-table"
            >
              {shown.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 px-6 py-4 hover:bg-surface-soft/60"
                  data-testid={`audit-row-${row.action}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full bg-surface-card px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide",
                        ACTION_TONE[row.action] ?? "text-ink",
                      )}
                    >
                      {row.action}
                    </span>
                    <span className="font-mono text-[11px] text-muted-ink">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                    {row.ip ? (
                      <span className="rounded-sm bg-surface-cream-strong px-1.5 py-0.5 font-mono text-[10px] text-muted-ink">
                        ip {row.ip}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-[13px] md:grid-cols-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                        Actor
                      </span>
                      <span className="text-ink">
                        {row.actorEmail ?? "—"}
                        {row.actorUserId ? (
                          <span className="ml-2 font-mono text-[11px] text-muted-ink">
                            {row.actorUserId}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                        Target
                      </span>
                      <span className="text-ink">
                        {row.targetType
                          ? `${row.targetType}/${row.targetId ?? "—"}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                  {row.metadata ? (
                    <pre className="overflow-x-auto rounded-md bg-surface-dark px-3 py-2 font-mono text-[11px] leading-relaxed text-on-dark">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : (
          <div
            className={cn(
              "p-10 text-center font-mono text-xs",
              viewMode === "table" ? "text-on-dark-soft" : "text-muted-ink",
            )}
          >
            No rows match the current filters.
          </div>
        )}
      </section>
    </div>
  );
}
