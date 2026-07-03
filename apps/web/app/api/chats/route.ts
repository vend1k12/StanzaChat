import { createChat, listChats } from "@repo/db";
import { createChatSchema } from "@repo/shared";

import { requireSessionScope } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const userChats = await listChats(ctx.db, ctx.scope);
  return Response.json({ chats: userChats });
}

export async function POST(request: Request) {
  const ctx = await requireSessionScope();
  if (ctx instanceof Response) return ctx;

  const body = await request.json();
  const parsed = createChatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }

  // `workspaceId` in the request body is advisory in v0.1 — always create
  // chats in the caller's resolved default workspace (guardrails #6).
  const chatId = await createChat(ctx.db, ctx.scope, {
    title: parsed.data.title,
    systemPrompt: parsed.data.systemPrompt,
    modelConfigId: parsed.data.modelConfigId,
  });

  return Response.json({ id: chatId }, { status: 201 });
}
