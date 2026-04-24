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
};

/** UI-only flags. Document state lives in docStore. Do not cross streams. */
export const useUiStore = create<UiState>()((set) => ({
  hasEntered: false,
  setHasEntered: (hasEntered) => set({ hasEntered }),

  selectedLayerId: null,
  setSelectedLayerId: (selectedLayerId) => set({ selectedLayerId }),

  activeTool: "select",
  setTool: (activeTool) => set({ activeTool }),
}));
