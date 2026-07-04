import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

/**
 * Landing page. If the visitor already has a session, hand them straight
 * to `/chats`; otherwise render a minimal splash pointing at the auth pages.
 *
 * `force-dynamic`: the page reads the request session (cookies) via
 * `getSession()`, which also parses env at runtime — so it cannot be
 * statically prerendered at build time.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect("/chats");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">StanzaChat</h1>
        <p className="text-muted-foreground">
          Open-source, self-hosted AI workspace.
        </p>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </nav>
    </main>
  );
}
