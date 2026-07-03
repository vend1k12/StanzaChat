import { Suspense } from "react";

import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in — StanzaChat" };

/**
 * `/auth/sign-in` — server shell that renders the client-side sign-in form
 * (Better-Auth flow via `authClient.signIn.email`).
 *
 * `<Suspense>` wraps the form because it reads `useSearchParams()`, which
 * would otherwise bail out static prerender at build time
 * (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
 */
export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center p-6">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
