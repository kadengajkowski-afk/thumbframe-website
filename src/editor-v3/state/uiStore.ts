import { create } from "zustand";
import { normalizeHex } from "@/lib/color";

export type Tool = "select" | "hand" | "rect" | "ellipse" | "text";

const RECENT_COLORS_KEY = "thumbframe:recent-colors";
const LAST_FILL_KEY = "thumbframe:last-fill";
const LAST_FONT_FAMILY_KEY = "thumbframe:last-font-family";
const LAST_FONT_SIZE_KEY = "thumbframe:last-font-size";
const LAST_FONT_WEIGHT_KEY = "thumbframe:last-font-weight";
const RECENT_FONTS_KEY = "thumbframe:recent-fonts";
const MAX_RECENT = 8;
const MAX_RECENT_FONTS = 6;
const DEFAULT_FILL = "#F97316";
const DEFAULT_FONT_FAMILY = "Inter";
const DEFAULT_FONT_SIZE = 96;
const DEFAULT_FONT_WEIGHT = 700;

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

  /** Day 12: id of the text layer currently in inline-edit mode.
   * Compositor reads this to alpha-out the Pixi node while the
   * positioned <textarea> overlay covers it. Null = no edit. */
  editingTextLayerId: string | null;
  setEditingTextLayerId: (id: string | null) => void;

  /** Day 12: most-recent font + weight + size, persisted to local-
   * storage so newly placed text layers pick up where the user left
   * off (parallels lastFillColor). */
  lastFontFamily: string;
  setLastFontFamily: (family: string) => void;
  lastFontSize: number;
  setLastFontSize: (size: number) => void;
  lastFontWeight: number;
  setLastFontWeight: (weight: number) => void;

  /** Day 13: most-recent font families (most recent first), capped at
   * MAX_RECENT_FONTS, mirrored to localStorage. Drives the "Recent"
   * group at the top of the font picker. */
  recentFonts: string[];
  addRecentFont: (family: string) => void;
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

  editingTextLayerId: null,
  setEditingTextLayerId: (editingTextLayerId) => set({ editingTextLayerId }),

  lastFontFamily: loadString(LAST_FONT_FAMILY_KEY, DEFAULT_FONT_FAMILY),
  setLastFontFamily: (family) => {
    persistString(LAST_FONT_FAMILY_KEY, family);
    set({ lastFontFamily: family });
  },
  lastFontSize: loadNumber(LAST_FONT_SIZE_KEY, DEFAULT_FONT_SIZE),
  setLastFontSize: (size) => {
    persistString(LAST_FONT_SIZE_KEY, String(size));
    set({ lastFontSize: size });
  },
  lastFontWeight: loadNumber(LAST_FONT_WEIGHT_KEY, DEFAULT_FONT_WEIGHT),
  setLastFontWeight: (weight) => {
    persistString(LAST_FONT_WEIGHT_KEY, String(weight));
    set({ lastFontWeight: weight });
  },

  recentFonts: loadRecentFonts(),
  addRecentFont: (family) =>
    set((state) => {
      const trimmed = family.trim();
      if (!trimmed) return {};
      const dedup = [
        trimmed,
        ...state.recentFonts.filter((f) => f !== trimmed),
      ].slice(0, MAX_RECENT_FONTS);
      persistRecentFonts(dedup);
      return { recentFonts: dedup };
    }),
}));

function loadString(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function loadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function persistString(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode / quota
  }
}

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

function loadRecentFonts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FONTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is string => typeof f === "string")
      .slice(0, MAX_RECENT_FONTS);
  } catch {
    return [];
  }
}

function persistRecentFonts(fonts: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(fonts));
  } catch {
    // swallow
  }
}
