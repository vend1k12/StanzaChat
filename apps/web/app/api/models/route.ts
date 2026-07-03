/**
 * GET /api/models — enabled models visible to the current user.
 *
 * See SPEC §6.
 */
import { listProviders } from "@repo/ai";

import { requireSessionScope } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  try {
    const allProviders = await listProviders(ctx.db);
    const providers = allProviders.filter((p) => p.enabled);
    return Response.json({ providers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list models";
    return Response.json(
      { error: { code: "internal_error", message } },
      { status: 500 },
    );
  }
}
