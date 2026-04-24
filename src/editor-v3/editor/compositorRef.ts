import type { Compositor } from "./Compositor";

/**
 * Module-level pointer to the currently-mounted Compositor. Set by
 * CompositorHost on mount, cleared on unmount. hotkeys.ts and the
 * ZoomIndicator read it to dispatch imperative viewport actions
 * (fit, zoomBy, setZoomPercent) without needing a React context
 * threaded through the tree.
 *
 * This is NOT a window global and NOT parallel state — there's at
 * most one Compositor instance in the app; the ref just avoids
 * passing it around. If we ever support multiple editors (split view,
 * multi-project), swap this for a Map<id, Compositor>.
 */
let current: Compositor | null = null;

export function setCurrentCompositor(c: Compositor | null): void {
  current = c;
}

export function getCurrentCompositor(): Compositor | null {
  return current;
}
