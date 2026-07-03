import { deleteChat, getChat, updateChat } from "@repo/db";
import { updateChatSchema } from "@repo/shared";

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
  const chat = await getChat(ctx.db, ctx.scope, id);
  if (!chat) {
    return Response.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 },
    );
  }
  return Response.json({ chat });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateChatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }

  await updateChat(ctx.db, ctx.scope, id, parsed.data);
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  await deleteChat(ctx.db, ctx.scope, id);
  return Response.json({ ok: true });
}
