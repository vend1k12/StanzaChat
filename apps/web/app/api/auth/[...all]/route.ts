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

let cachedHandlers: ReturnType<typeof toNextJsHandler> | undefined;

function getHandlers() {
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
