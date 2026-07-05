"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

/**
 * Client sign-in form (SPEC §5.4). Uses Better-Auth's client — server-side
 * `getSession()` recognises the cookie on the next request.
 *
 * On success we `router.push(redirect ?? "/chats")` and `router.refresh()`
 * so the server layout re-fetches the session.
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/chats";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    try {
      const { error } = await signIn.email({ email, password });
      if (error) {
        toast.error(error.message ?? "Sign in failed");
        return;
      }
      router.push(redirect);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsPending(false);
    }
  }

  const signUpHref = redirect
    ? `/auth/sign-up?redirect=${encodeURIComponent(redirect)}`
    : "/auth/sign-up";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow mb-3">Sign in</p>
        <h2 className="font-display text-[32px] leading-tight tracking-[-0.02em] text-ink">
          Sign in to your workspace
        </h2>
        <p className="mt-2 text-sm text-muted-ink">
          Use the credentials you set at first-run.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-sm text-muted-ink">
        No account yet?{" "}
        <Link href={signUpHref} className="text-coral hover:underline">
          Create one
        </Link>
        .
      </p>
    </div>
  );
}
