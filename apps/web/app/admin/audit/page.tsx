"use client";

import { AUDIT_ACTIONS } from "@repo/shared";
import { useState } from "react";

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

const PAGE_SIZE = 50;
const ALL_ACTIONS = "__all__";

/**
 * `/admin/audit` — SPEC §5.5.
 *
 * Read-only audit-log viewer with filters (actor, action, date range)
 * and offset pagination. Rows are immutable (guardrails #9).
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold">Filters</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label htmlFor="actor">Actor user ID</Label>
            <Input
              id="actor"
              value={actor}
              placeholder="ulid"
              onChange={(event) => {
                setActor(event.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div>
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
          <div>
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
          <div>
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

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Audit log{" "}
            <span className="text-xs text-muted-foreground">
              ({total} rows)
            </span>
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Prev
            </Button>
            <span className="text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : query.error ? (
          <p className="text-sm text-destructive">
            {query.error instanceof Error
              ? query.error.message
              : "Failed to load"}
          </p>
        ) : shown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="audit-log-table">
              <thead className="text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="pb-2">When</th>
                  <th className="pb-2">Actor</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Target</th>
                  <th className="pb-2">IP</th>
                  <th className="pb-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t align-top"
                    data-testid={`audit-row-${row.action}`}
                  >
                    <td className="py-2 font-mono text-xs">
                      {new Date(row.createdAt).toISOString()}
                    </td>
                    <td className="py-2 text-xs">
                      {row.actorEmail ?? row.actorUserId ?? "—"}
                    </td>
                    <td className="py-2 font-mono text-xs">{row.action}</td>
                    <td className="py-2 font-mono text-xs">
                      {row.targetType
                        ? `${row.targetType}/${row.targetId ?? ""}`
                        : "—"}
                    </td>
                    <td className="py-2 font-mono text-xs">{row.ip ?? "—"}</td>
                    <td className="py-2 font-mono text-xs">
                      <pre className="text-xs break-words whitespace-pre-wrap">
                        {row.metadata ? JSON.stringify(row.metadata) : "—"}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No matching rows.</p>
        )}
      </section>
    </div>
  );
}
