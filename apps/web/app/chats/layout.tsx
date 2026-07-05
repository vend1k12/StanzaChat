import { redirect } from "next/navigation";

import { ViewerProvider } from "@/components/workspace/viewer-context";
import { getSession } from "@/lib/session";

/**
 * Server-side guard for the `/chats` segment (SPEC §5.1).
 *
 * Reads the Better-Auth session from request cookies via `getSession`
 * and injects the viewer's admin flag into the client subtree via
 * `ViewerProvider` — Better-Auth's client `useSession` does not surface
 * the `admin` plugin's `role`, so we source it here.
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
  const isAdmin = session.user.role === "admin";

  return (
    <div className="h-dvh w-full">
      <ViewerProvider value={{ isAdmin }}>{children}</ViewerProvider>
    </div>
  );
}
