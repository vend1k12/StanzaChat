"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

/**
 * Client sign-in form (SPEC §5.4). Uses Better-Auth's client — server-side
 * `getSession()` recognises the cookie on the next request.
 *
 * On success we `router.push(redirect ?? "/chats")` and `router.refresh()`
 * so the server layout re-fetches the session and any middleware guard
 * short-circuits normally.
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Sign in to your StanzaChat workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href={signUpHref} className="text-foreground underline">
            Sign up
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
