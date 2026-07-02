import { deleteChat, getChat, getDb, updateChat } from "@repo/db";
import { parseEnv, updateChatSchema } from "@repo/shared";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const db = getDb(parseEnv().DATABASE_URL);
  const chat = await getChat(
    db,
    {
      userId: session.user.id,
      organizationId: "",
      workspaceId: "",
    },
    id,
  );

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
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateChatSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const db = getDb(parseEnv().DATABASE_URL);
  await updateChat(
    db,
    {
      userId: session.user.id,
      organizationId: "",
      workspaceId: "",
    },
    id,
    parsed.data,
  );

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const db = getDb(parseEnv().DATABASE_URL);
  await deleteChat(
    db,
    {
      userId: session.user.id,
      organizationId: "",
      workspaceId: "",
    },
    id,
  );

  return Response.json({ ok: true });
}
