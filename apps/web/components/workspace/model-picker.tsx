"use client";

import type { ProviderRecord } from "@repo/ai";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useModels } from "@/lib/hooks/use-models";

/**
 * Model picker (SPEC §4.2 / §6).
 *
 * Lists the enabled providers' models from `GET /api/models`. For MVP we
 * pick from the first enabled provider's `enabledModels` and surface the
 * selection locally; the actual model used for a chat is the chat's
 * `modelConfigId` resolved server-side, so this control is display-only
 * in v0.1 (kept simple per the task brief — don't overengineer wiring it
 * into the `useChat` body).
 */
export interface ModelPickerProps {
  /** Current chat's configured model (display only). */
  modelConfigId?: string | null;
}

export function ModelPicker({ modelConfigId }: ModelPickerProps) {
  const { data: providers, isLoading } = useModels();
  const [selected, setSelected] = useState<string>(
    modelConfigId ?? providers?.[0]?.id ?? "",
  );

  if (isLoading) {
    return <Skeleton className="h-9 w-44" />;
  }

  const enabled = (providers ?? []).filter((p) => p.enabled);
  if (enabled.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No model configured</span>
    );
  }

  // Flatten to { provider, model } options for the select.
  const options = enabled.flatMap((provider: ProviderRecord) =>
    provider.enabledModels.map((model: string) => ({
      value: `${provider.id}:${model}`,
      label: `${provider.label} · ${model}`,
    })),
  );

  const value = selected || options[0]?.value || "";

  return (
    <Select value={value} onValueChange={setSelected}>
      <SelectTrigger size="sm" className="w-56" aria-label="Model">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
