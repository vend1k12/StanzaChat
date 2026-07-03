/**
 * Typed client-side fetch wrapper for the StanzaChat REST API (SPEC §6).
 *
 * Every Route Handler returns a unified `{ error: { code, message } }` body
 * on failure (see `apps/web/lib/session.ts` `authErrorResponses` and each
 * route's inline 4xx/5xx). `apiFetch` surfaces that as a thrown `ApiError`
 * so callers (TanStack Query hooks, mutations) can branch on `.code`.
 *
 * This module is client-only — it runs in the browser against same-origin
 * routes that read the Better-Auth session cookie.
 */

/** Error body returned by every failing Route Handler. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

/** Typed error thrown by `apiFetch` on a non-2xx response. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Fetch a JSON API route and return the parsed body on 2xx, or throw an
 * `ApiError` carrying the server's `{ error: { code, message } }` payload.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // Non-JSON error (e.g. proxy 502); fall through to generic message.
    }
    const code = body?.error?.code ?? "http_error";
    const message =
      body?.error?.message ?? `Request to ${path} failed (${res.status})`;
    throw new ApiError(res.status, code, message);
  }

  // Allow empty 204/empty-body responses to parse as `T` gracefully.
  const text = await res.text();
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}

/**
 * Post a JSON body and return the parsed response. Thin convenience over
 * `apiFetch` so call sites don't repeat the method/headers boilerplate.
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    ...init,
  });
}
