"use client";

import type { ProviderRecord } from "@repo/ai";
import { LLM_PROVIDERS, type LlmProvider } from "@repo/shared";
import {
  Check,
  ChevronDown,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { useConfirm } from "@/components/confirm-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { errorMessage, fieldError } from "@/lib/error-message";
import {
  type ProviderModelDto,
  useCreateProvider,
  useDeleteProvider,
  useDiscoverModels,
  useDiscoverProviderModels,
  useProviderModels,
  useProviders,
  useUpdateProvider,
  useUpdateProviderModel,
} from "@/lib/hooks/use-admin";
import { cn } from "@/lib/utils";

/**
 * `/admin/providers` — SPEC §5.5.
 *
 * Register and manage instance-level model providers. Each row lets the
 * admin toggle enabled/default, edit connection details in a modal
 * (`ProviderFormDialog`), and drill into per-model settings
 * (`ModelSettingsDialog`). Deletion is confirmed through the global
 * `useConfirm()` surface, replacing the native `confirm()` prompt.
 *
 * The "Discover models" affordance probes the provider's OpenAI-compatible
 * `/v1/models` endpoint server-side (openai / openai-compatible / ollama)
 * so admins don't hand-type model ids.
 */
type FormMode = { kind: "closed" } | { kind: "add" } | { kind: "edit"; provider: ProviderRecord };

export default function AdminProvidersPage() {
  const { data: providers, isLoading, error } = useProviders();

  const total = providers?.length ?? 0;
  const enabled = providers?.filter((p) => p.enabled).length ?? 0;
  const withKey = providers?.filter((p) => p.hasApiKey).length ?? 0;
  const defaultId = providers?.find((p) => p.isDefault)?.id ?? null;

  const [formMode, setFormMode] = useState<FormMode>({ kind: "closed" });
  const [modelSettingsFor, setModelSettingsFor] = useState<ProviderRecord | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Instance · Providers"
        title="Bring your own model providers"
        lede="Register OpenAI-compatible endpoints or first-party providers. Keys are encrypted at rest with AES-256-GCM and never returned to the browser."
        actions={
          <Button
            size="lg"
            data-testid="open-add-provider"
            onClick={() => setFormMode({ kind: "add" })}
          >
            <Plus className="size-4" />
            Add provider
          </Button>
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
          <p className="text-sm text-error">{errorMessage(error)}</p>
        ) : providers && providers.length > 0 ? (
          <ul className="flex flex-col gap-3" data-testid="providers-table">
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onEdit={() => setFormMode({ kind: "edit", provider: p })}
                onManageModels={() => setModelSettingsFor(p)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState onAddClick={() => setFormMode({ kind: "add" })} />
        )}
      </section>

      <ProviderFormDialog
        mode={formMode}
        onClose={() => setFormMode({ kind: "closed" })}
      />

      {modelSettingsFor ? (
        <ModelSettingsDialog
          provider={modelSettingsFor}
          onClose={() => setModelSettingsFor(null)}
        />
      ) : null}
    </div>
  );
}

// ── Stat / empty / skeleton ─────────────────────────────────────────

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

// ── Provider row card ───────────────────────────────────────────────

function ProviderCard({
  provider: p,
  onEdit,
  onManageModels,
}: {
  provider: ProviderRecord;
  onEdit: () => void;
  onManageModels: () => void;
}) {
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const confirm = useConfirm();

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete provider "${p.label}"?`,
      description:
        "This removes the provider and every per-model setting. Chats keep their history but stop replying until you add a replacement. The audit row remains.",
      confirmLabel: "Delete provider",
      tone: "destructive",
    });
    if (!ok) return;
    deleteProvider.mutate(p.id, {
      onError: (err) => toast.error(errorMessage(err, "Delete failed")),
      onSuccess: () => toast.success(`Deleted "${p.label}"`),
    });
  }

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
            {p.baseUrl ? ` · ${p.baseUrl}` : ""}
            {" · "}
            {p.models.length > 0
              ? `${p.models.length} model${p.models.length === 1 ? "" : "s"}`
              : "no models yet"}
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
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={onManageModels}>
          <Settings2 className="size-3.5" />
          Models
        </Button>

        {!p.isDefault ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateProvider.mutate(
                { id: p.id, updates: { isDefault: true } },
                {
                  onError: (err) =>
                    toast.error(errorMessage(err, "Failed to set default")),
                },
              )
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
            updateProvider.mutate(
              { id: p.id, updates: { enabled: !p.enabled } },
              {
                onError: (err) =>
                  toast.error(errorMessage(err, "Toggle failed")),
              },
            )
          }
        >
          {p.enabled ? "Disable" : "Enable"}
        </Button>

        <Button size="sm" variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

// ── Provider form (Add / Edit) ──────────────────────────────────────

interface ProviderFormState {
  provider: LlmProvider;
  label: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  isDefault: boolean;
}

function ProviderFormDialog({
  mode,
  onClose,
}: {
  mode: FormMode;
  onClose: () => void;
}) {
  const isEdit = mode.kind === "edit";
  const editing = mode.kind === "edit" ? mode.provider : null;

  const [form, setForm] = useState<ProviderFormState>(initialForm(mode));
  const [error, setError] = useState<ApiError | null>(null);

  // Reset the form each time the dialog opens (or the edited row changes).
  useEffect(() => {
    if (mode.kind !== "closed") {
      setForm(initialForm(mode));
      setError(null);
    }
  }, [mode]);

  const create = useCreateProvider();
  const update = useUpdateProvider();
  const discoverAnon = useDiscoverModels();
  const discoverExisting = useDiscoverProviderModels();

  const supportsDiscover =
    form.provider === "openai" ||
    form.provider === "openai-compatible" ||
    form.provider === "ollama";
  const discoveryPending = discoverAnon.isPending || discoverExisting.isPending;

  async function handleDiscover() {
    setError(null);
    try {
      const result =
        editing && editing.hasApiKey && !form.apiKey
          ? await discoverExisting.mutateAsync(editing.id)
          : await discoverAnon.mutateAsync({
              provider: form.provider,
              baseUrl: form.baseUrl || undefined,
              apiKey: form.apiKey || undefined,
            });
      // Merge: keep already-selected models the user chose, add any new
      // ones the server reports, drop dupes.
      const merged = [...new Set([...form.models, ...result.models])].sort(
        (a, b) => a.localeCompare(b),
      );
      setForm((prev) => ({ ...prev, models: merged }));
      toast.success(
        `Discovered ${result.models.length} model${result.models.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      if (err instanceof ApiError) setError(err);
      toast.error(errorMessage(err, "Discovery failed"));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isEdit && editing) {
        await update.mutateAsync({
          id: editing.id,
          updates: {
            label: form.label,
            baseUrl: form.baseUrl || undefined,
            apiKey: form.apiKey || undefined,
            models: form.models,
            isDefault: form.isDefault,
          },
        });
        toast.success(`Updated "${form.label}"`);
      } else {
        await create.mutateAsync({
          provider: form.provider,
          label: form.label,
          baseUrl: form.baseUrl || undefined,
          apiKey: form.apiKey || undefined,
          models: form.models,
          isDefault: form.isDefault,
        });
        toast.success(`Added "${form.label}"`);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
      toast.error(errorMessage(err, "Save failed"));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog
      open={mode.kind !== "closed"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-[26px] leading-tight tracking-tight">
            {isEdit ? `Edit provider${editing ? ` — ${editing.label}` : ""}` : "Add a model provider"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rotate the API key by typing a new value; leave it blank to keep the current one."
              : "The API key is encrypted with AES-256-GCM before storage and never returned to the browser."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 flex flex-col gap-4"
          data-testid="provider-form"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(value) =>
                  !isEdit &&
                  setForm((prev) => ({
                    ...prev,
                    provider: value as LlmProvider,
                  }))
                }
                disabled={isEdit}
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
              {isEdit ? (
                <p className="text-[11px] text-muted-ink">
                  Provider kind is locked after creation.
                </p>
              ) : null}
              <FieldError error={error} field="provider" />
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
                aria-invalid={Boolean(fieldError(error, "label"))}
              />
              <FieldError error={error} field="label" />
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
              aria-invalid={Boolean(fieldError(error, "baseUrl"))}
            />
            <FieldError error={error} field="baseUrl" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="apiKey">
              API key
              {isEdit && editing?.hasApiKey ? (
                <span className="ml-2 font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                  key stored
                </span>
              ) : null}
            </Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              placeholder={isEdit && editing?.hasApiKey ? "Leave blank to keep current" : "sk-…"}
              value={form.apiKey}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, apiKey: event.target.value }))
              }
              aria-invalid={Boolean(fieldError(error, "apiKey"))}
            />
            <FieldError error={error} field="apiKey" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="models">Enabled models</Label>
              {supportsDiscover ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDiscover}
                  disabled={discoveryPending}
                >
                  {discoveryPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="size-3.5" />
                  )}
                  Discover from /v1/models
                </Button>
              ) : null}
            </div>
            <ModelChipEditor
              models={form.models}
              onChange={(models) => setForm((prev) => ({ ...prev, models }))}
            />
            <FieldError error={error} field="models" />
            <p className="text-[11px] text-muted-ink">
              {supportsDiscover
                ? "Fetch the model list from the provider or add ids manually."
                : "Add model ids manually — discovery isn't available for this provider."}
            </p>
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

          <FormError error={error} />

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              data-testid="provider-submit"
            >
              {pending
                ? isEdit
                  ? "Saving…"
                  : "Adding…"
                : isEdit
                  ? "Save changes"
                  : "Add provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function initialForm(mode: FormMode): ProviderFormState {
  if (mode.kind === "edit") {
    const p = mode.provider;
    return {
      provider: p.provider,
      label: p.label,
      baseUrl: p.baseUrl ?? "",
      apiKey: "",
      models: p.models.map((m) => m.modelId),
      isDefault: p.isDefault,
    };
  }
  return {
    provider: "openai",
    label: "",
    baseUrl: "",
    apiKey: "",
    models: [],
    isDefault: false,
  };
}

// ── Model chip editor (tokenised text input) ────────────────────────

function ModelChipEditor({
  models,
  onChange,
}: {
  models: string[];
  onChange: (next: string[]) => void;
}) {
  const [pending, setPending] = useState("");
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? models.filter((m) => m.toLowerCase().includes(q)) : models;
  }, [models, filter]);

  function addModel(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (models.includes(trimmed)) return;
    onChange([...models, trimmed].sort((a, b) => a.localeCompare(b)));
    setPending("");
  }

  function removeModel(id: string) {
    onChange(models.filter((m) => m !== id));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-soft p-3">
      <div className="flex flex-wrap gap-1.5">
        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-muted-ink">
            No models yet.
          </p>
        ) : (
          filtered.map((model) => (
            <span
              key={model}
              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2 py-1 font-mono text-[11px] text-ink"
            >
              {model}
              <button
                type="button"
                aria-label={`Remove ${model}`}
                onClick={() => removeModel(model)}
                className="rounded p-0.5 text-muted-ink hover:bg-error/10 hover:text-error"
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        {models.length > 6 ? (
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-ink" />
            <Input
              value={filter}
              placeholder="Filter models…"
              className="h-8 pl-8 text-[12px]"
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        ) : null}
        <Input
          value={pending}
          placeholder="Add model id and press Enter"
          className="h-8 text-[12px]"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addModel(pending);
            }
          }}
          onChange={(event) => setPending(event.target.value)}
          onBlur={() => addModel(pending)}
        />
      </div>
    </div>
  );
}

// ── Per-model settings dialog ──────────────────────────────────────

function ModelSettingsDialog({
  provider,
  onClose,
}: {
  provider: ProviderRecord;
  onClose: () => void;
}) {
  const { data: models, isLoading, error } = useProviderModels(provider.id);

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[26px] leading-tight tracking-tight">
            {provider.label} — per-model settings
          </DialogTitle>
          <DialogDescription>
            Attach generation defaults to each enabled model. Chats using
            the model inherit these unless the chat has its own overrides.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-ink">Loading models…</p>
          ) : error ? (
            <p className="text-sm text-error">{errorMessage(error)}</p>
          ) : !models || models.length === 0 ? (
            <p className="text-sm text-muted-ink">
              No models on this provider yet. Add some in the Edit dialog.
            </p>
          ) : (
            models.map((m) => (
              <ModelSettingRow key={m.id} providerId={provider.id} model={m} />
            ))
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelSettingRow({
  providerId,
  model,
}: {
  providerId: string;
  model: ProviderModelDto;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    displayName: model.displayName ?? "",
    enabled: model.enabled,
    temperature: numberInput(model.temperature),
    topP: numberInput(model.topP),
    maxOutputTokens: numberInput(model.maxOutputTokens),
    systemPrompt: model.systemPrompt ?? "",
  });
  const update = useUpdateProviderModel();

  async function save() {
    try {
      await update.mutateAsync({
        providerId,
        modelId: model.modelId,
        updates: {
          displayName: draft.displayName || null,
          enabled: draft.enabled,
          temperature: parseNumericOrNull(draft.temperature),
          topP: parseNumericOrNull(draft.topP),
          maxOutputTokens: parseNumericOrNull(draft.maxOutputTokens),
          systemPrompt: draft.systemPrompt || null,
        },
      });
      toast.success(`Saved ${model.modelId}`);
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Save failed"));
    }
  }

  return (
    <div className="rounded-lg border border-hairline bg-canvas">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[13px] text-ink">{model.modelId}</p>
            {model.displayName ? (
              <span className="text-[12px] text-muted-ink">
                {model.displayName}
              </span>
            ) : null}
            {!model.enabled ? (
              <span className="rounded-full bg-surface-cream-strong px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-ink uppercase">
                disabled
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-ink">
            {summariseSettings(model)}
          </p>
        </div>
        <ChevronDown
          className={cn("size-4 transition", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-3 border-t border-hairline p-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${model.id}-name`}>Display name</Label>
            <Input
              id={`${model.id}-name`}
              value={draft.displayName}
              placeholder={model.modelId}
              onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm text-body">
            <input
              type="checkbox"
              className="size-4 accent-[--coral]"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            Enabled (visible in the model picker)
          </label>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${model.id}-temp`}>Temperature</Label>
            <Input
              id={`${model.id}-temp`}
              value={draft.temperature}
              placeholder="0.0 – 2.0"
              onChange={(e) => setDraft({ ...draft, temperature: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${model.id}-topp`}>Top-p</Label>
            <Input
              id={`${model.id}-topp`}
              value={draft.topP}
              placeholder="0.0 – 1.0"
              onChange={(e) => setDraft({ ...draft, topP: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${model.id}-max`}>Max output tokens</Label>
            <Input
              id={`${model.id}-max`}
              value={draft.maxOutputTokens}
              placeholder="e.g. 4096"
              onChange={(e) =>
                setDraft({ ...draft, maxOutputTokens: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label htmlFor={`${model.id}-sys`}>Default system prompt</Label>
            <Textarea
              id={`${model.id}-sys`}
              value={draft.systemPrompt}
              rows={3}
              placeholder="Prepended to every chat unless the chat overrides it."
              onChange={(e) =>
                setDraft({ ...draft, systemPrompt: e.target.value })
              }
            />
          </div>
          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={update.isPending}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={update.isPending}
            >
              {update.isPending ? "Saving…" : "Save"}
              <Check className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function summariseSettings(m: ProviderModelDto): string {
  const parts: string[] = [];
  if (m.temperature !== null) parts.push(`temp ${m.temperature}`);
  if (m.topP !== null) parts.push(`topP ${m.topP}`);
  if (m.maxOutputTokens !== null) parts.push(`max ${m.maxOutputTokens}`);
  if (m.systemPrompt) parts.push("system prompt set");
  return parts.length > 0 ? parts.join(" · ") : "no overrides";
}

function numberInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseNumericOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

// ── Error surfaces ──────────────────────────────────────────────────

function FieldError({
  error,
  field,
}: {
  error: ApiError | null;
  field: string;
}) {
  const msg = fieldError(error, field);
  if (!msg) return null;
  return (
    <p role="alert" className="text-[11px] text-error">
      {msg}
    </p>
  );
}

function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  const details = error.details;
  const hasFormLevel = details && details.formErrors.length > 0;
  const hasField = details && Object.keys(details.fieldErrors).length > 0;
  if (!hasFormLevel && !hasField) {
    return (
      <p
        role="alert"
        className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-[13px] text-error"
      >
        {errorMessage(error)}
      </p>
    );
  }
  if (!hasFormLevel) return null;
  return (
    <ul className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-[13px] text-error">
      {details.formErrors.map((msg, i) => (
        <li key={`${msg}-${i}`}>{msg}</li>
      ))}
    </ul>
  );
}
