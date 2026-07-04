import type { ArtifactType } from "@repo/shared";
import { NotFoundError } from "@repo/shared";
import { and, desc, eq, sql } from "drizzle-orm";

import type { DbClient } from "./client.js";
import type { TenantScope } from "./schema.js";
import { artifacts, artifactVersions, chats } from "./schema.js";
import { createUlid } from "./slug.js";

/**
 * Row shape returned by `listArtifactsForChat`.
 */
export interface ArtifactRow {
  id: string;
  chatId: string;
  identifier: string;
  type: ArtifactType;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Row shape returned by `getArtifact` (same fields as `ArtifactRow`).
 */
export type ArtifactSummary = ArtifactRow;

/**
 * Row shape returned by every version read (`listArtifactVersions`,
 * `getArtifactVersion`, `getLatestArtifactVersion`). `incomplete` is
 * surfaced so the UI can badge or hide truncated versions.
 */
export interface ArtifactVersionRow {
  id: string;
  artifactId: string;
  versionNumber: number;
  content: string;
  messageId: string | null;
  incomplete: boolean;
  createdAt: Date;
}

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
  db: DbClient,
  scope: TenantScope,
  input: {
    chatId: string;
    identifier: string;
    type: ArtifactType;
    title: string | null;
  },
): Promise<string> {
  // Ownership check — read the chat through the scope predicate; a
  // cross-tenant `chatId` won't return a row and we throw the typed
  // `NotFoundError` so `wrapRoute` maps it to a 404 upstream (see
  // `docs/agents/conventions.md` "Error handling").
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, input.chatId), eq(chats.userId, scope.userId)));
  if (!chat) {
    throw new NotFoundError("Chat", input.chatId);
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
 *
 * Under contention two concurrent inserts may both compute the same
 * `versionNumber`; the `artifact_version_number_unique` index on
 * `(artifact_id, version_number)` rejects the loser with a Postgres
 * unique-violation. We catch that specific error class and retry once
 * with a freshly-computed number. Any other failure propagates.
 */
export async function createArtifactVersion(
  db: DbClient,
  input: {
    artifactId: string;
    content: string;
    messageId: string | null;
    incomplete: boolean;
  },
): Promise<string> {
  const nextVersion = sql<number>`(
    SELECT COALESCE(MAX(${artifactVersions.versionNumber}), 0) + 1
    FROM ${artifactVersions}
    WHERE ${artifactVersions.artifactId} = ${input.artifactId}
  )`;

  // At most one retry — if two concurrent inserts collide on the
  // unique index, the retry recomputes MAX(versionNumber) + 1 and
  // settles the ordering. Each attempt runs inside its own nested
  // transaction so that when the caller is already in a `db.transaction`
  // the unique-violation aborts only the savepoint, not the outer tx.
  // (Drizzle's nested `.transaction(...)` compiles to a SAVEPOINT.)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const id = createUlid();
    try {
      await db.transaction(async (sp) => {
        await sp.insert(artifactVersions).values({
          id,
          artifactId: input.artifactId,
          versionNumber: nextVersion,
          content: input.content,
          messageId: input.messageId,
          incomplete: input.incomplete,
        });
      });
      return id;
    } catch (err) {
      if (attempt === 0 && isUniqueVersionViolation(err)) {
        continue;
      }
      throw err;
    }
  }
  // Unreachable — either the try returns or the catch throws.
  throw new Error("createArtifactVersion: retry exhausted");
}

/**
 * Postgres unique-violation `SQLSTATE 23505` on the
 * `artifact_version_number_unique` index. Node-postgres surfaces the
 * code on the thrown error as `.code`; we accept either the shorthand
 * check or the constraint name to stay resilient to driver wrapping.
 */
function isUniqueVersionViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; constraint?: unknown };
  return (
    e.code === "23505" || e.constraint === "artifact_version_number_unique"
  );
}

// ── Reads (all scoped through the chats.user_id predicate) ────────────

/**
 * List all artifacts for a chat, most-recently-updated first. Returns
 * `undefined` when the chat isn't owned by the scope's user (so callers
 * can 404 without leaking existence).
 */
export async function listArtifactsForChat(
  db: DbClient,
  scope: TenantScope,
  chatId: string,
): Promise<ArtifactRow[] | undefined> {
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, scope.userId)));
  if (!chat) return undefined;

  return db
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
    .where(eq(artifacts.chatId, chatId))
    .orderBy(desc(artifacts.updatedAt));
}

/**
 * Fetch a single artifact + verify chat ownership. Returns `undefined`
 * when the artifact doesn't exist or isn't visible to the scope's user.
 */
export async function getArtifact(
  db: DbClient,
  scope: TenantScope,
  artifactId: string,
): Promise<ArtifactSummary | undefined> {
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
  db: DbClient,
  scope: TenantScope,
  artifactId: string,
): Promise<ArtifactVersionRow[] | undefined> {
  const artifact = await getArtifact(db, scope, artifactId);
  if (!artifact) return undefined;

  return db
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
    .where(eq(artifactVersions.artifactId, artifactId))
    .orderBy(desc(artifactVersions.versionNumber));
}

/**
 * Fetch a specific version (with ownership check). Returns `undefined`
 * when the version doesn't exist or the artifact isn't visible to the
 * scope's user.
 */
export async function getArtifactVersion(
  db: DbClient,
  scope: TenantScope,
  versionId: string,
): Promise<ArtifactVersionRow | undefined> {
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
 * Fetch the latest COMPLETE version for an artifact — convenience for
 * the panel's initial render (Preview/Code tabs). Skips versions with
 * `incomplete=true` so a truncated stream never surfaces as "current";
 * callers who need visibility into the incomplete tail should use
 * `listArtifactVersions`, which returns every row with the flag.
 */
export async function getLatestArtifactVersion(
  db: DbClient,
  scope: TenantScope,
  artifactId: string,
): Promise<ArtifactVersionRow | undefined> {
  const artifact = await getArtifact(db, scope, artifactId);
  if (!artifact) return undefined;

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
    .where(
      and(
        eq(artifactVersions.artifactId, artifactId),
        eq(artifactVersions.incomplete, false),
      ),
    )
    .orderBy(desc(artifactVersions.versionNumber))
    .limit(1);
  return row;
}
