"use client";

import { REGISTRATION_MODES, type RegistrationMode } from "@repo/shared";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  useAdminSettings,
  useUpdateAdminSettings,
} from "@/lib/hooks/use-admin";

/**
 * `/admin/settings` — SPEC §5.5.
 *
 * v0.1 exposes only `registration_mode`. `setup_completed` is a read-only
 * status marker set by the first-run promotion (SPEC §5.4).
 */
export default function AdminSettingsPage() {
  const { data: settings, isLoading, error } = useAdminSettings();
  const update = useUpdateAdminSettings();

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold">Instance settings</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        ) : settings ? (
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="registrationMode">Registration mode</Label>
              <Select
                value={settings.registrationMode}
                onValueChange={async (value) => {
                  try {
                    await update.mutateAsync({
                      registrationMode: value as RegistrationMode,
                    });
                    toast.success("Registration mode updated");
                  } catch (err) {
                    toast.error(
                      err instanceof ApiError ? err.message : "Update failed",
                    );
                  }
                }}
              >
                <SelectTrigger id="registrationMode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGISTRATION_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                <b>open</b> — anyone can sign up. <b>invite_only</b> — new
                accounts require an organization invitation. <b>closed</b> —
                sign-up is disabled entirely.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Setup completed:{" "}
              <span className="font-mono">
                {settings.setupCompleted ? "yes" : "no"}
              </span>
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() =>
                  update.mutate({
                    registrationMode: settings.registrationMode,
                  })
                }
                disabled={update.isPending}
              >
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Settings row missing — restart the app to re-run first-run setup.
          </p>
        )}
      </section>
    </div>
  );
}
