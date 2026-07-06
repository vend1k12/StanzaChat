import {
  AesGcmKeyStore,
  DiscoverError,
  discoverModels,
  getProviderById,
} from "@repo/ai";
import {
  NotFoundError,
  parseEnv,
  ValidationError,
} from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `POST /api/admin/providers/:id/discover` — re-probe an existing
 * provider's `/v1/models` catalogue using its already-stored key.
 *
 * The Edit dialog uses this variant so admins never have to re-enter
 * the key just to refresh the model list. The plaintext key never
 * leaves this handler.
 */
export async function POST(
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

    let apiKey: string | null = null;
    if (provider.encryptedApiKey) {
      const keyStore = new AesGcmKeyStore(parseEnv().ENCRYPTION_MASTER_KEY);
      apiKey = await keyStore.decrypt({
        ciphertext: provider.encryptedApiKey,
        iv: provider.keyIv!,
        authTag: provider.keyTag!,
      });
    }

    try {
      const models = await discoverModels({
        provider: provider.provider,
        baseUrl: provider.baseUrl,
        apiKey,
      });
      return Response.json({ models });
    } catch (err) {
      if (err instanceof DiscoverError) {
        throw new ValidationError(err.message, { code: `discover.${err.code}` });
      }
      throw err;
    }
  });
}
