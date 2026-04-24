import { create } from "zustand";

export type Tool = "select" | "hand" | "rect";

type UiState = {
  /** Gates the empty state → editor shell transition. */
  hasEntered: boolean;
  setHasEntered: (v: boolean) => void;

  /** Currently-selected layer ids. Always an array — single-select is
   * just [id] — so multi-select UI can land Cycle 2 without reshaping
   * consumers. Order is insertion order; the first entry is the
   * "primary" selection (what ContextPanel shows). */
  selectedLayerIds: string[];
  setSelectedLayerIds: (ids: string[]) => void;

  /** Active tool. 'hand' joins Day 6 alongside the rect tool. */
  activeTool: Tool;
  setTool: (tool: Tool) => void;

  /** Viewport zoom — mirrored from pixi-viewport on every zoom event.
   * Read by ZoomIndicator; not written to by anything except Compositor. */
  zoomScale: number;
  setZoomScale: (v: number) => void;

  /** Temporary hand-drag mode (Space held). Day 6 ships a full
   * 'hand' tool too; either turns left-click drag into pan. */
  isHandMode: boolean;
  setHandMode: (v: boolean) => void;

  /** Fit-to-screen sticky flag. Set by Compositor.fit() and the
   * initial mount; cleared the moment the user pans/zooms/pinches. */
  isFitMode: boolean;
  setFitMode: (v: boolean) => void;

  /** True while the user is actively dragging the viewport (for
   * cursor feedback — 'grabbing' vs 'grab'). */
  isPanActive: boolean;
  setPanActive: (v: boolean) => void;

  /** Layer currently under the pointer in canvas space. Powers the
   * 'move' cursor on select-tool hover. */
  hoveredLayerId: string | null;
  setHoveredLayerId: (id: string | null) => void;

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

  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}));
