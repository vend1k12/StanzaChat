import { deleteChat, getChat, updateChat } from "@repo/db";
import { NotFoundError, parseWithSchema, updateChatSchema } from "@repo/shared";

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
    const chat = await getChat(ctx.db, ctx.scope, id);
    if (!chat) {
      throw new NotFoundError("Chat", id);
    }
    return Response.json({ chat });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();
    const { id } = await params;
    const updates = parseWithSchema(updateChatSchema, await request.json());
    await updateChat(ctx.db, ctx.scope, id, updates);
    return Response.json({ ok: true });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();
    const { id } = await params;
    await deleteChat(ctx.db, ctx.scope, id);
    return Response.json({ ok: true });
  });
}
