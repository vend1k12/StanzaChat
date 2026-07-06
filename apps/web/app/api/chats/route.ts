import { createChat, listChats } from "@repo/db";
import { createChatSchema, parseWithSchema } from "@repo/shared";

import { wrapRoute } from "@/lib/http";
import { requireSessionScopeOrThrow } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();
    const userChats = await listChats(ctx.db, ctx.scope);
    return Response.json({ chats: userChats });
  });
}

export async function POST(request: Request) {
  return wrapRoute(async () => {
    const ctx = await requireSessionScopeOrThrow();

    const body = parseWithSchema(createChatSchema, await request.json());

    // `workspaceId` in the request body is advisory in v0.1 — always create
    // chats in the caller's resolved default workspace (guardrails #6).
    const chatId = await createChat(ctx.db, ctx.scope, {
      title: body.title,
      systemPrompt: body.systemPrompt,
      modelConfigId: body.modelConfigId,
    });

    return Response.json({ id: chatId }, { status: 201 });
  });
}
