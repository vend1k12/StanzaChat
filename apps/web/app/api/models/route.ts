/**
 * GET /api/models — enabled models visible to the current user.
 *
 * See SPEC §6.
 */
import { listProviders } from "@repo/ai";

import { wrapRoute } from "@/lib/http";
import { requireSessionScopeOrThrow } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();
    const allProviders = await listProviders(ctx.db);
    const providers = allProviders.filter((p) => p.enabled);
    return Response.json({ providers });
  });
}
