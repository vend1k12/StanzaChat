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

export class ValidationError extends AppError {
  constructor(message: string, code = "validation_error") {
    super(code, message, 400);
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
