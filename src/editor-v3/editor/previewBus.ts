import { useDocStore } from "@/state/docStore";
import { getCurrentCompositor } from "./compositorRef";

/** Day 29 — single shared subscriber + single GPU readback per
 * layer change. Replaces the per-surface duplication that turned
 * "1 layer mutation → 7 master refreshes + 7 extract.canvas
 * readbacks" into a single readback that all surfaces consume.
 *
 * Lifecycle:
 *   - First subscribe → docStore.layers subscription starts.
 *   - Each layer change → debounce 32ms → refresh master once →
 *     extract.canvas once → broadcast the source to subscribers.
 *   - Each subscriber drawImage's its slice. No GPU readback.
 *   - Last unsubscribe → docStore subscription releases. */

const DEBOUNCE_MS = 32;

type Subscriber = (sourceCanvas: HTMLCanvasElement) => void;

const subscribers = new Set<Subscriber>();
let docUnsub: (() => void) | null = null;
let refreshTimer: number | null = null;
let latestSource: HTMLCanvasElement | null = null;

function ensureDocSubscribed() {
  if (docUnsub) return;
  docUnsub = useDocStore.subscribe((state) => state.layers, scheduleBroadcast);
}

function teardownIfIdle() {
  if (subscribers.size > 0) return;
  docUnsub?.();
  docUnsub = null;
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  latestSource = null;
}

function scheduleBroadcast() {
  if (refreshTimer !== null) return;
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    broadcast();
  }, DEBOUNCE_MS);
}

function broadcast() {
  const compositor = getCurrentCompositor();
  if (!compositor) return;
  const masterTex = compositor.masterTexture;
  if (!masterTex) return;
  if (typeof console !== "undefined") console.time?.("[v3] preview-bus.broadcast");
  compositor.refreshMasterTexture();
  try {
    latestSource = compositor.app.renderer.extract.canvas({
      target: masterTex,
    }) as HTMLCanvasElement;
  } catch {
    if (typeof console !== "undefined") console.timeEnd?.("[v3] preview-bus.broadcast");
    return;
  }
  for (const cb of subscribers) {
    try { cb(latestSource); } catch { /* surface bug — keep going */ }
  }
  if (typeof console !== "undefined") console.timeEnd?.("[v3] preview-bus.broadcast");
}

export const previewBus = {
  /** Subscribe to master-texture broadcasts. The callback fires
   * with the extracted source HTMLCanvasElement of the current
   * canvas state on every layer-change tick (debounced 32ms).
   * Returns an unsubscribe fn. New subscribers receive the latest
   * cached source immediately if one exists; otherwise they wait
   * for the next broadcast (no extra readback per subscriber). */
  subscribe(cb: Subscriber): () => void {
    subscribers.add(cb);
    ensureDocSubscribed();
    if (latestSource) {
      // Use queueMicrotask so the caller's useEffect cleanup setup
      // completes before the first paint fires.
      queueMicrotask(() => {
        if (subscribers.has(cb) && latestSource) cb(latestSource);
      });
    } else {
      // Kick a broadcast so the new subscriber paints something
      // instead of blank-flashing on mount.
      scheduleBroadcast();
    }
    return () => {
      subscribers.delete(cb);
      teardownIfIdle();
    };
  },
};

/** Test hook — wipe the cached source + tear down subscriptions. */
export function _resetPreviewBus(): void {
  subscribers.clear();
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  docUnsub?.();
  docUnsub = null;
  latestSource = null;
}
