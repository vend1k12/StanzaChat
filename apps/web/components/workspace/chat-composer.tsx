"use client";

import { Send } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Chat input composer (SPEC §5.1).
 *
 * Enter sends (Shift+Enter for a newline). Submitting calls the AI SDK
 * v2 `sendMessage({ text })` from the parent `useChat` hook. Disabled
 * while the assistant is streaming (`status !== "ready"`).
 */
export interface ChatComposerProps {
  status: "submitted" | "streaming" | "ready" | "error";
  onSend: (text: string) => void;
}

export function ChatComposer({ status, onSend }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const disabled = status === "submitted" || status === "streaming";

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
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Assistant is responding…"
              : "Message…  (Enter to send, Shift+Enter for newline)"
          }
          disabled={disabled}
          className="max-h-48 min-h-12 flex-1 resize-none"
          aria-label="Message input"
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
