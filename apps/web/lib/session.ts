import type { Db, TenantScope } from "@repo/db";
import { getDb, getDefaultWorkspaceForUser } from "@repo/db";
import { ForbiddenError, parseEnv, UnauthorizedError } from "@repo/shared";
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

/**
 * Minimal fields we consume from the Better-Auth session at request
 * time. Named locally so we don't couple to
 * `ReturnType<typeof getAuth>["api"]["getSession"]` — an anti-pattern
 * per `docs/agents/conventions.md`; also lets test fixtures construct
 * the shape without pulling in the whole Better-Auth types graph.
 */
export interface Session {
  session: { id: string; userId: string };
  user: { id: string; email: string; name: string; role: string };
}

/**
 * Fetch the current Better-Auth session from request headers. Returns
 * `null` if the user is not signed in — callers typically short-circuit
 * with `authErrorResponses.unauthorized()` (composable via
 * `requireSessionScope`) or `throw new UnauthorizedError()` (composable
 * via `requireSessionScopeOrThrow` + `wrapRoute`).
 */
export async function getSession(): Promise<Session | null> {
  const auth = getAuth();
  const raw = await auth.api.getSession({ headers: await headers() });
  return (raw as Session | null) ?? null;
}

// ── Scope ──────────────────────────────────────────────────────────────

/**
 * Resolve the user's active tenant scope. In v0.1 every user has exactly
 * one personal org + one default workspace, created by
 * `packages/auth`'s `user.create.after` hook. If the row is missing
 * (should only happen if the hook failed), we surface a distinct error
 * rather than silently downgrading to bare-id queries.
 */
// In-process scope memo keyed by `userId`. In v0.1 every user has
// exactly one personal org + one default workspace, so this is safe
// to cache for the lifetime of the request-handling process. Purge
// with `resetResolveScopeCache()` when workspace/org membership
// changes (only used at first-run + org-invite acceptance today).
const scopeCache = new Map<string, TenantScope>();

export function resetResolveScopeCache(userId?: string): void {
  if (userId) scopeCache.delete(userId);
  else scopeCache.clear();
}

export async function resolveScope(
  db: Db,
  userId: string,
): Promise<TenantScope | null> {
  const cached = scopeCache.get(userId);
  if (cached) return cached;

  const target = await getDefaultWorkspaceForUser(db, userId);
  if (!target) {
    return null;
  }
  const scope: TenantScope = {
    userId,
    organizationId: target.organizationId,
    workspaceId: target.workspaceId,
  };
  scopeCache.set(userId, scope);
  return scope;
}

/**
 * Composite convenience for handlers: session + db + scope in one call.
 * Returns either a ready-to-use context or a JSON `Response` to return.
 * Handlers can `if (ctx instanceof Response) return ctx;` on the result.
 *
 * NEW code should prefer `requireSessionScopeOrThrow` inside a
 * `wrapRoute(async () => …)` block per `docs/agents/conventions.md`.
 * This return-a-Response form is retained for the auth-bypass paths
 * (e.g. Better-Auth's own routes) that cannot rely on the mapper.
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

/**
 * Throwing variant of `requireSessionScope` — pairs with `wrapRoute`
 * (see `docs/agents/conventions.md` "Error handling"). Throws typed
 * `UnauthorizedError` when no session cookie, or a service error when
 * the user's default workspace is missing.
 */
export async function requireSessionScopeOrThrow(): Promise<{
  session: Session;
  db: Db;
  scope: TenantScope;
}> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  const db = getDbFromEnv();
  const scope = await resolveScope(db, session.user.id);
  if (!scope) {
    throw new ForbiddenError(
      "Default workspace is missing for this user. Sign out and back in to trigger first-run setup.",
    );
  }
  return { session, db, scope };
}

/**
 * Throwing gate for instance-admin-only routes (provider CRUD, etc.).
 * Reuses `requireSessionScopeOrThrow`'s error taxonomy so `wrapRoute`
 * maps rejections to the right status without per-route branching.
 * The permission check runs through `@repo/auth`'s central `can(...)`
 * helper (guardrails #7 — no ad-hoc role reads).
 */
export async function requireInstanceAdmin(): Promise<{
  session: Session;
  db: Db;
}> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  const { can } = await import("@repo/auth");
  const permitted = can(
    { instanceRole: session.user.role as "admin" | "user" },
    "provider.manage",
  );
  if (!permitted) {
    throw new ForbiddenError("Instance admin required");
  }
  return { session, db: getDbFromEnv() };
}
