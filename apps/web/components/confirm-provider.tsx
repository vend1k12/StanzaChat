"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Imperative confirm-dialog surface. One `<ConfirmProvider>` at the
 * root layout wires a single AlertDialog instance; components anywhere
 * in the tree call `useConfirm()` to open it with a message and await
 * a boolean result.
 *
 * Replaces browser `confirm()` calls (SPEC UX: modal, keyboard-friendly,
 * focus-trapped, style-consistent with the rest of the surface).
 */

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style hint for the confirm button: destructive is default. */
  tone?: "destructive" | "default";
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

interface PendingState {
  options: ConfirmOptions;
  resolve: (result: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  // Ref so `confirm(...)` doesn't invalidate its identity between renders.
  const pendingRef = useRef<PendingState | null>(null);
  pendingRef.current = pending;

  const confirm = useCallback<Confirm>((options) => {
    // If a prior confirm is still open, resolve it as `false` so its
    // caller doesn't hang.
    if (pendingRef.current) pendingRef.current.resolve(false);
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const onOpenChange = (open: boolean) => {
    if (!open && pendingRef.current) {
      pendingRef.current.resolve(false);
      setPending(null);
    }
  };

  const answer = (result: boolean) => {
    if (!pendingRef.current) return;
    pendingRef.current.resolve(result);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={pending !== null} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.options.title ?? ""}
            </AlertDialogTitle>
            {pending?.options.description ? (
              <AlertDialogDescription>
                {pending.options.description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => answer(false)}>
              {pending?.options.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => answer(true)}
              // The default `AlertDialogAction` styling is `destructive`;
              // callers can override via `tone: "default"` for benign
              // confirms (e.g. "Save changes?").
              data-tone={pending?.options.tone ?? "destructive"}
            >
              {pending?.options.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      "useConfirm() must be used inside a <ConfirmProvider>. Mount it at the root layout.",
    );
  }
  return ctx;
}
