import { getInstanceSettings, updateInstanceSettings } from "@repo/db";
import { parseWithSchema, updateSettingsSchema } from "@repo/shared";

import { auditContextFor } from "@/lib/audit";
import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);
    const ctx = await requireInstanceAdmin();
    const settings = await getInstanceSettings(ctx.db);
    return Response.json({ settings });
  });
}

export async function PATCH(request: Request) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();
    const updates = parseWithSchema(updateSettingsSchema, await request.json());

    const audit = await auditContextFor(ctx.session);
    await updateInstanceSettings(
      ctx.db,
      { registrationMode: updates.registrationMode },
      audit,
    );

    return Response.json({ ok: true });
  });
}
