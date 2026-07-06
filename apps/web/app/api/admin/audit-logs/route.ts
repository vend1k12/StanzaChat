import { listAuditLogs } from "@repo/db";
import { auditLogsQuerySchema, parseWithSchema } from "@repo/shared";

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
    const query = parseWithSchema(
      auditLogsQuerySchema,
      Object.fromEntries(url.searchParams),
    );

    const { rows, total } = await listAuditLogs(ctx.db, {
      actorUserId: query.actorUserId,
      action: query.action,
      since: query.since,
      until: query.until,
      limit: query.limit,
      offset: query.offset,
    });

    return Response.json({
      logs: rows,
      total,
      limit: query.limit,
      offset: query.offset,
    });
  });
}
