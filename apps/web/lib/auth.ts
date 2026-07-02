import type { Auth } from "@repo/auth/config";
import { createAuth } from "@repo/auth/config";
import { getDb } from "@repo/db/client";
import { parseEnv } from "@repo/shared/env";

/**
 * Server-side Better-Auth instance.
 *
 * Created lazily on first access so env validation + db pool creation
 * happen at request time, not at build time. Next.js Route Handlers and
 * Server Components call `getAuth()` to obtain the singleton.
 */

let authInstance: Auth | undefined;

export function getAuth(): Auth {
  if (!authInstance) {
    const env = parseEnv();
    const db = getDb(env.DATABASE_URL);
    authInstance = createAuth({ db, env });
  }
  return authInstance;
}
