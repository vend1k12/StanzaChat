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
import { signUp } from "@/lib/auth-client";

/**
 * Client sign-up form (SPEC §5.4). Better-Auth's `admin` plugin promotes
 * the first successful sign-up to instance admin and auto-creates a
 * personal organization + default workspace via the server-side hook.
 *
 * On success we `router.push(redirect ?? "/chats")` and `router.refresh()`
 * so the server session read picks up the newly-issued cookie.
 */
export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/chats";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    try {
      const { error } = await signUp.email({ name, email, password });
      if (error) {
        toast.error(error.message ?? "Sign up failed");
        return;
      }
      router.push(redirect);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setIsPending(false);
    }
  }

  const signInHref = redirect
    ? `/auth/sign-in?redirect=${encodeURIComponent(redirect)}`
    : "/auth/sign-in";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Set up your StanzaChat workspace in a few seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link href={signInHref} className="text-foreground underline">
            Sign in
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
