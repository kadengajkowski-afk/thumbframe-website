# React-to-PixiJS wiring pattern for ThumbFrame v3

This is the foundational architecture pattern for how React, Zustand, and PixiJS communicate in v3. Read this before writing any Pixi code.

## The architecture in one sentence

**React owns the UI shell (panels, toolbars, chrome). Zustand owns the document state (the list of layers and their properties). A Compositor class owns the PixiJS scene graph and subscribes directly to Zustand — so React never re-renders when a layer moves.**

## The diagram

```
┌─────────────────────────────────────────────────────────┐
│                         REACT                           │
│  (toolbar, layer panel, contextual panel, modals)       │
│                                                         │
│  Reads Zustand via useStore() — re-renders on change    │
└────────────────────────────┬────────────────────────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
        ┌────────────────┐      ┌────────────────┐
        │    ZUSTAND     │      │   CompositorHost│ ◄── React component
        │   docStore     │      │   (mounts Pixi, │     that renders ONCE
        │                │      │   holds div ref)│     and never updates
        │  { layers:     │      └────────┬────────┘
        │      [...]     │               │
        │  }             │               │ on mount
        └────────┬───────┘               ▼
                 │            ┌─────────────────────┐
                 │            │    Compositor       │
                 │            │    (plain class)    │
                 │ subscribe  │                     │
                 └───────────►│  - holds Pixi App   │
                              │  - maps layerId →   │
                              │    PIXI.Sprite      │
                              │  - reconciles on    │
                              │    every change     │
                              └──────────┬──────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   PIXI.Application  │
                              │   app.stage.children│
                              └─────────────────────┘
```

React and PixiJS are completely decoupled. Zustand is the message bus.

## File 1: `src/state/docStore.ts`

```typescript
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type Layer = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: number; // 0xRRGGBB
};

type DocState = {
  layers: Layer[];
  addLayer: (layer: Layer) => void;
  moveLayer: (id: string, x: number, y: number) => void;
};

// subscribeWithSelector middleware lets us subscribe OUTSIDE React
// with a selector function + change callback. This is how Compositor
// gets change notifications without React being involved.
export const useDocStore = create<DocState>()(
  subscribeWithSelector((set) => ({
    layers: [],
    addLayer: (layer) =>
      set((state) => ({ layers: [...state.layers, layer] })),
    moveLayer: (id, x, y) =>
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === id ? { ...l, x, y } : l
        ),
      })),
  }))
);
```

## File 2: `src/editor/Compositor.ts`

```typescript
import { Application, Graphics } from "pixi.js";
import type { Layer } from "../state/docStore";
import { useDocStore } from "../state/docStore";

export class Compositor {
  app: Application;
  private layerNodes = new Map<string, Graphics>();
  private unsubscribe?: () => void;

  constructor(app: Application) {
    this.app = app;
  }

  start() {
    this.unsubscribe = useDocStore.subscribe(
      (state) => state.layers,
      (layers) => this.reconcile(layers)
    );
    this.reconcile(useDocStore.getState().layers);
  }

  stop() {
    this.unsubscribe?.();
    this.layerNodes.forEach((node) => node.destroy());
    this.layerNodes.clear();
  }

  private reconcile(layers: Layer[]) {
    const seenIds = new Set<string>();

    for (const layer of layers) {
      seenIds.add(layer.id);
      let node = this.layerNodes.get(layer.id);

      if (!node) {
        node = new Graphics();
        this.layerNodes.set(layer.id, node);
        this.app.stage.addChild(node);
      }

      node.clear();
      node.rect(0, 0, layer.width, layer.height);
      node.fill(layer.color);
      node.x = layer.x;
      node.y = layer.y;
    }

    for (const [id, node] of this.layerNodes) {
      if (!seenIds.has(id)) {
        node.destroy();
        this.layerNodes.delete(id);
      }
    }
  }
}
```

## File 3: `src/editor/CompositorHost.tsx`

```typescript
import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { Compositor } from "./Compositor";

export function CompositorHost() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const app = new Application();
    const compositor = new Compositor(app);
    let cancelled = false;

    (async () => {
      await app.init({
        width: 1280,
        height: 720,
        background: 0x0a0a0f,
        preference: "webgl",
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      host.appendChild(app.canvas);
      compositor.start();
    })();

    return () => {
      cancelled = true;
      compositor.stop();
      app.destroy(true, { children: true, texture: true });
    };
  }, []);

  return <div ref={hostRef} className="compositor-host" />;
}
```

## File 4: `src/App.tsx`

```typescript
import { CompositorHost } from "./editor/CompositorHost";
import { useDocStore } from "./state/docStore";
import { nanoid } from "nanoid";

export function App() {
  const layerCount = useDocStore((s) => s.layers.length);
  const addLayer = useDocStore((s) => s.addLayer);

  return (
    <div className="app">
      <div className="toolbar">
        <span>Layers: {layerCount}</span>
        <button
          onClick={() =>
            addLayer({
              id: nanoid(),
              type: "rect",
              x: Math.random() * 800,
              y: Math.random() * 400,
              width: 100,
              height: 80,
              color: 0xf97316,
            })
          }
        >
          Add rectangle
        </button>
      </div>
      <CompositorHost />
    </div>
  );
}
```

## How to verify it works

**Option A — React DevTools Profiler:**
1. Open Chrome DevTools → React DevTools → Profiler tab
2. Click "Record"
3. Drag a rectangle around the canvas for 2 seconds
4. Stop recording
5. Expected result: **zero renders on `CompositorHost`**

**Option B — console.log in render:**

Add `console.log("CompositorHost rendered")` inside the component. Drag. Should print exactly **once**.

## The four rules this pattern enforces

1. **Never render Pixi inside a React component tree.** Pixi is a side-effect held in a ref, not a JSX tree.
2. **Never put Pixi objects in Zustand.** Only plain data. The Compositor maps Zustand data → Pixi objects.
3. **Compositor is the only code that touches `app.stage.children`.** React and Zustand actions never reach into the scene graph directly.
4. **Drag operations update Zustand on `pointerup`, not on every `pointermove`.** During drag, update Pixi Graphics position directly for visual feedback, commit to Zustand once on release.

## Gotchas

- `await app.init({})` can stall indefinitely if called at a module's top level in Vite bundled builds. Always wrap in function/`useEffect` (issue pixijs/pixijs#10456).
- React 19 StrictMode double-mounts components in dev. The `cancelled` flag in `CompositorHost` handles this — if unmounted before init finishes, cleanup runs properly.
- PixiJS v8 init is **async**. v7 was sync. Don't copy v7 tutorials.

## Reference implementations

- **tldraw** — `packages/editor/src/lib/editor/Editor.ts` (their Compositor equivalent)
- **Excalidraw** — `Scene` class (Canvas 2D, same decoupling pattern)
- **Figma** — C++/WASM core with React UI reading state via message bridge

## Verified April 2026
- PixiJS v8.x async `app.init()` confirmed
- Zustand v5 `subscribeWithSelector` middleware confirmed
