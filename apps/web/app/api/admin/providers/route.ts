import { AesGcmKeyStore, createProvider, listProviders } from "@repo/ai";
import { createProviderSchema, parseEnv, parseWithSchema } from "@repo/shared";

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
    const providers = await listProviders(ctx.db);
    return Response.json({ providers });
  });
}

export async function POST(request: Request) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    const ctx = await requireInstanceAdmin();
    const body = parseWithSchema(createProviderSchema, await request.json());

    // Encrypt API key if provided (SPEC §7).
    let encryptedApiKey;
    if (body.apiKey) {
      const keyStore = new AesGcmKeyStore(parseEnv().ENCRYPTION_MASTER_KEY);
      encryptedApiKey = await keyStore.encrypt(body.apiKey);
    }

    const audit = await auditContextFor(ctx.session);
    const id = await createProvider(
      ctx.db,
      {
        provider: body.provider,
        label: body.label,
        baseUrl: body.baseUrl || undefined,
        encryptedApiKey,
        models: body.models,
        isDefault: body.isDefault,
      },
      audit,
    );

    return Response.json({ id }, { status: 201 });
  });
}
