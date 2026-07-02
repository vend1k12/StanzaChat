import type { InstanceRole, OrgRole } from "@repo/shared/constants";

/**
 * Single authorization helper (SPEC §5.4, guardrails #7).
 *
 * All Route Handlers call `can(actor, action, scope)` — they never
 * re-implement role checks inline. The matrix:
 *
 * | Action                           | member | org admin/owner | instance admin |
 * | -------------------------------- | ------ | --------------- | -------------- |
 * | Use chat/artifacts in own org    | ✅     | ✅              | ✅             |
 * | Manage org members/invitations   | —      | ✅              | ✅             |
 * | Manage providers/models           | —      | —               | ✅             |
 * | Manage users / registration mode | —      | —               | ✅             |
 * | View audit logs                   | —      | —               | ✅             |
 */

export type Action =
  | "chat.use"
  | "chat.manage"
  | "org.manage-members"
  | "provider.manage"
  | "user.manage"
  | "settings.manage"
  | "audit.view";

export type Actor = {
  instanceRole: InstanceRole;
  orgRole?: OrgRole;
};

/**
 * Returns true if the actor is permitted to perform the action.
 *
 * The actor's `instanceRole` is always checked first (instance admin is
 * omnipotent). For org-scoped actions, `orgRole` is checked against the
 * matrix. If `orgRole` is undefined and the action requires org-level
 * permissions, the action is denied.
 */
export function can(actor: Actor, action: Action): boolean {
  // Instance admin can do everything.
  if (actor.instanceRole === "admin") {
    return true;
  }

  switch (action) {
    // Any org member can use chat/artifacts.
    case "chat.use":
      return true;

    // Org admin/owner can manage members and invitations.
    case "org.manage-members":
      return actor.orgRole === "admin" || actor.orgRole === "owner";

    // Org admin/owner can manage chats (rename, delete, etc.).
    case "chat.manage":
      return actor.orgRole === "admin" || actor.orgRole === "owner";

    // Instance-only actions — not available to org roles.
    case "provider.manage":
    case "user.manage":
    case "settings.manage":
    case "audit.view":
      return false;

    default: {
      // Exhaustiveness check: if a new Action is added without a case,
      // this triggers a compile-time error.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * Assert that the actor can perform the action; throw ForbiddenError
 * otherwise. Imported from shared to avoid duplicating the error type.
 */
export function assertCan(actor: Actor, action: Action): void {
  if (!can(actor, action)) {
    throw new Error(
      `Forbidden: action "${action}" requires permissions this actor does not have`,
    );
  }
}
