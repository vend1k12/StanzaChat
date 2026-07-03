"use client";

import { create } from "zustand";

/**
 * Workspace UI state (SPEC §5.3 — split-workspace panel).
 *
 * The artifact panel is opened by clicking an artifact chip in the
 * message list. `activeArtifactId` selects which artifact's
 * Preview/Code/Versions tabs to render; `activeVersionId` selects the
 * version within it (defaults to the latest version inside the panel).
 *
 * Kept in a small Zustand store rather than React state so the
 * message-list (center column) and artifact-panel (right column) can
 * read/write it without prop-drilling through the workspace shell.
 */
interface UiState {
  activeArtifactId: string | null;
  activeVersionId: string | null;
  panelOpen: boolean;
  setActiveArtifact: (id: string | null) => void;
  setActiveVersion: (id: string | null) => void;
  setPanelOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeArtifactId: null,
  activeVersionId: null,
  panelOpen: false,
  setActiveArtifact: (id) =>
    set({ activeArtifactId: id, activeVersionId: null }),
  setActiveVersion: (id) => set({ activeVersionId: id }),
  setPanelOpen: (open) => set({ panelOpen: open }),
}));
