import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { Compositor } from "./Compositor";

/**
 * React mount point for PixiJS. Renders ONCE on mount, never again.
 * Verify via React DevTools Profiler — dragging a shape must produce
 * zero re-renders on this component.
 */
export function CompositorHost() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

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
