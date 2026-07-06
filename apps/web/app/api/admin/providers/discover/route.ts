import { DiscoverError, discoverModels } from "@repo/ai";
import {
  discoverModelsSchema,
  parseWithSchema,
  ValidationError,
} from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { adminLimiter, rateLimitResponse, requestIp } from "@/lib/rate-limit";
import { requireInstanceAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `POST /api/admin/providers/discover` — probe an OpenAI-compatible
 * provider's `/v1/models` endpoint before saving it.
 *
 * Body: `{ provider, baseUrl?, apiKey? }`.
 *
 * Live network call proxied server-side so the browser never touches
 * the provider directly (avoids CORS + keeps the API key off the
 * client). `DiscoverError`s from `@repo/ai` are translated to
 * `ValidationError` with a code hint the UI branches on.
 */
export async function POST(request: Request) {
  return wrapRoute(async () => {
    const gate = adminLimiter.consume(await requestIp());
    if (!gate.ok) return rateLimitResponse(gate);

    await requireInstanceAdmin();
    const body = parseWithSchema(discoverModelsSchema, await request.json());

    try {
      const models = await discoverModels({
        provider: body.provider,
        baseUrl: body.baseUrl || null,
        apiKey: body.apiKey || null,
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
