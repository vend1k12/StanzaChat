/**
 * Drizzle ORM schema for StanzaChat (SPEC §4).
 *
 * Two groups of tables:
 * 1. Better-Auth managed (§4.1): user, session, account, verification,
 *    organization, member, invitation. Field names follow Better-Auth's
 *    expected snake_case column names. The `admin` plugin adds role/ban
 *    fields on `user`.
 * 2. App tables (§4.2): workspaces, chats, messages, artifacts,
 *    artifact_versions, model_configurations, audit_logs, instance_settings.
 *
 * All app tables carry created_at/updated_at (timestamptz). IDs are text
 * ULIDs unless Better-Auth dictates otherwise.
 *
 * Drizzle objects use camelCase; table/column names use snake_case per
 * docs/agents/conventions.md.
 */

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ── Enums ───────────────────────────────────────────────────────────

export const instanceRoleEnum = pgEnum("instance_role", ["admin", "user"]);
export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member"]);
export const registrationModeEnum = pgEnum("registration_mode", [
  "open",
  "invite_only",
  "closed",
]);
export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
]);
export const artifactTypeEnum = pgEnum("artifact_type", [
  "html",
  "svg",
  "markdown",
]);
export const llmProviderEnum = pgEnum("llm_provider", [
  "openai",
  "anthropic",
  "google",
  "openai-compatible",
  "ollama",
]);

// ── Better-Auth managed tables (§4.1) ──────────────────────────────

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  // admin plugin fields
  role: instanceRoleEnum().notNull().default("user"),
  banned: boolean().notNull().default(false),
  banReason: text(),
  banExpires: timestamp({ mode: "date" }),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable("session", {
  id: text().primaryKey(),
  expiresAt: timestamp({ mode: "date" }).notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  accessTokenExpiresAt: timestamp({ mode: "date" }),
  refreshTokenExpiresAt: timestamp({ mode: "date" }),
  scope: text(),
  idToken: text(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ mode: "date" }).notNull(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const organization = pgTable("organization", {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text().references(() => user.id, { onDelete: "set null" }),
});

export const member = pgTable(
  "member",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: orgRoleEnum().notNull().default("member"),
    createdAt: timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("member_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

export const invitation = pgTable("invitation", {
  id: text().primaryKey(),
  organizationId: text()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text().notNull(),
  role: orgRoleEnum().notNull().default("member"),
  status: text().notNull().default("pending"),
  expiresAt: timestamp({ mode: "date" }).notNull(),
  inviterId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── App tables (§4.2) ──────────────────────────────────────────────

export const workspaces = pgTable(
  "workspaces",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull(),
    createdAt: timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_org_slug_unique").on(
      table.organizationId,
      table.slug,
    ),
  ],
);

export const chats = pgTable("chats", {
  id: text().primaryKey(),
  workspaceId: text()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text().notNull().default("Untitled"),
  systemPrompt: text(),
  modelConfigId: text().references(() => modelConfigurations.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messages = pgTable("messages", {
  id: text().primaryKey(),
  chatId: text()
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: messageRoleEnum().notNull(),
  content: text().notNull(),
  tokenUsage: jsonb().$type<{
    prompt?: number;
    completion?: number;
    total?: number;
  }>(),
  modelId: text(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const artifacts = pgTable(
  "artifacts",
  {
    id: text().primaryKey(),
    chatId: text()
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    identifier: text().notNull(),
    type: artifactTypeEnum().notNull(),
    title: text(),
    createdAt: timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("artifact_chat_identifier_unique").on(
      table.chatId,
      table.identifier,
    ),
  ],
);

export const artifactVersions = pgTable(
  "artifact_versions",
  {
    id: text().primaryKey(),
    artifactId: text()
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    versionNumber: integer().notNull(),
    content: text().notNull(),
    messageId: text().references(() => messages.id, { onDelete: "set null" }),
    incomplete: boolean().notNull().default(false),
    createdAt: timestamp({ mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("artifact_version_number_unique").on(
      table.artifactId,
      table.versionNumber,
    ),
  ],
);

export const modelConfigurations = pgTable("model_configurations", {
  id: text().primaryKey(),
  provider: llmProviderEnum().notNull(),
  label: text().notNull(),
  baseUrl: text(),
  encryptedApiKey: text(),
  keyIv: text(),
  keyTag: text(),
  enabledModels: jsonb().$type<string[]>().notNull().default([]),
  isDefault: boolean().notNull().default(false),
  enabled: boolean().notNull().default(true),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text().primaryKey(),
  actorUserId: text().references(() => user.id, { onDelete: "set null" }),
  action: text().notNull(),
  targetType: text(),
  targetId: text(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  ip: text(),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const instanceSettings = pgTable("instance_settings", {
  id: varchar({ length: 32 }).primaryKey(),
  registrationMode: registrationModeEnum().notNull().default("open"),
  setupCompleted: boolean().notNull().default(false),
  createdAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp({ mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Scope type (guardrails #6) ─────────────────────────────────────

/**
 * Every data-access function touching tenant data receives this scope.
 * See docs/agents/architecture.md "Tenancy scoping".
 */
export type TenantScope = {
  userId: string;
  organizationId: string;
  workspaceId: string;
};

// ── Full schema export for Drizzle adapter ─────────────────────────

export const schema = {
  user,
  session,
  account,
  verification,
  organization,
  member,
  invitation,
  workspaces,
  chats,
  messages,
  artifacts,
  artifactVersions,
  modelConfigurations,
  auditLogs,
  instanceSettings,
};
