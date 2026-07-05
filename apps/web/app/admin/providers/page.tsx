"use client";

import { LLM_PROVIDERS, type LlmProvider } from "@repo/shared";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

/**
 * `/admin/providers` — SPEC §5.5.
 *
 * List providers, add a new one, edit, and delete. The API key column is
 * a UI-only masked fingerprint — SPEC guardrail #3: keys never come back
 * from the server, so we only know whether a key is set (`hasApiKey`).
 */
export default function AdminProvidersPage() {
  const { data: providers, isLoading, error } = useProviders();
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();

  const [form, setForm] = useState({
    provider: "openai" as LlmProvider,
    label: "",
    baseUrl: "",
    apiKey: "",
    enabledModels: "",
    isDefault: false,
  });

  const [rotate, setRotate] = useState<Record<string, string>>({});

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-1 text-base font-semibold">Add provider</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          The API key is encrypted with AES-256-GCM before storage and never
          returned to the browser again.
        </p>
        <form
          className="grid gap-4"
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
            } catch (err) {
              toast.error(
                err instanceof ApiError
                  ? err.message
                  : "Failed to add provider",
              );
            }
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
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
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                required
                value={form.label}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, label: event.target.value }))
                }
              />
            </div>
          </div>
          <div>
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
          <div>
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              value={form.apiKey}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, apiKey: event.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="enabledModels">Enabled models (comma-sep)</Label>
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  isDefault: event.target.checked,
                }))
              }
            />
            Make default provider
          </label>
          <Button
            type="submit"
            disabled={createProvider.isPending}
            data-testid="provider-submit"
          >
            {createProvider.isPending ? "Adding…" : "Add provider"}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold">Configured providers</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        ) : providers && providers.length > 0 ? (
          <table className="w-full text-sm" data-testid="providers-table">
            <thead className="text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="pb-2">Label</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2">API key</th>
                <th className="pb-2">Default</th>
                <th className="pb-2">Enabled</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr
                  key={p.id}
                  className="border-t align-middle"
                  data-testid={`provider-row-${p.id}`}
                >
                  <td className="py-2 font-medium">{p.label}</td>
                  <td className="py-2">{p.provider}</td>
                  <td
                    className="py-2 font-mono text-xs"
                    data-testid={`provider-key-${p.id}`}
                  >
                    {p.hasApiKey ? "••••••••" : "—"}
                  </td>
                  <td className="py-2">{p.isDefault ? "★" : ""}</td>
                  <td className="py-2">{p.enabled ? "yes" : "no"}</td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        placeholder="Rotate key"
                        type="password"
                        autoComplete="off"
                        className="h-8 w-40"
                        value={rotate[p.id] ?? ""}
                        onChange={(event) =>
                          setRotate((prev) => ({
                            ...prev,
                            [p.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const key = rotate[p.id];
                          if (!key) return;
                          try {
                            await updateProvider.mutateAsync({
                              id: p.id,
                              updates: { apiKey: key },
                            });
                            setRotate((prev) => ({ ...prev, [p.id]: "" }));
                            toast.success("Key rotated");
                          } catch (err) {
                            toast.error(
                              err instanceof ApiError
                                ? err.message
                                : "Rotate failed",
                            );
                          }
                        }}
                      >
                        Rotate
                      </Button>
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
                              `Delete provider "${p.label}"? This cannot be undone.`,
                            )
                          ) {
                            deleteProvider.mutate(p.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No providers yet.</p>
        )}
      </section>
    </div>
  );
}
