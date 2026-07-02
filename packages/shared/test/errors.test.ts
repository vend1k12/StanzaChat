import { describe, expect, it } from "bun:test";

import {
  AUDIT_ACTIONS,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../src/index.js";

describe("typed errors", () => {
  it("ValidationError has 400 status", () => {
    const error = new ValidationError("bad input");
    expect(error.status).toBe(400);
    expect(error.code).toBe("validation_error");
    expect(error.message).toBe("bad input");
  });

  it("NotFoundError has 404 status and names the resource", () => {
    const error = new NotFoundError("Chat", "abc123");
    expect(error.status).toBe(404);
    expect(error.message).toContain("Chat");
    expect(error.message).toContain("abc123");
  });

  it("ForbiddenError has 403 status", () => {
    const error = new ForbiddenError();
    expect(error.status).toBe(403);
  });

  it("ConflictError has 409 status", () => {
    const error = new ConflictError("duplicate slug");
    expect(error.status).toBe(409);
    expect(error.message).toBe("duplicate slug");
  });
});

describe("audit action enum", () => {
  it("contains all SPEC §5.6 actions", () => {
    const required = [
      "provider.create",
      "provider.update",
      "provider.delete",
      "model.enable",
      "model.disable",
      "settings.update",
      "user.ban",
      "user.unban",
      "user.role_change",
      "org.create",
      "org.delete",
      "invitation.create",
      "invitation.revoke",
    ];

    for (const action of required) {
      expect(AUDIT_ACTIONS as readonly string[]).toContain(action);
    }
  });
});
