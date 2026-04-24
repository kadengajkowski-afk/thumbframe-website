import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Layer } from "./types";

export type DocState = {
  layers: Layer[];
};

/**
 * Document state. Subscribed OUTSIDE React by the Compositor.
 *
 * Mutations do NOT live here. All writes go through lib/history.ts so every
 * change produces immer patches and supports undo/redo. Use
 * useDocStore.setState({ layers }) only inside history.ts.
 */
export const useDocStore = create<DocState>()(
  subscribeWithSelector(
    (): DocState => ({
      layers: [] as Layer[],
    }),
  ),
);
