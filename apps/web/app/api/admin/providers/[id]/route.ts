import {
  AesGcmKeyStore,
  deleteProvider,
  getProvider,
  updateProvider,
} from "@repo/ai";
import {
  NotFoundError,
  parseEnv,
  updateProviderSchema,
  ValidationError,
} from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
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
    const ctx = await requireInstanceAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateProviderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    // Encrypt API key if provided
    let encryptedApiKey;
    if (parsed.data.apiKey) {
      const keyStore = new AesGcmKeyStore(parseEnv().ENCRYPTION_MASTER_KEY);
      encryptedApiKey = await keyStore.encrypt(parsed.data.apiKey);
    }

    await updateProvider(ctx.db, id, {
      label: parsed.data.label,
      baseUrl: parsed.data.baseUrl || undefined,
      encryptedApiKey,
      enabledModels: parsed.data.enabledModels,
      isDefault: parsed.data.isDefault,
      enabled: parsed.data.enabled,
    });

    return Response.json({ ok: true });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const ctx = await requireInstanceAdmin();
    const { id } = await params;
    await deleteProvider(ctx.db, id);
    return Response.json({ ok: true });
  });
}
