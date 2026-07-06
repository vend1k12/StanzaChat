import {
  getProviderById,
  getProviderModel,
  updateProviderModel,
} from "@repo/ai";
import {
  NotFoundError,
  parseWithSchema,
  updateProviderModelSchema,
} from "@repo/shared";

import { auditContextFor } from "@/lib/audit";
import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `PATCH /api/admin/providers/:id/models/:modelId` — update per-model
 * generation defaults (temperature, topP, maxOutputTokens,
 * systemPrompt, displayName, enabled).
 *
 * `modelId` in the URL is the provider-native model id (e.g.
 * `gpt-4o-mini`, not the internal row ULID) so admins can PATCH the
 * settings without an extra round-trip to resolve the row id.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; modelId: string }> },
) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();
    const { id, modelId } = await params;

    // Decode `modelId` — provider model ids can contain characters
    // (colons, slashes) that Next.js URI-encodes on the way in.
    const decodedModelId = decodeURIComponent(modelId);

    const provider = await getProviderById(ctx.db, id);
    if (!provider) throw new NotFoundError("Provider", id);

    const existing = await getProviderModel(ctx.db, id, decodedModelId);
    if (!existing) {
      throw new NotFoundError("ProviderModel", `${id}/${decodedModelId}`);
    }

    const updates = parseWithSchema(
      updateProviderModelSchema,
      await request.json(),
    );

    const audit = await auditContextFor(ctx.session);
    await updateProviderModel(ctx.db, id, decodedModelId, updates, audit);

    return Response.json({ ok: true });
  });
}
