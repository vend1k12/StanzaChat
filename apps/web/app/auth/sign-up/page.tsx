import { Suspense } from "react";

import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Sign up — StanzaChat" };

/**
 * `/auth/sign-up` — server shell that renders the client-side sign-up form
 * (Better-Auth flow via `authClient.signUp.email`).
 *
 * `<Suspense>` wraps the form because it reads `useSearchParams()`, which
 * would otherwise bail out static prerender at build time
 * (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
 */
export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center p-6">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </main>
  );
}
