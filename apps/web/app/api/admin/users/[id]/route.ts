import { getUserById, updateUserAdminState } from "@repo/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  parseWithSchema,
  updateUserSchema,
} from "@repo/shared";

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

    const updates = parseWithSchema(updateUserSchema, await request.json());

    const target = await getUserById(ctx.db, id);
    if (!target) throw new NotFoundError("User", id);

    // Self-lockout guards: the acting admin must never be able to
    // demote or ban themselves out of the admin surface. Recovering
    // from either state requires direct DB access (see docs), so we
    // refuse the mutation up front rather than mine out the console.
    if (id === ctx.session.user.id) {
      if (updates.role !== undefined && updates.role !== "admin") {
        throw new ForbiddenError("You cannot demote yourself");
      }
      if (updates.banned === true) {
        throw new ForbiddenError("You cannot ban yourself");
      }
    }

    const audit = await auditContextFor(ctx.session);
    let result;
    try {
      result = await updateUserAdminState(
        ctx.db,
        id,
        {
          role: updates.role,
          banned: updates.banned,
          banReason: updates.banReason ?? undefined,
        },
        audit,
      );
    } catch (err) {
      if (err instanceof Error && err.message === "LAST_ADMIN") {
        throw new ConflictError(
          "Cannot demote the last instance admin. Promote another user first.",
        );
      }
      throw err;
    }

    // Role changes invalidate cached scope entries; without this the
    // next request from `id` could hit the old cached instanceRole (see
    // resolveScope memoization in `lib/session.ts`).
    if (result.roleChanged) resetResolveScopeCache(id);

    return Response.json({ ok: true, ...result });
  });
}
