import type { Db, TenantScope } from "@repo/db";
import { getDb, getDefaultWorkspaceForUser } from "@repo/db";
import { parseEnv } from "@repo/shared";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

/**
 * Session + scope resolution shared by every Route Handler.
 *
 * Centralises three concerns that every handler in `apps/web/app/api`
 * used to inline (with subtly different shapes each time):
 *
 * 1. Validated env → single `getDb` pool per process.
 * 2. Better-Auth session lookup from request cookies.
 * 3. Tenant scope (`{ userId, organizationId, workspaceId }`) — the
 *    argument every package-level data-access fn requires
 *    (docs/agents/architecture.md "Tenancy scoping" / guardrails #6).
 *
 * Handlers stay < 40 lines by delegating to these helpers plus the
 * `@repo/db` DAO layer.
 */

// ── Error responses (unified `{ error: { code, message } }` shape) ─────

/** Standard JSON error responses so handlers can `return` them directly. */
export const authErrorResponses = {
  unauthorized: () =>
    Response.json(
      { error: { code: "unauthorized", message: "Authentication required" } },
      { status: 401 },
    ),
  forbidden: (message = "You do not have permission to perform this action") =>
    Response.json({ error: { code: "forbidden", message } }, { status: 403 }),
  scopeMissing: () =>
    Response.json(
      {
        error: {
          code: "scope_missing",
          message:
            "Default workspace is missing for this user. Sign out and back in to trigger first-run setup.",
        },
      },
      { status: 500 },
    ),
} as const;

// ── DB singleton ───────────────────────────────────────────────────────

/**
 * Process-wide DB pool, gated on env validation. Env parsing throws in
 * production if secrets are missing/default (SPEC guardrail #4), so this
 * lookup fails fast at the first request rather than surfacing a stack
 * trace deep inside a query.
 */
export function getDbFromEnv(): Db {
  return getDb(parseEnv().DATABASE_URL);
}

// ── Session ────────────────────────────────────────────────────────────

export type Session = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>
>;

/**
 * Fetch the current Better-Auth session from request headers. Returns
 * `null` if the user is not signed in — callers typically short-circuit
 * with `authErrorResponses.unauthorized()`.
 */
export async function getSession(): Promise<Session | null> {
  const auth = getAuth();
  return auth.api.getSession({ headers: await headers() });
}

// ── Scope ──────────────────────────────────────────────────────────────

/**
 * Resolve the user's active tenant scope. In v0.1 every user has exactly
 * one personal org + one default workspace, created by
 * `packages/auth`'s `user.create.after` hook. If the row is missing
 * (should only happen if the hook failed), we surface a distinct error
 * rather than silently downgrading to bare-id queries.
 */
export async function resolveScope(
  db: Db,
  userId: string,
): Promise<TenantScope | null> {
  const target = await getDefaultWorkspaceForUser(db, userId);
  if (!target) {
    return null;
  }
  return {
    userId,
    organizationId: target.organizationId,
    workspaceId: target.workspaceId,
  };
}

/**
 * Composite convenience for handlers: session + db + scope in one call.
 * Returns either a ready-to-use context or a JSON `Response` to return.
 * Handlers can `if (ctx instanceof Response) return ctx;` on the result.
 */
export async function requireSessionScope(): Promise<
  { session: Session; db: Db; scope: TenantScope } | Response
> {
  const session = await getSession();
  if (!session) {
    return authErrorResponses.unauthorized();
  }
  const db = getDbFromEnv();
  const scope = await resolveScope(db, session.user.id);
  if (!scope) {
    return authErrorResponses.scopeMissing();
  }
  return { session, db, scope };
}
