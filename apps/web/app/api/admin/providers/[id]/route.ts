import {
  AesGcmKeyStore,
  deleteProvider,
  getProvider,
  updateProvider,
} from "@repo/ai";
import { can } from "@repo/auth";
import { getDb } from "@repo/db";
import { parseEnv, updateProviderSchema } from "@repo/shared";
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

  if (
    !can(
      { instanceRole: session.user.role as "admin" | "user" },
      "provider.manage",
    )
  ) {
    return Response.json(
      { error: { code: "forbidden", message: "Instance admin required" } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const db = getDb(parseEnv().DATABASE_URL);
  const provider = await getProvider(db, id);

  if (!provider) {
    return Response.json(
      { error: { code: "not_found", message: "Provider not found" } },
      { status: 404 },
    );
  }

  return Response.json({ provider });
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

  if (
    !can(
      { instanceRole: session.user.role as "admin" | "user" },
      "provider.manage",
    )
  ) {
    return Response.json(
      { error: { code: "forbidden", message: "Instance admin required" } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateProviderSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const env = parseEnv();
  const db = getDb(env.DATABASE_URL);

  // Encrypt API key if provided
  let encryptedApiKey;
  if (parsed.data.apiKey) {
    const keyStore = new AesGcmKeyStore(env.ENCRYPTION_MASTER_KEY);
    encryptedApiKey = await keyStore.encrypt(parsed.data.apiKey);
  }

  await updateProvider(db, id, {
    label: parsed.data.label,
    baseUrl: parsed.data.baseUrl || undefined,
    encryptedApiKey,
    enabledModels: parsed.data.enabledModels,
    isDefault: parsed.data.isDefault,
    enabled: parsed.data.enabled,
  });

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

  if (
    !can(
      { instanceRole: session.user.role as "admin" | "user" },
      "provider.manage",
    )
  ) {
    return Response.json(
      { error: { code: "forbidden", message: "Instance admin required" } },
      { status: 403 },
    );
  }

  const { id } = await params;
  const db = getDb(parseEnv().DATABASE_URL);
  await deleteProvider(db, id);

  return Response.json({ ok: true });
}
