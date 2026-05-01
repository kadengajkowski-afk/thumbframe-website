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
  currentMonth,
  loadBgRemoveCount,
  persistBgRemoveCount,
  FREE_BG_REMOVE_LIMIT,
} from "./bgRemovePersistence";
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

  /** Day 37: Image generation panel visibility. Cmd+G toggles. */
  imageGenPanelOpen: boolean; setImageGenPanelOpen: (v: boolean) => void;

  /** Day 38: Upgrade-to-Pro panel visibility. Cmd+U toggles; all Pro
   * upgrade CTAs (4K export, BG cap, AI-gen cap, TopBar billing menu)
   * route through this panel. */
  upgradePanelOpen: boolean; setUpgradePanelOpen: (v: boolean) => void;

  /** Day 39: ThumbFriend chat panel visibility. Cmd+/ toggles. Lives
   * in the right rail and is mutually exclusive with PreviewRack +
   * ContextPanel — only one right-side panel at a time. */
  thumbfriendPanelOpen: boolean;
  setThumbfriendPanelOpen: (v: boolean) => void;

  /** Day 52: one-shot tab override. When set to a non-null value,
   * ThumbFriendPanel reads it on mount/open, switches to that tab,
   * and the consumer (e.g. onboarding's "Yes let's build" CTA)
   * clears it. Used by Step D to land the user directly on the
   * Partner tab with a pre-filled message. */
  thumbfriendInitialTab: "ask" | "nudge" | "partner" | null;
  setThumbfriendInitialTab: (tab: "ask" | "nudge" | "partner" | null) => void;

  /** Day 40: preview-before-apply mode. When true, AI tool calls
   * queue on the assistant bubble and only run when the user clicks
   * Accept. Off by default — most edits should land instantly. */
  thumbfriendPreviewMode: boolean;
  setThumbfriendPreviewMode: (v: boolean) => void;

  /** Days 41-42: crew member id (one of CREW). Default "captain".
   * Persists to localStorage; on send, useAiChat passes it to the
   * backend so the right personality system prompt is used. */
  activeCrewMember: string;
  setActiveCrewMember: (id: string) => void;

  /** Days 41-42: first-run intro card dismissal flag. Once dismissed
   * the panel skips the intro on every open. Persisted. */
  crewIntroDismissed: boolean;
  setCrewIntroDismissed: (v: boolean) => void;

  /** Days 41-42 polish: crew picker dropdown open state. Lifted to
   * uiStore (rather than panel-local) so the dropdown can render in
   * the panel body — full panel width — while the trigger lives in
   * the header. Not persisted. */
  crewPickerOpen: boolean;
  setCrewPickerOpen: (v: boolean) => void;

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

  /** Cycle 6 — free-tier monthly BG remove counter. Free tier capped
   * at 3 trial HD removes/month (server-enforced via ai_usage_events;
   * this counter mirrors for UI display). Pro tier tracked separately
   * server-side at 100/month. Resets on UTC month rollover. */
  bgRemoveCount: number;
  bgRemoveMonth: string;
  /** Increment used count by 1 + persist. */
  incrementBgRemoveCount: () => void;
  /** Test hook + dev-mode reset. */
  resetBgRemoveCount: () => void;

  /** Cycle 6 — true while a Remove.bg call is in flight. Drives the
   * BgRemoveOverlay scanning animation over the layer being processed,
   * and blocks duplicate clicks on the section button. */
  bgRemoveInProgress: boolean;
  bgRemoveLayerId: string | null;
  setBgRemoveInProgress: (layerId: string | null) => void;
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

  imageGenPanelOpen: false,
  setImageGenPanelOpen: (imageGenPanelOpen) => set({ imageGenPanelOpen }),

  upgradePanelOpen: false,
  setUpgradePanelOpen: (upgradePanelOpen) => set({ upgradePanelOpen }),

  thumbfriendPanelOpen: false,
  setThumbfriendPanelOpen: (thumbfriendPanelOpen) => set({ thumbfriendPanelOpen }),

  thumbfriendInitialTab: null,
  setThumbfriendInitialTab: (thumbfriendInitialTab) => set({ thumbfriendInitialTab }),

  thumbfriendPreviewMode: false,
  setThumbfriendPreviewMode: (thumbfriendPreviewMode) => set({ thumbfriendPreviewMode }),

  activeCrewMember: loadString("thumbframe-crew", "captain"),
  setActiveCrewMember: (activeCrewMember) => {
    persistString("thumbframe-crew", activeCrewMember);
    set({ activeCrewMember });
  },

  crewIntroDismissed: loadBool("thumbframe-crew-intro-dismissed", false),
  setCrewIntroDismissed: (crewIntroDismissed) => {
    persistString("thumbframe-crew-intro-dismissed", crewIntroDismissed ? "1" : "0");
    set({ crewIntroDismissed });
  },

  crewPickerOpen: false,
  setCrewPickerOpen: (crewPickerOpen) => set({ crewPickerOpen }),

  pinnedBrandKit: loadPinnedKit(),
  setPinnedBrandKit: (pinnedBrandKit) => {
    persistPinnedKit(pinnedBrandKit);
    set({ pinnedBrandKit });
  },

  aiStreaming: false,
  setAiStreaming: (aiStreaming) => set({ aiStreaming }),

  ...(() => {
    const initial = loadBgRemoveCount();
    return {
      bgRemoveCount: initial.count,
      bgRemoveMonth: initial.month,
    };
  })(),
  incrementBgRemoveCount: () =>
    set((s) => {
      const month = currentMonth();
      const count = (s.bgRemoveMonth === month ? s.bgRemoveCount : 0) + 1;
      persistBgRemoveCount({ month, count });
      return { bgRemoveCount: count, bgRemoveMonth: month };
    }),
  resetBgRemoveCount: () => {
    const month = currentMonth();
    persistBgRemoveCount({ month, count: 0 });
    set({ bgRemoveCount: 0, bgRemoveMonth: month });
  },

  bgRemoveInProgress: false,
  bgRemoveLayerId: null,
  setBgRemoveInProgress: (layerId) =>
    set({
      bgRemoveInProgress: layerId != null,
      bgRemoveLayerId: layerId,
    }),
}));

export { FREE_BG_REMOVE_LIMIT };


