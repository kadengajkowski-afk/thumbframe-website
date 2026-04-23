import { create } from "zustand";

export type Tool = "select" | "rect";

type UiState = {
  activeTool: Tool;
  setTool: (tool: Tool) => void;
};

/** UI-only flags. Document state lives in docStore. Do not cross streams. */
export const useUiStore = create<UiState>()((set) => ({
  activeTool: "select",
  setTool: (activeTool) => set({ activeTool }),
}));
