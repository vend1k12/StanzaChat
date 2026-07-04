import { createChat, listChats } from "@repo/db";
import { createChatSchema, ValidationError } from "@repo/shared";

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

    const body = await request.json();
    const parsed = createChatSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }

    // `workspaceId` in the request body is advisory in v0.1 — always create
    // chats in the caller's resolved default workspace (guardrails #6).
    const chatId = await createChat(ctx.db, ctx.scope, {
      title: parsed.data.title,
      systemPrompt: parsed.data.systemPrompt,
      modelConfigId: parsed.data.modelConfigId,
    });

    return Response.json({ id: chatId }, { status: 201 });
  });
}
