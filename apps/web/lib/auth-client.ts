import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better-Auth client.
 *
 * Used by sign-in/sign-up pages and any client component that needs
 * to call auth endpoints. The `organizationClient` plugin mirrors the
 * server-side `organization` plugin.
 */
// Type annotation is necessary because the inferred type references
// internal better-auth module paths that tsc cannot resolve portably.
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient(
  {
    plugins: [organizationClient()],
  },
);

export const { signIn, signUp, signOut, useSession } = authClient;
