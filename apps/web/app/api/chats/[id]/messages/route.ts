import { getDb, listMessages } from "@repo/db";
import { parseEnv } from "@repo/shared";
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
  const messages = await listMessages(
    db,
    {
      userId: session.user.id,
      organizationId: "",
      workspaceId: "",
    },
    id,
  );

  if (messages === undefined) {
    return Response.json(
      { error: { code: "not_found", message: "Chat not found" } },
      { status: 404 },
    );
  }

  return Response.json({ messages });
}
