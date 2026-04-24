import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { Compositor } from "./Compositor";
import { setCurrentCompositor } from "./compositorRef";

/**
 * React mount point for PixiJS. Renders ONCE on mount, never again.
 * Verify via React DevTools Profiler — dragging inside the viewport
 * must produce zero re-renders on this component.
 *
 * Owns: Pixi Application + Compositor lifecycle, the ResizeObserver
 * that feeds viewport sizing, and the compositorRef that exposes the
 * viewport to hotkeys + ZoomIndicator.
 */
export function CompositorHost() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    const compositor = new Compositor(app);
    let cancelled = false;
    let initDone = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      await app.init({
        resizeTo: host,
        background: 0x050510, // --bg-space-0
        preference: "webgl",
        antialias: true,
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      initDone = true;
      host.appendChild(app.canvas);
      app.canvas.style.display = "block";

      compositor.start();
      setCurrentCompositor(compositor);

      // Size the viewport to the host's current dimensions before the
      // observer fires the first async callback — otherwise the canvas
      // flashes the 1280×720 default from app.init for one frame.
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w > 0 && h > 0) compositor.resize(w, h);

      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) compositor.resize(width, height);
      });
      ro.observe(host);
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      setCurrentCompositor(null);
      compositor.stop();
      if (initDone) {
        app.destroy(true, { children: true, texture: true });
      }
    };
  }, []);

  return <div ref={hostRef} className="compositor-host" style={hostStyle} />;
}

const hostStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
};
