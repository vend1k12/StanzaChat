import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

/**
 * Root route.
 *
 * StanzaChat has no public marketing landing — the app opens straight
 * on the workspace. Authenticated visitors land on `/chats`
 * (draft-chat mode until they send their first message); anonymous
 * visitors are bounced to sign-in with a redirect back to `/chats`.
 *
 * `force-dynamic`: reads the request session (cookies) via
 * `getSession()`, which parses env at runtime — cannot be statically
 * prerendered.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? "/chats" : "/auth/sign-in?redirect=/chats");
}
