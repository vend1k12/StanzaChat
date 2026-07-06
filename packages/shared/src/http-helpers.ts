import { z, type ZodError, type ZodType } from "zod";

import { type ValidationDetails, ValidationError } from "./errors.js";

/**
 * Flatten a `ZodError` into `{ fieldErrors, formErrors }` — same shape
 * as `zod`'s built-in flatten, but resilient to nested paths and
 * guaranteed to be JSON-serialisable (numeric array indices become
 * dotted keys like `models.0`).
 *
 * Uses a `Map` internally because the keys are dynamic strings
 * (arbitrary field paths from external input) — a plain object would
 * trip ESLint's `security/detect-object-injection` and, more
 * importantly, is the wrong shape per project rule `ts-set-map`:
 * runtime membership → Set/Map, static tables → Record. The Map is
 * materialised into a plain `Record<string, string[]>` at the very end
 * so the wire payload stays JSON-friendly.
 */
export function flattenZodError(err: ZodError): ValidationDetails {
  const buckets = new Map<string, string[]>();
  const formErrors: string[] = [];
  for (const issue of err.issues) {
    if (issue.path.length === 0) {
      formErrors.push(issue.message);
      continue;
    }
    const key = issue.path.map((p) => String(p)).join(".");
    const existing = buckets.get(key);
    if (existing) existing.push(issue.message);
    else buckets.set(key, [issue.message]);
  }
  return { fieldErrors: Object.fromEntries(buckets), formErrors };
}

/**
 * Parse a value against a zod schema and throw a rich `ValidationError`
 * (with per-field `details`) on failure. Route Handlers use it instead
 * of `safeParse(...)` + hand-rolled throw so every 400 response carries
 * the same structured shape.
 */
export function parseWithSchema<S extends ZodType>(
  schema: S,
  value: unknown,
): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ValidationError("Request body failed validation", {
    details: flattenZodError(parsed.error),
  });
}
