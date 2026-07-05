"use client";

import { REGISTRATION_MODES, type RegistrationMode } from "@repo/shared";
import { CheckCircle2, DoorClosed, DoorOpen, Mail } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { ApiError } from "@/lib/api";
import {
  useAdminSettings,
  useUpdateAdminSettings,
} from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";

/**
 * `/admin/settings` — SPEC §5.5.
 *
 * v0.1 exposes only `registration_mode`. `setup_completed` is a read-only
 * status marker set by the first-run promotion (SPEC §5.4).
 */
const MODE_META: Record<
  RegistrationMode,
  {
    label: string;
    description: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
  }
> = {
  open: {
    label: "Open",
    description:
      "Anyone can sign up. Fine for a shared team instance behind a private URL.",
    icon: DoorOpen,
  },
  invite_only: {
    label: "Invite only",
    description:
      "New accounts require an organization invitation. Default state after first-run promotion.",
    icon: Mail,
  },
  closed: {
    label: "Closed",
    description:
      "Sign-up is disabled entirely. Existing users can still log in.",
    icon: DoorClosed,
  },
};

export default function AdminSettingsPage() {
  const { data: settings, isLoading, error } = useAdminSettings();
  const update = useUpdateAdminSettings();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Instance · Settings"
        title="Registration and instance state"
        lede="Choose who can create an account on this instance. Every change is audit-logged with before/after metadata."
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg border border-hairline bg-surface-card"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-error">
          {error instanceof Error ? error.message : "Failed to load"}
        </p>
      ) : settings ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {REGISTRATION_MODES.map((mode) => {
              // `mode` is a literal from REGISTRATION_MODES, not user input.
              // eslint-disable-next-line security/detect-object-injection
              const meta = MODE_META[mode];
              const Icon = meta.icon;
              const active = settings.registrationMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={update.isPending}
                  onClick={async () => {
                    if (active) return;
                    try {
                      await update.mutateAsync({ registrationMode: mode });
                      toast.success(`Registration set to ${meta.label}`);
                    } catch (err) {
                      toast.error(
                        err instanceof ApiError ? err.message : "Update failed",
                      );
                    }
                  }}
                  className={cn(
                    "group relative flex flex-col items-start rounded-2xl border p-6 text-left transition",
                    active
                      ? "border-coral/60 bg-coral/5 shadow-[0_20px_40px_-30px_rgba(204,120,92,0.6)]"
                      : "border-hairline bg-canvas hover:border-hairline hover:bg-surface-card",
                    update.isPending && "opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full border transition",
                      active
                        ? "border-coral/50 bg-coral/15 text-coral"
                        : "border-hairline bg-surface-card text-body",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-5 font-display text-[26px] leading-tight tracking-[-0.02em] text-ink">
                    {meta.label}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-body">
                    {meta.description}
                  </p>
                  {active ? (
                    <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-2.5 py-1 font-mono text-[10px] tracking-widest text-on-primary uppercase">
                      <CheckCircle2 className="size-3" />
                      current
                    </span>
                  ) : (
                    <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-2.5 py-1 font-mono text-[10px] tracking-widest text-muted-ink uppercase transition group-hover:border-coral/40 group-hover:text-coral">
                      switch to {meta.label.toLowerCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <section className="rounded-lg border border-hairline bg-surface-card p-6">
            <p className="eyebrow mb-3">Instance state</p>
            <div className="flex flex-wrap items-center gap-6">
              <StateRow
                label="Setup completed"
                value={settings.setupCompleted ? "yes" : "no"}
                tone={settings.setupCompleted ? "teal" : "muted"}
              />
              <StateRow label="Instance id" value={settings.id} mono />
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-ink">
          Settings row missing — restart the app to re-run first-run setup.
        </p>
      )}
    </div>
  );
}

function StateRow({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "teal" | "muted";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] tracking-widest text-muted-ink uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-sm",
          mono && "font-mono",
          tone === "teal" && "text-accent-teal",
          tone === "muted" && "text-muted-ink",
          !tone && "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}
