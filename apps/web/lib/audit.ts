import type { AuditContext } from "@repo/db";
import { headers } from "next/headers";

import type { Session } from "@/lib/session";

/**
 * Build an {@link AuditContext} for a Route Handler from the current
 * Better-Auth session and the incoming request headers.
 *
 * `x-forwarded-for` may carry a proxy chain — the client IP is the
 * left-most entry. `x-real-ip` is a common single-value fallback. When
 * neither is present we store `null` rather than a synthetic value so
 * downstream analytics can distinguish "not captured" from a real
 * address.
 *
 * Never surfaced to non-admin API consumers — the audit reader
 * (`/api/admin/audit-logs`) is gated by `requireInstanceAdmin`.
 */
export async function auditContextFor(session: Session): Promise<AuditContext> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  return { actorUserId: session.user.id, ip };
}
