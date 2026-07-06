import {
  AesGcmKeyStore,
  deleteProvider,
  getProvider,
  updateProvider,
} from "@repo/ai";
import {
  NotFoundError,
  parseEnv,
  parseWithSchema,
  updateProviderSchema,
} from "@repo/shared";

import { auditContextFor } from "@/lib/audit";
import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);
    const ctx = await requireInstanceAdmin();
    const { id } = await params;
    const provider = await getProvider(ctx.db, id);
    if (!provider) {
      throw new NotFoundError("Provider", id);
    }
    return Response.json({ provider });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();
    const { id } = await params;
    const updates = parseWithSchema(
      updateProviderSchema,
      await request.json(),
    );

    // Verify the target exists so we return 404 instead of a silent no-op.
    const existing = await getProvider(ctx.db, id);
    if (!existing) throw new NotFoundError("Provider", id);

    // Encrypt API key if provided.
    let encryptedApiKey;
    if (updates.apiKey) {
      const keyStore = new AesGcmKeyStore(parseEnv().ENCRYPTION_MASTER_KEY);
      encryptedApiKey = await keyStore.encrypt(updates.apiKey);
    }

    const audit = await auditContextFor(ctx.session);
    await updateProvider(
      ctx.db,
      id,
      {
        label: updates.label,
        baseUrl: updates.baseUrl || undefined,
        encryptedApiKey,
        models: updates.models,
        isDefault: updates.isDefault,
        enabled: updates.enabled,
      },
      audit,
    );

    return Response.json({ ok: true });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();
    const { id } = await params;

    const existing = await getProvider(ctx.db, id);
    if (!existing) throw new NotFoundError("Provider", id);

    const audit = await auditContextFor(ctx.session);
    await deleteProvider(ctx.db, id, audit);
    return Response.json({ ok: true });
  });
}
