"use client";

import { Send, Square } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Chat input composer (SPEC §5.1).
 *
 * Enter sends (Shift+Enter for newline). While the assistant streams,
 * the send button flips to a Stop control that calls `onStop`.
 */
export interface ChatComposerProps {
  status: "submitted" | "streaming" | "ready" | "error";
  canSend: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
}

export function ChatComposer({
  status,
  canSend,
  onSend,
  onStop,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const disabled = busy || !canSend;

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-hairline bg-canvas px-5 py-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-hairline bg-surface-soft p-2 transition focus-within:border-coral/50 focus-within:shadow-[0_0_0_3px_rgba(204,120,92,0.12)]">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            busy
              ? "Assistant is responding…"
              : "Message the assistant…  (Enter to send · Shift+Enter for newline)"
          }
          disabled={disabled}
          className="max-h-48 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          aria-label="Message input"
        />
        {busy && onStop ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onStop}
            aria-label="Stop generating"
            className="size-10 rounded-xl border-coral/50 text-coral hover:bg-coral/10"
          >
            <Square className="size-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={submit}
            disabled={disabled || value.trim().length === 0}
            aria-label="Send message"
            className="size-10 rounded-xl"
          >
            <Send className="size-4" />
          </Button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl px-1 text-[11px] text-muted-soft">
        Artifacts open in the right panel. Model output runs in an
        origin-isolated sandbox.
      </p>
    </div>
  );
}
