import { create } from "zustand";

export type Tool = "select" | "rect";

type UiState = {
  /** Gates the empty state → editor shell transition. */
  hasEntered: boolean;
  setHasEntered: (v: boolean) => void;

  /** Currently selected layer id, or null. */
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;

  /** Active tool. Toolbar + tool wiring lands Days 5–7. */
  activeTool: Tool;
  setTool: (tool: Tool) => void;

  /** Viewport zoom — mirrored from pixi-viewport on every zoom event.
   * Read by ZoomIndicator; not written to by anything except Compositor. */
  zoomScale: number;
  setZoomScale: (v: number) => void;

  /** Temporary hand-drag mode (Space held). Cycle 1 Day 5.
   * Day 6 promotes this into a full `activeTool === 'hand'` variant. */
  isHandMode: boolean;
  setHandMode: (v: boolean) => void;

  /** Fit-to-screen sticky flag. Set by Compositor.fit() and the
   * initial mount; cleared the moment the user pans/zooms/pinches. */
  isFitMode: boolean;
  setFitMode: (v: boolean) => void;
};

/** UI-only flags. Document state lives in docStore. Do not cross streams. */
export const useUiStore = create<UiState>()((set) => ({
  hasEntered: false,
  setHasEntered: (hasEntered) => set({ hasEntered }),

  selectedLayerId: null,
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId }),

  activeTool: "select",
  setTool: (activeTool) => set({ activeTool }),

  zoomScale: 1,
  setZoomScale: (zoomScale) => set({ zoomScale }),

  isHandMode: false,
  setHandMode: (isHandMode) => set({ isHandMode }),

  isFitMode: true,
  setFitMode: (isFitMode) => set({ isFitMode }),
}));
