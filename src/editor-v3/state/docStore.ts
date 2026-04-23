import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Layer } from "./types";

type DocState = {
  layers: Layer[];
  addLayer: (layer: Layer) => void;
  moveLayer: (id: string, x: number, y: number) => void;
};

// subscribeWithSelector middleware lets the Compositor subscribe OUTSIDE React
// with a selector fn + change callback. React renders NEVER drive Pixi.
export const useDocStore = create<DocState>()(
  subscribeWithSelector((set) => ({
    layers: [],
    addLayer: (layer) =>
      set((state) => ({ layers: [...state.layers, layer] })),
    moveLayer: (id, x, y) =>
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === id ? { ...l, x, y } : l,
        ),
      })),
  })),
);
