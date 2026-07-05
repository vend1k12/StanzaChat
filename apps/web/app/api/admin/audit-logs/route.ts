import { listAuditLogs } from "@repo/db";
import { auditLogsQuerySchema, ValidationError } from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/admin/audit-logs` — SPEC §6, §5.5.
 *
 * Read-only, admin-gated viewer over the append-only `audit_logs` table.
 * Query-string filters mirror `listAuditLogs`:
 *   ?actorUserId=&action=&since=&until=&limit=&offset=
 */
export async function GET(request: Request) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();

    const url = new URL(request.url);
    const parsed = auditLogsQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const { rows, total } = await listAuditLogs(ctx.db, {
      actorUserId: parsed.data.actorUserId,
      action: parsed.data.action,
      since: parsed.data.since,
      until: parsed.data.until,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    return Response.json({
      logs: rows,
      total,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  });
}
