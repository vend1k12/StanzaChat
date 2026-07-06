import { z, type ZodError, type ZodType } from "zod";

import { ValidationError, type ValidationDetails } from "./errors.js";

/**
 * Flatten a `ZodError` into `{ fieldErrors, formErrors }` — same shape
 * as `zod`'s built-in flatten, but resilient to nested paths and
 * guaranteed to be JSON-serialisable (numeric array indices become
 * dotted keys like `models.0`).
 */
export function flattenZodError(err: ZodError): ValidationDetails {
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of err.issues) {
    if (issue.path.length === 0) {
      formErrors.push(issue.message);
      continue;
    }
    const key = issue.path.map((p) => String(p)).join(".");
    const bucket = fieldErrors[key];
    if (bucket) bucket.push(issue.message);
    else fieldErrors[key] = [issue.message];
  }
  return { fieldErrors, formErrors };
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
