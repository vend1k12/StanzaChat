import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better-Auth client.
 *
 * Used by sign-in/sign-up pages and any client component that needs
 * to call auth endpoints. The `organizationClient` plugin mirrors the
 * server-side `organization` plugin.
 */
// The client is not exported — the `ReturnType<typeof createAuthClient>`
// contract would be a coupled implementation detail (project rule
// ts-no-return-type). Consumers reach for the destructured methods
// below, whose types are inferred at the local binding without
// re-publishing the factory's return shape as a public alias.
const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
