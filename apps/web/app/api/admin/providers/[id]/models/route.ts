import { getProviderById, listProviderModels } from "@repo/ai";
import { NotFoundError } from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/admin/providers/:id/models` — list per-model settings for
 * the provider identified by `:id`. Used by the Edit dialog to render
 * the nested per-model editor.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();
    const { id } = await params;

    const provider = await getProviderById(ctx.db, id);
    if (!provider) throw new NotFoundError("Provider", id);

    const models = await listProviderModels(ctx.db, id);
    return Response.json({ models });
  });
}
