"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Workspace UI state (SPEC §5.3 — split-workspace panel) plus persisted
 * user preferences.
 *
 * Two concerns live here:
 *
 * 1. **Ephemeral workspace state** — which artifact/version is active in
 *    the right panel. Never persisted, resets on refresh.
 * 2. **Persisted view preferences** — the admin table view mode
 *    ("cards" | "table") per surface. Kept between sessions in
 *    `localStorage` so the user doesn't re-pick their layout every load.
 */

export type AdminViewMode = "cards" | "table";

interface UiState {
  activeArtifactId: string | null;
  activeVersionId: string | null;
  panelOpen: boolean;
  setActiveArtifact: (id: string | null) => void;
  setActiveVersion: (id: string | null) => void;
  setPanelOpen: (open: boolean) => void;

  /** Per-surface view mode toggle. */
  adminViewMode: Record<"users" | "audit", AdminViewMode>;
  setAdminViewMode: (
    surface: "users" | "audit",
    mode: AdminViewMode,
  ) => void;
}

/**
 * Only the persisted-preferences slice is written to storage; ephemeral
 * artifact-panel state is intentionally excluded via `partialize`.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeArtifactId: null,
      activeVersionId: null,
      panelOpen: false,
      setActiveArtifact: (id) =>
        set({ activeArtifactId: id, activeVersionId: null }),
      setActiveVersion: (id) => set({ activeVersionId: id }),
      setPanelOpen: (open) => set({ panelOpen: open }),

      adminViewMode: { users: "cards", audit: "table" },
      setAdminViewMode: (surface, mode) =>
        set((state) => ({
          adminViewMode: { ...state.adminViewMode, [surface]: mode },
        })),
    }),
    {
      name: "stanzachat.ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ adminViewMode: state.adminViewMode }),
      version: 1,
    },
  ),
);
