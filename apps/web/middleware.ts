import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Middleware guard for private workspace pages.
 *
 * Public paths (not matched by `config.matcher`):
 *   - `/`             — landing page (handles its own signed-in redirect)
 *   - `/auth/*`       — sign-in / sign-up
 *   - `/api/*`        — route handlers own their auth checks
 *
 * Private paths (matched):
 *   - `/chats`, `/chats/*`
 *
 * We do a presence-only check on the signed session cookie (Better-Auth's
 * `getSessionCookie`). This is fast-path guidance from the Better-Auth
 * docs — it does NOT re-validate the session against Postgres. Real
 * authorization still happens inside every route handler via
 * `requireSessionScope()`.
 */
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chats", "/chats/:path*"],
};
