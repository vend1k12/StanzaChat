import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in — StanzaChat" };

/**
 * `/auth/sign-in` — editorial two-column shell with the Better-Auth
 * email/password form on the right. `<Suspense>` wraps the client form
 * because it reads `useSearchParams()` (redirect target).
 */
export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      headline={
        <>
          Pick up
          <br />
          where you left <span className="text-coral">off.</span>
        </>
      }
      lede="Sign in to your StanzaChat workspace to continue chats, review artifacts, and manage instance settings."
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
