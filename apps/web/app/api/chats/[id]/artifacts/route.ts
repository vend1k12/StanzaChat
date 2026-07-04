import { listArtifactsForChat } from "@repo/db";
import { NotFoundError } from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { requireSessionScopeOrThrow } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();
    const { id } = await params;
    const artifacts = await listArtifactsForChat(ctx.db, ctx.scope, id);
    if (artifacts === undefined) {
      throw new NotFoundError("Chat", id);
    }
    return Response.json({ artifacts });
  });
}
