import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

/**
 * Server-side guard for the `/chats` segment (SPEC §5.1).
 *
 * Reads the Better-Auth session from request cookies via `getSession`.
 * Unauthenticated visitors are redirected to the sign-in page with a
 * `redirect` query param so sign-in can bounce them back. `force-dynamic`
 * is required because the layout reads request-scoped cookies/headers.
 */
export const dynamic = "force-dynamic";

export default async function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/sign-in?redirect=/chats");
  }

  return <div className="h-dvh w-full">{children}</div>;
}
