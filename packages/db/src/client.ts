import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema.js";

export type Db = ReturnType<typeof createDb>;

/**
 * Create a Drizzle database client from a Postgres connection string.
 *
 * Used by Better-Auth's Drizzle adapter and by all app data-access
 * functions. Node-postgres (`pg`) is the driver; the production runtime
 * is Node.js ≥ 20 (SPEC §2). Bun is the package manager / task runner
 * only, so we use the standard `pg` Pool which is Bun-compatible.
 */
export function createDb(databaseUrl: string) {
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
