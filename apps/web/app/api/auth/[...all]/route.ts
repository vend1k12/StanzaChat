import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";

/**
 * Better-Auth route handler (SPEC §6: POST /api/auth/[...all]).
 *
 * Handlers are created lazily on the first request, not at module load,
 * so env vars are not required during the build phase.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Minimal shape of the Next.js auth handler pair returned by
 * `toNextJsHandler`. Named locally instead of inheriting via
 * `ReturnType<typeof toNextJsHandler>` because that pattern couples
 * consumers to an implementation helper (project rule ts-no-return-type).
 */
interface NextAuthHandlers {
  GET: (req: NextRequest) => Promise<Response>;
  POST: (req: NextRequest) => Promise<Response>;
}

let cachedHandlers: NextAuthHandlers | undefined;

function getHandlers(): NextAuthHandlers {
  if (!cachedHandlers) {
    cachedHandlers = toNextJsHandler(getAuth());
  }
  return cachedHandlers;
}

export async function GET(request: NextRequest) {
  return getHandlers().GET(request);
}

export async function POST(request: NextRequest) {
  return getHandlers().POST(request);
}
