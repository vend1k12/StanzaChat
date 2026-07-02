import { describe, expect, it } from "bun:test";

import { type Actor, can } from "../src/permissions.js";

describe("permission matrix (SPEC §5.4)", () => {
  const member: Actor = { instanceRole: "user", orgRole: "member" };
  const orgAdmin: Actor = { instanceRole: "user", orgRole: "admin" };
  const orgOwner: Actor = { instanceRole: "user", orgRole: "owner" };
  const instanceAdmin: Actor = { instanceRole: "admin" };
  const noOrg: Actor = { instanceRole: "user" };

  describe("chat.use", () => {
    it("allows any org member", () => {
      expect(can(member, "chat.use")).toBe(true);
    });

    it("allows org admin/owner", () => {
      expect(can(orgAdmin, "chat.use")).toBe(true);
      expect(can(orgOwner, "chat.use")).toBe(true);
    });

    it("allows instance admin", () => {
      expect(can(instanceAdmin, "chat.use")).toBe(true);
    });
  });

  describe("org.manage-members", () => {
    it("denies plain member", () => {
      expect(can(member, "org.manage-members")).toBe(false);
    });

    it("allows org admin/owner", () => {
      expect(can(orgAdmin, "org.manage-members")).toBe(true);
      expect(can(orgOwner, "org.manage-members")).toBe(true);
    });

    it("allows instance admin", () => {
      expect(can(instanceAdmin, "org.manage-members")).toBe(true);
    });

    it("denies user without org role", () => {
      expect(can(noOrg, "org.manage-members")).toBe(false);
    });
  });

  describe("chat.manage", () => {
    it("denies plain member", () => {
      expect(can(member, "chat.manage")).toBe(false);
    });

    it("allows org admin/owner", () => {
      expect(can(orgAdmin, "chat.manage")).toBe(true);
      expect(can(orgOwner, "chat.manage")).toBe(true);
    });

    it("allows instance admin", () => {
      expect(can(instanceAdmin, "chat.manage")).toBe(true);
    });
  });

  describe("provider.manage", () => {
    it("denies member", () => {
      expect(can(member, "provider.manage")).toBe(false);
    });

    it("denies org admin/owner", () => {
      expect(can(orgAdmin, "provider.manage")).toBe(false);
      expect(can(orgOwner, "provider.manage")).toBe(false);
    });

    it("allows instance admin", () => {
      expect(can(instanceAdmin, "provider.manage")).toBe(true);
    });
  });

  describe("user.manage", () => {
    it("denies member and org admin", () => {
      expect(can(member, "user.manage")).toBe(false);
      expect(can(orgAdmin, "user.manage")).toBe(false);
    });

    it("allows instance admin", () => {
      expect(can(instanceAdmin, "user.manage")).toBe(true);
    });
  });

  describe("settings.manage", () => {
    it("denies non-admin", () => {
      expect(can(member, "settings.manage")).toBe(false);
      expect(can(orgOwner, "settings.manage")).toBe(false);
    });

    it("allows instance admin", () => {
      expect(can(instanceAdmin, "settings.manage")).toBe(true);
    });
  });

  describe("audit.view", () => {
    it("denies non-admin", () => {
      expect(can(member, "audit.view")).toBe(false);
      expect(can(orgOwner, "audit.view")).toBe(false);
    });

    it("allows instance admin", () => {
      expect(can(instanceAdmin, "audit.view")).toBe(true);
    });
  });

  describe("instance admin omnipotence", () => {
    const actions: Parameters<typeof can>[1][] = [
      "chat.use",
      "chat.manage",
      "org.manage-members",
      "provider.manage",
      "user.manage",
      "settings.manage",
      "audit.view",
    ];

    for (const action of actions) {
      it(`allows ${action}`, () => {
        expect(can(instanceAdmin, action)).toBe(true);
      });
    }
  });
});
