/**
 * Typed domain errors used across all packages.
 *
 * Package functions throw these; a single mapper in `apps/web` converts
 * them to HTTP responses (`{ error: { code, message } }`). See
 * `docs/agents/conventions.md` "Error handling".
 */

export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

/**
 * Structured per-field validation issues. Server flattens a `ZodError`
 * into this shape; client renders each entry inline under the offending
 * form field so users see exactly what's wrong (§UX, ts-no-inline-cast-access
 * rule doesn't apply — this is a schema-shaped record).
 */
export interface ValidationDetails {
  /** Errors keyed by field path (e.g. `label` or `models.0`). */
  fieldErrors: Record<string, string[]>;
  /** Top-level errors not tied to a single field. */
  formErrors: string[];
}

export class ValidationError extends AppError {
  readonly details: ValidationDetails | null;

  constructor(
    message: string,
    options: { details?: ValidationDetails; code?: string } = {},
  ) {
    super(options.code ?? "validation_error", message, 400);
    this.details = options.details ?? null;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super("not_found", `${resource} not found: ${id}`, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super("forbidden", message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("unauthorized", message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message, 409);
  }
}

export { AppError as default };
