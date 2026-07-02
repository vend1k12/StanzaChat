import { AesGcmKeyStore, createProvider, listProviders } from "@repo/ai";
import { can } from "@repo/auth";
import { getDb } from "@repo/db";
import { createProviderSchema, parseEnv } from "@repo/shared";
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

  // Permission check via single helper (guardrails #7)
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

  const db = getDb(parseEnv().DATABASE_URL);
  const providers = await listProviders(db);

  return Response.json({ providers });
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

  const body = await request.json();
  const parsed = createProviderSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: { code: "validation_error", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const env = parseEnv();
  const db = getDb(env.DATABASE_URL);

  // Encrypt API key if provided (SPEC §7)
  let encryptedApiKey;
  if (parsed.data.apiKey) {
    const keyStore = new AesGcmKeyStore(env.ENCRYPTION_MASTER_KEY);
    encryptedApiKey = await keyStore.encrypt(parsed.data.apiKey);
  }

  const id = await createProvider(db, {
    provider: parsed.data.provider,
    label: parsed.data.label,
    baseUrl: parsed.data.baseUrl || undefined,
    encryptedApiKey,
    enabledModels: parsed.data.enabledModels,
    isDefault: parsed.data.isDefault,
  });

  return Response.json({ id }, { status: 201 });
}
