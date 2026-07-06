import { ApiError } from "@/lib/api";

/**
 * Human-readable, tone-neutral text for an API error.
 *
 * The unified `{ error: { code, message } }` envelope carries a
 * discriminating `code`; we map the common ones to a friendly sentence
 * so toasts read as advice rather than raw server prose. Unknown codes
 * fall back to the server message.
 *
 * Field-level detail (from a `ValidationError`) is surfaced separately
 * via `ApiError.details` → the caller renders per-field errors under
 * the form input, so this helper is for the toast/banner surface only.
 */
const FRIENDLY: Record<string, string> = {
  unauthorized: "You need to sign in to do that.",
  forbidden: "You don't have permission for this action.",
  not_found: "That resource could not be found.",
  rate_limited: "Too many requests — try again in a moment.",
  conflict: "Conflicting state — refresh and retry.",
  internal_error: "Something went wrong on the server. Try again shortly.",
  validation_error: "Some of the fields need attention.",
  "discover.unsupported_provider":
    "Model discovery isn't available for this provider. Enter models by hand.",
  "discover.network_error":
    "Couldn't reach the provider — check the base URL and network access.",
  "discover.http_error":
    "The provider refused the request. Double-check the base URL and API key.",
  "discover.invalid_response":
    "The provider replied with an unexpected shape. Verify it's OpenAI-compatible.",
};

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiError) {
    const friendly = FRIENDLY[err.code];
    if (friendly) return friendly;
    return err.toDisplayMessage();
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/**
 * First field error message for a given form field, if the error carries
 * validation details. Returns `null` when nothing matches the field.
 * Callers wire this to inline `<p role="alert">` under `<Input>`s.
 */
export function fieldError(err: unknown, field: string): string | null {
  if (err instanceof ApiError && err.details) {
    // Use `Object.hasOwn` + destructured lookup so ESLint's
    // `security/detect-object-injection` doesn't flag a dynamic index
    // into a plain object.
    if (!Object.hasOwn(err.details.fieldErrors, field)) return null;
    const { [field]: messages } = err.details.fieldErrors;
    return messages?.[0] ?? null;
  }
  return null;
}
