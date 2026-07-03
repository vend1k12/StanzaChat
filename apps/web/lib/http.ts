import { AppError } from "@repo/shared";

/**
 * Single mapper from thrown domain errors to HTTP JSON responses.
 *
 * Route Handlers call `wrapRoute(async () => …)` (or catch manually and
 * pipe through `errorResponse`); package functions throw `AppError`
 * subclasses from `@repo/shared`. This is the ONLY place where domain
 * errors become HTTP status codes — matches conventions.md "single
 * mapper in apps/web" rule.
 *
 * NEVER leak stack traces or provider bodies to clients (guardrails,
 * SPEC §7). Unknown errors surface as generic 500.
 */
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  // Log internally, but never surface the raw message.
  console.error("[api] unexpected error", err);
  return Response.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    { status: 500 },
  );
}

/**
 * Convenience wrapper: run a handler, translate any `AppError` (or
 * unknown throw) into the canonical JSON envelope.
 */
export async function wrapRoute(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    return errorResponse(err);
  }
}
