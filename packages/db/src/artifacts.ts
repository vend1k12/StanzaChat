import type { ArtifactType } from "@repo/shared";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client.js";
import type { TenantScope } from "./schema.js";
import { artifacts, artifactVersions, chats } from "./schema.js";
import { createUlid } from "./slug.js";

/**
 * Data-access functions for artifacts and their versions (SPEC §5.2).
 *
 * Every read/write takes an explicit `TenantScope` (guardrails #6): we
 * always join through `chats` and require `chats.user_id = scope.userId`
 * so an artifact can never be enumerated across tenants. Cross-tenant
 * access is a review-blocking P0 (see `docs/agents/guardrails.md` #6).
 *
 * Artifact lifecycle (SPEC §5.2):
 * - **Create:** first `<artifact identifier="…">` in a chat inserts a
 *   row into `artifacts` + `artifact_versions#versionNumber=1`.
 * - **Update:** re-emitting the same identifier appends a new
 *   `artifact_versions` row (monotonic `version_number` per artifact).
 * - `incomplete=true` marks a version whose closing tag never arrived
 *   (auto-closed by the parser at stream end).
 */

// ── Artifact upsert (create + subsequent-version updates share this) ──

/**
 * Insert a new artifact row if `(chatId, identifier)` is new, or update
 * the title/updatedAt on an existing row. Returns the artifact id in both
 * cases so the caller can insert a version pointing at it.
 */
export async function upsertArtifact(
  db: Db,
  scope: TenantScope,
  input: {
    chatId: string;
    identifier: string;
    type: ArtifactType;
    title: string | null;
  },
): Promise<string> {
  // Ownership check — read the chat through the scope predicate; a
  // cross-tenant `chatId` won't return a row and we throw before writing.
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, input.chatId), eq(chats.userId, scope.userId)));
  if (!chat) {
    throw new Error(`Chat not found or not owned by user: ${input.chatId}`);
  }

  const id = createUlid();
  const [row] = await db
    .insert(artifacts)
    .values({
      id,
      chatId: input.chatId,
      identifier: input.identifier,
      type: input.type,
      title: input.title,
    })
    .onConflictDoUpdate({
      target: [artifacts.chatId, artifacts.identifier],
      set: { title: input.title, updatedAt: new Date() },
    })
    .returning({ id: artifacts.id });

  return row!.id;
}

// ── Version write (monotonic per artifact) ────────────────────────────

/**
 * Insert the next version for an artifact. The version number is
 * computed atomically inside the INSERT via a scalar subselect so
 * concurrent streams cannot allocate the same number.
 */
export async function createArtifactVersion(
  db: Db,
  input: {
    artifactId: string;
    content: string;
    messageId: string | null;
    incomplete: boolean;
  },
): Promise<string> {
  const id = createUlid();
  const nextVersion = sql<number>`(
    SELECT COALESCE(MAX(${artifactVersions.versionNumber}), 0) + 1
    FROM ${artifactVersions}
    WHERE ${artifactVersions.artifactId} = ${input.artifactId}
  )`;

  await db.insert(artifactVersions).values({
    id,
    artifactId: input.artifactId,
    versionNumber: nextVersion,
    content: input.content,
    messageId: input.messageId,
    incomplete: input.incomplete,
  });

  return id;
}

// ── Reads (all scoped through the chats.user_id predicate) ────────────

/**
 * List all artifacts for a chat, most-recently-updated first. Returns
 * `undefined` when the chat isn't owned by the scope's user (so callers
 * can 404 without leaking existence).
 */
export async function listArtifactsForChat(
  db: Db,
  scope: TenantScope,
  chatId: string,
): Promise<
  | {
      id: string;
      chatId: string;
      identifier: string;
      type: ArtifactType;
      title: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[]
  | undefined
> {
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, scope.userId)));
  if (!chat) return undefined;

  return db
    .select()
    .from(artifacts)
    .where(eq(artifacts.chatId, chatId))
    .orderBy(desc(artifacts.updatedAt));
}

/**
 * Fetch a single artifact + verify chat ownership. Returns `undefined`
 * when the artifact doesn't exist or isn't visible to the scope's user.
 */
export async function getArtifact(
  db: Db,
  scope: TenantScope,
  artifactId: string,
) {
  const [row] = await db
    .select({
      id: artifacts.id,
      chatId: artifacts.chatId,
      identifier: artifacts.identifier,
      type: artifacts.type,
      title: artifacts.title,
      createdAt: artifacts.createdAt,
      updatedAt: artifacts.updatedAt,
    })
    .from(artifacts)
    .innerJoin(chats, eq(chats.id, artifacts.chatId))
    .where(and(eq(artifacts.id, artifactId), eq(chats.userId, scope.userId)));
  return row;
}

/**
 * List versions for an artifact, newest first. Returns `undefined`
 * when the artifact isn't visible to the scope's user.
 */
export async function listArtifactVersions(
  db: Db,
  scope: TenantScope,
  artifactId: string,
) {
  const artifact = await getArtifact(db, scope, artifactId);
  if (!artifact) return undefined;

  return db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.artifactId, artifactId))
    .orderBy(desc(artifactVersions.versionNumber));
}

/**
 * Fetch a specific version (with ownership check). Returns `undefined`
 * when the version doesn't exist or the artifact isn't visible to the
 * scope's user.
 */
export async function getArtifactVersion(
  db: Db,
  scope: TenantScope,
  versionId: string,
) {
  const [row] = await db
    .select({
      id: artifactVersions.id,
      artifactId: artifactVersions.artifactId,
      versionNumber: artifactVersions.versionNumber,
      content: artifactVersions.content,
      messageId: artifactVersions.messageId,
      incomplete: artifactVersions.incomplete,
      createdAt: artifactVersions.createdAt,
    })
    .from(artifactVersions)
    .innerJoin(artifacts, eq(artifacts.id, artifactVersions.artifactId))
    .innerJoin(chats, eq(chats.id, artifacts.chatId))
    .where(
      and(eq(artifactVersions.id, versionId), eq(chats.userId, scope.userId)),
    );
  return row;
}

/**
 * Fetch the latest version content for an artifact — convenience for
 * the panel's initial render (Preview/Code tabs).
 */
export async function getLatestArtifactVersion(
  db: Db,
  scope: TenantScope,
  artifactId: string,
) {
  const artifact = await getArtifact(db, scope, artifactId);
  if (!artifact) return undefined;

  const [row] = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.artifactId, artifactId))
    .orderBy(desc(artifactVersions.versionNumber))
    .limit(1);
  return row;
}
