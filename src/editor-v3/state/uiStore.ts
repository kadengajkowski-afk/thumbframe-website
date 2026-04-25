import { create } from "zustand";
import { normalizeHex } from "@/lib/color";

export type Tool = "select" | "hand" | "rect" | "ellipse";

const RECENT_COLORS_KEY = "thumbframe:recent-colors";
const LAST_FILL_KEY = "thumbframe:last-fill";
const MAX_RECENT = 8;
const DEFAULT_FILL = "#F97316";

type UiState = {
  hasEntered: boolean;
  setHasEntered: (v: boolean) => void;

  selectedLayerIds: string[];
  setSelectedLayerIds: (ids: string[]) => void;

  activeTool: Tool;
  setTool: (tool: Tool) => void;

  zoomScale: number;
  setZoomScale: (v: number) => void;

  isHandMode: boolean;
  setHandMode: (v: boolean) => void;

  isFitMode: boolean;
  setFitMode: (v: boolean) => void;

  isPanActive: boolean;
  setPanActive: (v: boolean) => void;

  hoveredLayerId: string | null;
  setHoveredLayerId: (id: string | null) => void;

  /** Day 9: max-8 stack of canonical "#RRGGBB" strings, most-recent
   * first. Mirrored to localStorage. Dedupes by bubbling matches. */
  recentColors: string[];
  addRecentColor: (hex: string) => void;

  /** Last fill color used by the Rectangle tool. Persists across
   * refresh so the next rect picks up where the user left off. */
  lastFillColor: string;
  setLastFillColor: (hex: string) => void;

  /** Day 10: command-palette open state. Cmd+K toggles. */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
};

/** UI-only flags. Document state lives in docStore. Do not cross streams. */
export const useUiStore = create<UiState>()((set) => ({
  hasEntered: false,
  setHasEntered: (hasEntered) => set({ hasEntered }),

  selectedLayerIds: [],
  setSelectedLayerIds: (selectedLayerIds) => set({ selectedLayerIds }),

  activeTool: "select",
  setTool: (activeTool) => set({ activeTool }),

  zoomScale: 1,
  setZoomScale: (zoomScale) => set({ zoomScale }),

  isHandMode: false,
  setHandMode: (isHandMode) => set({ isHandMode }),

  isFitMode: true,
  setFitMode: (isFitMode) => set({ isFitMode }),

  isPanActive: false,
  setPanActive: (isPanActive) => set({ isPanActive }),

  hoveredLayerId: null,
  setHoveredLayerId: (hoveredLayerId) => set({ hoveredLayerId }),

  recentColors: loadRecentColors(),
  addRecentColor: (hex) =>
    set((s) => {
      const normalized = normalizeHex(hex);
      if (!normalized) return {};
      const dedup = [
        normalized,
        ...s.recentColors.filter((c) => c !== normalized),
      ].slice(0, MAX_RECENT);
      persistRecentColors(dedup);
      return { recentColors: dedup };
    }),

  lastFillColor: loadLastFillColor(),
  setLastFillColor: (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return;
    persistLastFillColor(normalized);
    set({ lastFillColor: normalized });
  },

  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}));

// ── localStorage helpers ─────────────────────────────────────────────

function loadRecentColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_COLORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => (typeof c === "string" ? normalizeHex(c) : null))
      .filter((c): c is string => c !== null)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function persistRecentColors(colors: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors));
  } catch {
    // private mode / quota / disabled — swallow.
  }
}

function loadLastFillColor(): string {
  if (typeof window === "undefined") return DEFAULT_FILL;
  try {
    const raw = window.localStorage.getItem(LAST_FILL_KEY);
    const normalized = raw ? normalizeHex(raw) : null;
    return normalized ?? DEFAULT_FILL;
  } catch {
    return DEFAULT_FILL;
  }
}

function persistLastFillColor(hex: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_FILL_KEY, hex);
  } catch {
    // swallow
  }
}
