/**
 * Domain constants for StanzaChat.
 *
 * Centralised here so every package (`db`, `auth`, `ai`, `apps/web`) shares
 * a single source of truth for enums that appear in schemas, API DTOs,
 * Zod validation, and audit logging. See SPEC §4.1, §5.4, §5.6.
 */

// ── Instance roles (user.role) ──────────────────────────────────────

export const INSTANCE_ROLES = ["admin", "user"] as const;
export type InstanceRole = (typeof INSTANCE_ROLES)[number];

// ── Organization roles (member.role) ───────────────────────────────

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

// ── Registration modes (instance_settings.registration_mode) ───────

export const REGISTRATION_MODES = ["open", "invite_only", "closed"] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

export const DEFAULT_REGISTRATION_MODE: RegistrationMode = "open";

// ── Audit actions (SPEC §5.6) ───────────────────────────────────────
// Extensible enum: every admin mutation writes one of these to audit_logs.
// Format: noun.verb.

export const AUDIT_ACTIONS = [
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
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ── Artifact types (SPEC §5.2) ──────────────────────────────────────

export const ARTIFACT_TYPES = ["html", "svg", "markdown"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

// ── LLM providers (SPEC §4.2 model_configurations.provider) ─────────

export const LLM_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openai-compatible",
  "ollama",
] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];
