import { getUserById, updateUserAdminState } from "@repo/db";
import { NotFoundError, updateUserSchema, ValidationError } from "@repo/shared";

import { auditContextFor } from "@/lib/audit";
import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin, resetResolveScopeCache } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    const target = await getUserById(ctx.db, id);
    if (!target) throw new NotFoundError("User", id);

    const audit = await auditContextFor(ctx.session);
    const result = await updateUserAdminState(
      ctx.db,
      id,
      {
        role: parsed.data.role,
        banned: parsed.data.banned,
        banReason: parsed.data.banReason ?? undefined,
      },
      audit,
    );

    // Role changes invalidate cached scope entries; without this the
    // next request from `id` could hit the old cached instanceRole (see
    // resolveScope memoization in `lib/session.ts`).
    if (result.roleChanged) resetResolveScopeCache(id);

    return Response.json({ ok: true, ...result });
  });
}
