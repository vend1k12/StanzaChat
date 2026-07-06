"use client";

import type { ProviderRecord } from "@repo/ai";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useModels } from "@/lib/hooks/use-models";

/**
 * Model picker (SPEC §4.2 / §6).
 *
 * Lists every enabled provider's `enabledModels`, grouped by provider.
 * Selecting an option updates `chats.modelConfigId` on the server (via
 * the parent's `onChange` handler) so subsequent reloads remember the
 * choice — and passes `modelId` to `POST /api/chat` for that turn.
 */

export interface ModelSelection {
  providerId: string | null;
  modelId: string | null;
}

export interface ModelPickerProps {
  selection: ModelSelection | null;
  onChange: (next: ModelSelection) => void;
}

/**
 * The `<Select>` uses a `provider-id::model-id` composite value so we
 * can dispatch to `onChange` with both parts. Empty picker (no models
 * configured yet) surfaces a subtle "no models" hint — the chat view's
 * NoProviderBanner covers the real "configure a provider" call to
 * action.
 */
export function ModelPicker({ selection, onChange }: ModelPickerProps) {
  const { data: providers, isLoading } = useModels();

  const enabled = useMemo(
    () => (providers ?? []).filter((p) => p.enabled),
    [providers],
  );

  if (isLoading) {
    return <Skeleton className="h-9 w-52" />;
  }

  if (enabled.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-card px-2.5 py-1.5 text-xs text-muted-ink">
        <ChevronDown className="size-3 opacity-50" />
        No models configured
      </span>
    );
  }

  const composite = compositeValue(selection, enabled);

  return (
    <Select
      value={composite}
      onValueChange={(value) => {
        const parsed = parseComposite(value);
        onChange(parsed);
      }}
    >
      <SelectTrigger size="sm" className="w-56" aria-label="Model">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {enabled.map((provider: ProviderRecord) => (
          <SelectGroup key={provider.id}>
            <SelectLabel className="font-mono text-[10px] tracking-widest text-muted-ink uppercase">
              {provider.label}
            </SelectLabel>
            {provider.enabledModels.length === 0 ? (
              <SelectItem
                value={`${provider.id}::__empty__`}
                disabled
                className="opacity-60"
              >
                no models enabled
              </SelectItem>
            ) : (
              provider.enabledModels.map((model) => (
                <SelectItem
                  key={`${provider.id}::${model}`}
                  value={`${provider.id}::${model}`}
                >
                  {model}
                </SelectItem>
              ))
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Turn the current selection into the `provider-id::model-id` composite
 * the `<Select>` expects. When `modelId` is unknown, pick the provider's
 * first enabled model so the picker always shows a concrete value.
 */
function compositeValue(
  selection: ModelSelection | null,
  enabled: ProviderRecord[],
): string {
  if (!selection?.providerId) {
    const first = enabled[0];
    if (!first) return "";
    const firstModel = first.enabledModels[0];
    return firstModel ? `${first.id}::${firstModel}` : "";
  }
  const provider = enabled.find((p) => p.id === selection.providerId);
  if (!provider) return "";
  const model = selection.modelId ?? provider.enabledModels[0];
  return model ? `${provider.id}::${model}` : "";
}

function parseComposite(value: string): ModelSelection {
  const [providerId, modelId] = value.split("::");
  return {
    providerId: providerId ?? null,
    modelId: modelId && modelId !== "__empty__" ? modelId : null,
  };
}
