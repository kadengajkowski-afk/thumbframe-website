import { create } from "zustand";
import { normalizeHex } from "@/lib/color";
import {
  loadDevTier,
  loadLastExport,
  loadRecentExports,
  MAX_RECENT_EXPORTS,
  persistDevTier,
  persistLastExport,
  persistRecentExports,
  type RecentExport,
} from "./exportPersistence";
import { loadPinnedKit, persistPinnedKit } from "./pinnedKitPersistence";
import {
  loadBool,
  loadLastFillColor,
  loadNumber,
  loadRecentColors,
  loadRecentFonts,
  loadString,
  persistLastFillColor,
  persistRecentColors,
  persistRecentFonts,
  persistString,
} from "./uiStorePersistence";

export type { RecentExport } from "./exportPersistence";

export type Tool = "select" | "hand" | "rect" | "ellipse" | "text";

const LAST_FONT_FAMILY_KEY = "thumbframe:last-font-family";
const LAST_FONT_SIZE_KEY = "thumbframe:last-font-size";
const LAST_FONT_WEIGHT_KEY = "thumbframe:last-font-weight";
const SMART_GUIDES_KEY = "thumbframe:smart-guides-enabled";
const MAX_RECENT = 8, MAX_RECENT_FONTS = 6;
const DEFAULT_FONT_FAMILY = "Inter";
const DEFAULT_FONT_SIZE = 96, DEFAULT_FONT_WEIGHT = 700;

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

  /** Day 14: master toggle for smart-guides-during-drag. Default on;
   * persisted to localStorage. Cmd+\ flips it. */
  smartGuidesEnabled: boolean;
  setSmartGuidesEnabled: (v: boolean) => void;

  /** Day 16: true while a resize-handle drag is in progress. SelectTool
   * sets it on handle pointerdown and clears it on pointerup / abort.
   * Other surfaces read it to hide cosmetic chrome (e.g. handles
   * themselves) during the gesture. */
  isResizing: boolean;
  setIsResizing: (v: boolean) => void;

  /** Day 18: ExportPanel modal visibility. Cmd+E + the TopBar
   * "Ship it" button toggle this. Esc closes from inside the panel. */
  exportPanelOpen: boolean;
  setExportPanelOpen: (v: boolean) => void;

  /** Day 19: tier flag. Real auth ships Cycle 4 (Day 31). Today the
   * value is "free" by default; a dev-only command-palette toggle
   * flips it to "pro" for local Pro-flow testing. The dev override
   * persists in localStorage so refreshes keep the chosen tier. */
  userTier: "free" | "pro";
  setUserTier: (tier: "free" | "pro") => void;

  /** Day 19: most-recent export settings, capped at 10, persisted
   * to localStorage. ExportPanel surfaces these as a "Recent"
   * section — clicking re-applies the same format / quality. */
  recentExports: RecentExport[];
  pushRecentExport: (entry: RecentExport) => void;

  /** Day 19: last-used export settings, persisted. Cmd+Shift+E
   * uses these to ship without opening the panel. Null until the
   * user has shipped at least once. */
  lastExport: RecentExport | null;
  setLastExport: (entry: RecentExport) => void;

  /** Day 20: persistence state — user / currentProjectId / saveStatus. */
  user: { id: string; email: string | null; avatarUrl: string | null } | null;
  setUser: (user: UiState["user"]) => void;
  currentProjectId: string | null; setCurrentProjectId: (id: string | null) => void;
  projectName: string; setProjectName: (name: string) => void;
  saveStatus: SaveStatus; setSaveStatus: (status: SaveStatus) => void;
  authPanelOpen: boolean; setAuthPanelOpen: (v: boolean) => void;
  projectsPanelOpen: boolean; setProjectsPanelOpen: (v: boolean) => void;
  /** Day 21: PreviewRack visibility (Cmd+Shift+P) + light/dark toggle. */
  previewRackOpen: boolean; setPreviewRackOpen: (v: boolean) => void;
  previewMode: "dark" | "light"; setPreviewMode: (mode: "dark" | "light") => void;

  /** Day 31: Brand Kit panel visibility. Cmd+B opens. */
  brandKitPanelOpen: boolean; setBrandKitPanelOpen: (v: boolean) => void;

  /** Day 32: pinned Brand Kit. Persists across reloads via localStorage
   * (signed-out) or the user's most-recent saved row (signed-in, loaded
   * at boot). When pinned, the kit's palette appears as a "Brand"
   * presets section in the ColorPicker, and the kit's avatar + name
   * shows in the TopBar. Apply-on-click on the BrandKitPanel is gated
   * on whether the kit is the panel's current result, not the pinned
   * one — pinning is a separate user choice. */
  pinnedBrandKit: PinnedBrandKit | null;
  setPinnedBrandKit: (kit: PinnedBrandKit | null) => void;

  /** Day 35 — true while a useAiChat stream is open. TopBar shows a
   * subtle "thinking…" indicator while set. Single boolean (not a
   * counter) because the editor only runs one chat at a time today. */
  aiStreaming: boolean;
  setAiStreaming: (v: boolean) => void;
};

export type PinnedBrandKit = {
  channelId: string;
  channelTitle: string;
  customUrl: string | null;
  avatarUrl: string | null;
  primaryAccent: string | null;
  palette: string[];
  /** Day 33 — pinned-kit fonts surface as a "Brand" group at the top
   * of the FontPicker. Empty when font detection failed / the kit
   * predates Day 33. */
  fonts: { name: string; confidence: number }[];
};

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };


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

  recentColors: loadRecentColors(MAX_RECENT),
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

  recentFonts: loadRecentFonts(MAX_RECENT_FONTS),
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

  smartGuidesEnabled: loadBool(SMART_GUIDES_KEY, true),
  setSmartGuidesEnabled: (v) => {
    persistString(SMART_GUIDES_KEY, v ? "1" : "0");
    set({ smartGuidesEnabled: v });
  },

  isResizing: false,
  setIsResizing: (isResizing) => set({ isResizing }),

  exportPanelOpen: false,
  setExportPanelOpen: (exportPanelOpen) => set({ exportPanelOpen }),

  userTier: loadDevTier(),
  setUserTier: (userTier) => {
    persistDevTier(userTier);
    set({ userTier });
  },

  recentExports: loadRecentExports(),
  pushRecentExport: (entry) =>
    set((state) => {
      const dedup = [
        entry,
        ...state.recentExports.filter(
          (e) =>
            !(e.format === entry.format &&
              e.quality === entry.quality &&
              e.width === entry.width &&
              e.height === entry.height),
        ),
      ].slice(0, MAX_RECENT_EXPORTS);
      persistRecentExports(dedup);
      return { recentExports: dedup };
    }),

  lastExport: loadLastExport(),
  setLastExport: (entry) => {
    persistLastExport(entry);
    set({ lastExport: entry });
  },

  user: null,
  setUser: (user) => set({ user }),
  currentProjectId: null,
  setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
  projectName: "Untitled",
  setProjectName: (projectName) => set({ projectName }),
  saveStatus: { kind: "idle" },
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  authPanelOpen: false,
  setAuthPanelOpen: (authPanelOpen) => set({ authPanelOpen }),
  projectsPanelOpen: false,
  setProjectsPanelOpen: (projectsPanelOpen) => set({ projectsPanelOpen }),
  previewRackOpen: false,
  setPreviewRackOpen: (previewRackOpen) => set({ previewRackOpen }),
  previewMode: "dark",
  setPreviewMode: (previewMode) => set({ previewMode }),

  brandKitPanelOpen: false,
  setBrandKitPanelOpen: (brandKitPanelOpen) => set({ brandKitPanelOpen }),

  pinnedBrandKit: loadPinnedKit(),
  setPinnedBrandKit: (pinnedBrandKit) => {
    persistPinnedKit(pinnedBrandKit);
    set({ pinnedBrandKit });
  },

  aiStreaming: false,
  setAiStreaming: (aiStreaming) => set({ aiStreaming }),
}));


