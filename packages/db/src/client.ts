import type {
  NodePgDatabase,
  NodePgTransaction,
} from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm/relations";
import { Pool } from "pg";

import { type Schema,schema } from "./schema.js";

/**
 * Concrete Drizzle database client used by every data-access function.
 *
 * Named directly (not `ReturnType<typeof createDb>`) so JSDoc and changelog
 * notes attach to the type and consumers stop coupling to implementation
 * names. See `docs/agents/conventions.md`.
 */
export type Db = NodePgDatabase<Schema>;

/**
 * The transaction handle Drizzle hands to the callback of `db.transaction`.
 * Structurally the same query builder as `Db`, plus rollback/commit hooks.
 */
export type DbTx = NodePgTransaction<Schema, ExtractTablesWithRelations<Schema>>;

/**
 * Accepts either a top-level `Db` or an in-flight transaction `DbTx`.
 * Data-access functions that participate in a `db.transaction(...)` block
 * take this widened parameter so callers can compose them into an
 * all-or-nothing commit.
 */
export type DbClient = Db | DbTx;

/**
 * Create a Drizzle database client from a Postgres connection string.
 *
 * Used by Better-Auth's Drizzle adapter and by all app data-access
 * functions. Node-postgres (`pg`) is the driver; the production runtime
 * is Node.js ≥ 20 (SPEC §2). Bun is the package manager / task runner
 * only, so we use the standard `pg` Pool which is Bun-compatible.
 */
export function createDb(databaseUrl: string): Db {
  const pool = new Pool({ connectionString: databaseUrl });
  // `casing: "snake_case"` maps camelCase Drizzle field names to
  // snake_case column names automatically, per docs/agents/conventions.md:
  // "DB: snake_case tables/columns; Drizzle objects camelCase".
  return drizzle(pool, { schema, casing: "snake_case" });
}

let cachedDb: Db | undefined;

/**
 * Returns a process-wide singleton db client. Call after env validation.
 */
export function getDb(databaseUrl: string): Db {
  if (!cachedDb) {
    cachedDb = createDb(databaseUrl);
  }
  return cachedDb;
}

/** Reset the cached client — used in tests where each container gets its own db. */
export function resetDbCache(): void {
  cachedDb = undefined;
}
