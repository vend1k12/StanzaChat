import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Sign up — StanzaChat" };

/**
 * `/auth/sign-up` — editorial two-column shell. First successful sign-up
 * becomes the instance admin (SPEC §5.4).
 */
export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="First run · Set up"
      headline={
        <>
          A workspace
          <br />
          for your own
          <br />
          <span className="text-coral">thinking.</span>
        </>
      }
      lede="Create your account to spin up a personal organization, a default workspace, and — if you are the very first user — instance-admin rights."
    >
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
