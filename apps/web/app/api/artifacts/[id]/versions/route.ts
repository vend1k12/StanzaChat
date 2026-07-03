import { listArtifactVersions } from "@repo/db";

import { requireSessionScope } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const versions = await listArtifactVersions(ctx.db, ctx.scope, id);
  if (versions === undefined) {
    return Response.json(
      { error: { code: "not_found", message: "Artifact not found" } },
      { status: 404 },
    );
  }
  return Response.json({ versions });
}
