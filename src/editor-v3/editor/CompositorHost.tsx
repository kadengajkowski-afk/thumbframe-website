import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { Compositor } from "./Compositor";
import { setCurrentCompositor } from "./compositorRef";

/**
 * React mount point for PixiJS. Renders ONCE on mount, never again.
 * Verify via React DevTools Profiler — dragging inside the viewport
 * must produce zero re-renders on this component.
 *
 * Construction order is load-bearing: `new Compositor(app)` reads
 * `app.screen` + `app.renderer.events`, which only exist AFTER
 * `await app.init()` resolves. Creating the Compositor earlier
 * throws "Cannot read properties of undefined (reading 'screen')"
 * the first time something triggers a render path (e.g. uploading
 * an image). The async IIFE below enforces the ordering.
 */
export function CompositorHost() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let cancelled = false;
    let compositor: Compositor | null = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      await app.init({
        resizeTo: host,
        background: 0x050510, // --bg-space-0
        preference: "webgl",
        antialias: true,
        // Day 17: backbuffer is required by Pixi v8's advanced
        // blend filter (overlay / soft-light / etc.). Without it
        // the BlendModeFilter logs a warning and falls back to
        // normal — silently breaking 21 of 25 modes.
        useBackBuffer: true,
      });
      if (cancelled) {
        // Unmount fired while init was in flight (StrictMode double-
        // mount lands here in dev). The cleanup below can't destroy
        // what wasn't ready; we finish teardown here.
        app.destroy(true);
        return;
      }

      compositor = new Compositor(app);
      host.appendChild(app.canvas);
      app.canvas.style.display = "block";

      compositor.start();
      setCurrentCompositor(compositor);

      // Size the viewport to the host's current dimensions before the
      // observer fires the first async callback — otherwise the canvas
      // flashes the init default for one frame.
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0) compositor.resize(w, h);

      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !compositor) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) compositor.resize(width, height);
      });
      ro.observe(host);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      setCurrentCompositor(null);
      // Only tear down if init completed. If compositor is still null
      // the async IIFE's cancelled check will destroy the app itself.
      if (compositor) {
        compositor.stop();
        app.destroy(true, { children: true, texture: true });
      }
    };
  }, []);

  return <div ref={hostRef} className="compositor-host" style={hostStyle} />;
}

const hostStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  // Day 57 fix: CanvasAtmosphere is `position: absolute, z-index: 0`
  // and was painting on top of this static block (positioned children
  // with z-index: 0 paint after non-positioned siblings). Make this
  // div a positioned stacking participant so the Pixi canvas sits
  // above the star field.
  position: "relative",
  zIndex: 1,
};
