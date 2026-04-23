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
    let initDone = false;

    (async () => {
      await app.init({
        width: 1280,
        height: 720,
        background: 0x0a0a0f,
        preference: "webgl",
      });
      if (cancelled) {
        // Cleanup already fired but skipped destroy because init hadn't
        // resolved. Now that app is fully constructed, tear it down here.
        app.destroy(true);
        return;
      }
      initDone = true;
      host.appendChild(app.canvas);
      compositor.start();
    })();

    return () => {
      cancelled = true;
      compositor.stop();
      // Only destroy if init finished. Calling destroy() mid-init throws
      // "this._cancelResize is not a function" from ResizePlugin because
      // the plugin hasn't bound its handlers yet. The cancelled flag
      // hands teardown off to the in-flight init.
      if (initDone) {
        app.destroy(true, { children: true, texture: true });
      }
    };
  }, []);

  return <div ref={hostRef} className="compositor-host" />;
}
