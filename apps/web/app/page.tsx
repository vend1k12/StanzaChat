import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

/**
 * Landing page (SPEC §1). Editorial hero on the warm-canvas surface —
 * cream floor, serif display headline, coral primary CTA.
 *
 * `force-dynamic`: the page reads the request session (cookies) via
 * `getSession()`, which parses env at runtime — it cannot be
 * statically prerendered.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect("/chats");
  }

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-canvas">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2 text-ink">
          <span className="spike-mark" aria-hidden />
          <span className="font-display text-[22px] leading-none tracking-tight">
            StanzaChat
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/auth/sign-in" className="text-ink/80 hover:text-ink">
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/auth/sign-up">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-16 px-8 py-24 md:grid-cols-12 md:py-32">
        <div className="md:col-span-7">
          <p className="eyebrow mb-6">Self-hosted · Apache 2.0</p>
          <h1 className="font-display text-[56px] leading-[1.02] tracking-[-0.035em] text-ink md:text-[72px]">
            A calmer place
            <br />
            to think with
            <br />
            an&nbsp;
            <span className="text-coral">assistant.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-body">
            StanzaChat is an open-source AI workspace you run yourself. Split
            conversation and artifacts, isolate tenants by design, keep provider
            keys encrypted at rest. No SaaS in the middle.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">Create your workspace</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>

        <aside className="relative md:col-span-5">
          <div className="surface-dark rounded-2xl p-6 shadow-[0_20px_60px_-30px_rgba(20,20,19,0.35)]">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <span className="size-2.5 rounded-full bg-[#f0776e]" />
              <span className="size-2.5 rounded-full bg-[#f5c04a]" />
              <span className="size-2.5 rounded-full bg-[#5db872]" />
              <span className="ml-3 font-mono text-[11px] tracking-wider text-on-dark-soft">
                stanzachat › /chats/welcome
              </span>
            </div>
            <div className="mt-5 space-y-4 font-mono text-[13px] leading-relaxed">
              <p className="text-on-dark-soft">› user</p>
              <p className="text-on-dark">
                Draft a landing hero for a warm, self-hosted AI product.
              </p>
              <p className="text-on-dark-soft">› assistant</p>
              <p className="text-on-dark">
                <span className="text-coral">&lt;artifact</span> identifier=
                <span className="text-[#e8a55a]">
                  &quot;landing-hero&quot;
                </span>{" "}
                type=
                <span className="text-[#e8a55a]">&quot;text/html&quot;</span>
                <span className="text-coral">&gt;</span>
                <br />
                &nbsp;&nbsp;A calmer place to think…
                <br />
                <span className="text-coral">&lt;/artifact&gt;</span>
              </p>
              <p className="text-on-dark-soft">
                <span className="inline-block size-2 rounded-full bg-accent-teal" />{" "}
                <span className="ml-1">rendered in sandbox · v2</span>
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-muted-ink">
            <div className="rounded-lg border border-hairline bg-surface-card px-3 py-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                Tenancy
              </p>
              <p className="mt-1 text-ink">Org → workspace</p>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-card px-3 py-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                Keys
              </p>
              <p className="mt-1 text-ink">AES-256-GCM</p>
            </div>
            <div className="rounded-lg border border-hairline bg-surface-card px-3 py-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                Sandbox
              </p>
              <p className="mt-1 text-ink">Origin-null iframe</p>
            </div>
          </div>
        </aside>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-6 text-xs text-muted-ink">
          <span>© {new Date().getFullYear()} StanzaChat contributors</span>
          <span className="font-mono">Apache-2.0 · v0.1</span>
        </div>
      </footer>
    </main>
  );
}
