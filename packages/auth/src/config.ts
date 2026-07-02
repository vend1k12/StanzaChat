import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Db } from "@repo/db";
import { schema } from "@repo/db/schema";
import {
  createPersonalOrgAndWorkspace,
  ensureInstanceSettings,
  promoteFirstUserToAdmin,
} from "@repo/db/setup";
import type { Env } from "@repo/shared";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";

/**
 * Better-Auth server configuration (SPEC §5.4).
 *
 * Email/password auth with Postgres sessions, the `organization` plugin
 * for multi-tenancy, and the `admin` plugin for instance administration.
 *
 * First-run logic (SPEC §5.4): after the first user is created, they are
 * promoted to instance admin, instance_settings.setup_completed is set
 * to true, and registration_mode flips to invite_only. This runs in the
 * `databaseHooks.user.create.after` hook, which fires after Better-Auth
 * has committed the user row.
 *
 * The personal org + default workspace are also created in the after-hook
 * so every new user gets the tenant chain (org → workspace) on signup.
 */

export interface AuthConfig {
  db: Db;
  env: Env;
}

export function createAuth({ db, env }: AuthConfig) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
      }),
      admin({
        defaultRole: "user",
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (newUser) => {
            // 1. Ensure instance_settings singleton exists (idempotent).
            await ensureInstanceSettings(db);

            // 2. Promote first user to admin + flip registration mode.
            //    promoteFirstUserToAdmin checks user count atomically.
            await promoteFirstUserToAdmin(db, newUser.id);

            // 3. Create personal org + default workspace for every user.
            await createPersonalOrgAndWorkspace(db, {
              userId: newUser.id,
              userName: newUser.name,
              userEmail: newUser.email,
            });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
