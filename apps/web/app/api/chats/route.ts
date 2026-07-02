import { createChat, getDb, listChats } from "@repo/db";
import { createChatSchema, parseEnv } from "@repo/shared";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const db = getDb(parseEnv().DATABASE_URL);
  const userChats = await listChats(db, {
    userId: session.user.id,
    organizationId: "",
    workspaceId: "",
  });

  return Response.json({ chats: userChats });
}

export async function POST(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const body = await request.json();
  const parsed = createChatSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const db = getDb(parseEnv().DATABASE_URL);
  const chatId = await createChat(
    db,
    {
      userId: session.user.id,
      organizationId: "",
      workspaceId: parsed.data.workspaceId,
    },
    {
      title: parsed.data.title,
      systemPrompt: parsed.data.systemPrompt,
      modelConfigId: parsed.data.modelConfigId,
    },
  );

  return Response.json({ id: chatId }, { status: 201 });
}
