"use client";

import { LLM_PROVIDERS, type LlmProvider } from "@repo/shared";
import { Check, KeyRound, Plus, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  useCreateProvider,
  useDeleteProvider,
  useProviders,
  useUpdateProvider,
} from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";

/**
 * `/admin/providers` — SPEC §5.5.
 *
 * Editorial three-panel layout: stats strip → provider list → add-form
 * behind a modal. The API key column is a UI-only masked fingerprint
 * (guardrails #3): the server never returns keys, so we only know
 * whether one is set (`hasApiKey`).
 */
export default function AdminProvidersPage() {
  const { data: providers, isLoading, error } = useProviders();
  const createProvider = useCreateProvider();

  const total = providers?.length ?? 0;
  const enabled = providers?.filter((p) => p.enabled).length ?? 0;
  const withKey = providers?.filter((p) => p.hasApiKey).length ?? 0;
  const defaultId = providers?.find((p) => p.isDefault)?.id ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Instance · Providers"
        title="Bring your own model providers"
        lede="Register OpenAI-compatible endpoints or first-party providers. Keys are encrypted at rest with AES-256-GCM and never returned to the browser."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" data-testid="open-add-provider">
                <Plus className="size-4" />
                Add provider
              </Button>
            </DialogTrigger>
            <AddProviderDialog
              onSubmitted={() => setDialogOpen(false)}
              pending={createProvider.isPending}
            />
          </Dialog>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard eyebrow="Total" value={total} />
        <StatCard eyebrow="Enabled" value={enabled} tone="teal" />
        <StatCard eyebrow="With key" value={withKey} />
        <StatCard
          eyebrow="Default"
          value={defaultId ? "set" : "—"}
          valueTone={defaultId ? "coral" : "muted"}
        />
      </section>

      <section>
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <p className="text-sm text-error">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        ) : providers && providers.length > 0 ? (
          <ul className="flex flex-col gap-3" data-testid="providers-table">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </ul>
        ) : (
          <EmptyState onAddClick={() => setDialogOpen(true)} />
        )}
      </section>
    </div>
  );
}

function StatCard({
  eyebrow,
  value,
  tone = "default",
  valueTone,
}: {
  eyebrow: string;
  value: number | string;
  tone?: "default" | "teal";
  valueTone?: "coral" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-hairline bg-surface-card px-5 py-4",
        tone === "teal" && "border-accent-teal/30 bg-accent-teal/10",
      )}
    >
      <p className="eyebrow">{eyebrow}</p>
      <p
        className={cn(
          "mt-2 font-display text-[36px] leading-none tracking-[-0.02em] text-ink",
          valueTone === "coral" && "text-coral",
          valueTone === "muted" && "text-muted-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border border-hairline bg-surface-card"
        />
      ))}
    </div>
  );
}

function EmptyState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft px-10 py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-coral/10 text-coral">
        <KeyRound className="size-5" />
      </div>
      <h3 className="mt-5 font-display text-[24px] leading-tight tracking-tight text-ink">
        No providers configured yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-body">
        Add your first provider to unlock chat and artifacts. All keys are
        encrypted before they land in the database.
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={onAddClick}>
          <Plus className="size-4" />
          Add provider
        </Button>
      </div>
    </div>
  );
}

function ProviderCard({
  provider: p,
}: {
  provider: ReturnType<typeof useProviders>["data"] extends
    Array<infer P> | undefined
    ? P
    : never;
}) {
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const [rotate, setRotate] = useState("");
  const [rotateOpen, setRotateOpen] = useState(false);

  return (
    <li
      className="group grid grid-cols-1 items-center gap-4 rounded-lg border border-hairline bg-canvas px-5 py-4 transition hover:border-hairline hover:shadow-[0_2px_20px_-14px_rgba(20,20,19,0.4)] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
      data-testid={`provider-row-${p.id}`}
    >
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-card font-mono text-xs tracking-widest text-ink uppercase",
            p.isDefault && "border-coral/40 bg-coral/10 text-coral",
          )}
        >
          {p.provider.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-[20px] leading-tight tracking-[-0.02em] text-ink">
              {p.label}
            </p>
            {p.isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-coral px-2 py-0.5 font-mono text-[10px] tracking-widest text-on-primary uppercase">
                <Star className="size-2.5" />
                default
              </span>
            ) : null}
            {!p.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-cream-strong px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                disabled
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-ink">
            {p.provider}
            {p.enabledModels.length > 0
              ? ` · ${p.enabledModels.length} model${p.enabledModels.length === 1 ? "" : "s"}`
              : " · no models yet"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="eyebrow">Key</span>
        <span
          className={cn(
            "font-mono text-xs",
            p.hasApiKey ? "text-ink" : "text-muted-soft",
          )}
          data-testid={`provider-key-${p.id}`}
        >
          {p.hasApiKey ? "••••••••" : "—"}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {rotateOpen ? (
          <div className="flex items-center gap-1">
            <Input
              placeholder="new key"
              type="password"
              autoComplete="off"
              className="h-9 w-44"
              value={rotate}
              onChange={(event) => setRotate(event.target.value)}
              autoFocus
            />
            <Button
              size="sm"
              onClick={async () => {
                if (!rotate) return;
                try {
                  await updateProvider.mutateAsync({
                    id: p.id,
                    updates: { apiKey: rotate },
                  });
                  setRotate("");
                  setRotateOpen(false);
                  toast.success("Key rotated");
                } catch (err) {
                  toast.error(
                    err instanceof ApiError ? err.message : "Rotate failed",
                  );
                }
              }}
            >
              <Check className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRotate("");
                setRotateOpen(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRotateOpen(true)}
          >
            Rotate key
          </Button>
        )}

        {!p.isDefault ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateProvider.mutate({
                id: p.id,
                updates: { isDefault: true },
              })
            }
          >
            <Star className="size-3.5" />
            Make default
          </Button>
        ) : null}

        <Button
          size="sm"
          variant={p.enabled ? "outline" : "default"}
          onClick={() =>
            updateProvider.mutate({
              id: p.id,
              updates: { enabled: !p.enabled },
            })
          }
        >
          {p.enabled ? "Disable" : "Enable"}
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (
              confirm(
                `Delete provider "${p.label}"? This cannot be undone — audit row remains.`,
              )
            ) {
              deleteProvider.mutate(p.id);
            }
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

function AddProviderDialog({
  onSubmitted,
  pending,
}: {
  onSubmitted: () => void;
  pending: boolean;
}) {
  const createProvider = useCreateProvider();
  const [form, setForm] = useState({
    provider: "openai" as LlmProvider,
    label: "",
    baseUrl: "",
    apiKey: "",
    enabledModels: "",
    isDefault: false,
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-display text-[26px] leading-tight tracking-tight">
          Add a model provider
        </DialogTitle>
        <DialogDescription>
          The API key is encrypted with AES-256-GCM before storage and never
          returned to the browser.
        </DialogDescription>
      </DialogHeader>
      <form
        className="mt-2 flex flex-col gap-4"
        data-testid="provider-form"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await createProvider.mutateAsync({
              provider: form.provider,
              label: form.label,
              baseUrl: form.baseUrl || undefined,
              apiKey: form.apiKey || undefined,
              enabledModels: form.enabledModels
                .split(",")
                .map((m) => m.trim())
                .filter(Boolean),
              isDefault: form.isDefault,
            });
            setForm({
              provider: "openai",
              label: "",
              baseUrl: "",
              apiKey: "",
              enabledModels: "",
              isDefault: false,
            });
            toast.success("Provider added");
            onSubmitted();
          } catch (err) {
            toast.error(
              err instanceof ApiError ? err.message : "Failed to add provider",
            );
          }
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={form.provider}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  provider: value as LlmProvider,
                }))
              }
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_PROVIDERS.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              required
              placeholder="Production OpenAI"
              value={form.label}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, label: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="baseUrl">Base URL (optional)</Label>
          <Input
            id="baseUrl"
            value={form.baseUrl}
            placeholder="https://api.example.com/v1"
            onChange={(event) =>
              setForm((prev) => ({ ...prev, baseUrl: event.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="apiKey">API key</Label>
          <Input
            id="apiKey"
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={form.apiKey}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, apiKey: event.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="enabledModels">
            Enabled models{" "}
            <span className="text-muted-ink">(comma-separated)</span>
          </Label>
          <Input
            id="enabledModels"
            value={form.enabledModels}
            placeholder="gpt-4o-mini, gpt-4o"
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                enabledModels: event.target.value,
              }))
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-body">
          <input
            type="checkbox"
            className="size-4 accent-[--coral]"
            checked={form.isDefault}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                isDefault: event.target.checked,
              }))
            }
          />
          Make this the default provider
        </label>
        <DialogFooter className="mt-2">
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            data-testid="provider-submit"
          >
            {pending ? "Adding…" : "Add provider"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
