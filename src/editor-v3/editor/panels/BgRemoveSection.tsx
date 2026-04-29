import { type CSSProperties, useState, useRef } from "react";
import type { ImageLayer } from "@/state/types";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import { removeBg, BgRemoveError } from "@/lib/bgRemove";
import { FREE_BG_REMOVE_LIMIT } from "@/state/bgRemovePersistence";

/** Day 36 — Background remove section in ContextPanel for image layers.
 *
 * Two buttons:
 *   - "Remove BG (free)" — calls browser BiRefNet (gated by 10/mo
 *     monthly cap on the free tier; Pro: unlimited).
 *   - "Remove BG HD" — Pro only, calls Railway proxy → Remove.bg HD.
 *
 * After a successful removal, "Restore original" appears (non-Pro users
 * can recover a botched cutout without re-uploading). */

type BgState =
  | { kind: "idle" }
  | { kind: "running"; provider: "browser" | "removebg-hd"; progress: number }
  | { kind: "error"; message: string };

export function BgRemoveSection({ layer }: { layer: ImageLayer }) {
  const userTier = useUiStore((u) => u.userTier);
  const isPro = userTier === "pro";
  const bgRemoveCount = useUiStore((u) => u.bgRemoveCount);
  const incrementBgRemoveCount = useUiStore((u) => u.incrementBgRemoveCount);
  const [state, setState] = useState<BgState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const remaining = Math.max(0, FREE_BG_REMOVE_LIMIT - bgRemoveCount);
  const freeAtCap = !isPro && remaining <= 0;
  const hasOriginal = !!layer.originalBitmap;
  const running = state.kind === "running";

  async function run(provider: "browser" | "removebg-hd") {
    if (running) return;
    if (provider === "browser" && freeAtCap) return;
    abortRef.current = new AbortController();
    setState({ kind: "running", provider, progress: 0 });
    try {
      const result = await removeBg({
        bitmap: layer.bitmap,
        provider,
        signal: abortRef.current.signal,
        onProgress: (p) =>
          setState((s) => (s.kind === "running" ? { ...s, progress: p } : s)),
      });
      history.replaceLayerBitmap(
        layer.id,
        result.bitmap,
        provider === "browser" ? "Remove BG" : "Remove BG (HD)",
      );
      if (!isPro && provider === "browser") incrementBgRemoveCount();
      setState({ kind: "idle" });
    } catch (err) {
      const message =
        err instanceof BgRemoveError
          ? err.code === "PRO_REQUIRED"
            ? "HD removal is Pro-only — upgrade to use it"
            : err.code === "RATE_LIMITED"
              ? "Monthly HD limit reached"
              : err.message
          : "Couldn't cut out the background";
      setState({ kind: "error", message });
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ kind: "idle" });
  }

  function restore() {
    history.restoreLayerOriginalBitmap(layer.id);
  }

  return (
    <section style={section}>
      <label style={fieldLabel}>Background</label>
      {running ? (
        <div style={runningRow} data-testid="bg-remove-running">
          <span style={runningLabel}>
            Cutting out background…
            {state.progress > 0 ? ` ${Math.round(state.progress * 100)}%` : ""}
          </span>
          <button type="button" style={cancelBtn} onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div style={btnRow}>
            <button
              type="button"
              style={freeAtCap ? primaryBtnDisabled : primaryBtn}
              disabled={freeAtCap}
              onClick={() => run("browser")}
              title={
                freeAtCap
                  ? `${FREE_BG_REMOVE_LIMIT} free removes used this month — upgrade to Pro for unlimited`
                  : "Cut out the background in the browser (free)"
              }
              data-testid="bg-remove-free"
            >
              Remove BG{!isPro && ` (${remaining} left)`}
            </button>
            <button
              type="button"
              style={hdBtn}
              onClick={() => run("removebg-hd")}
              title={
                isPro
                  ? "HD background removal (Remove.bg)"
                  : "HD background removal — Pro tier only"
              }
              data-testid="bg-remove-hd"
            >
              HD
              <span style={proPill}>Pro</span>
            </button>
          </div>
          {hasOriginal && (
            <button
              type="button"
              style={restoreBtn}
              onClick={restore}
              data-testid="bg-remove-restore"
            >
              Restore original
            </button>
          )}
          {state.kind === "error" && (
            <div style={errorRow} data-testid="bg-remove-error">
              {state.message}
            </div>
          )}
          {freeAtCap && (
            <div style={hintRow} data-testid="bg-remove-cap">
              {FREE_BG_REMOVE_LIMIT} free removes used this month — upgrade to Pro for unlimited.
            </div>
          )}
        </>
      )}
    </section>
  );
}

const section: CSSProperties = {
  padding: "12px 14px", borderTop: "1px solid var(--border-ghost)",
  display: "flex", flexDirection: "column", gap: 6,
};
const fieldLabel: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)", letterSpacing: "0.04em",
  textTransform: "uppercase",
};
const btnRow: CSSProperties = { display: "flex", gap: 6 };
const primaryBtn: CSSProperties = {
  flex: 1, padding: "6px 10px", fontSize: 12,
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
const primaryBtnDisabled: CSSProperties = {
  ...primaryBtn, opacity: 0.4, cursor: "not-allowed",
};
const hdBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 10px", fontSize: 12,
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
const proPill: CSSProperties = {
  display: "inline-flex", alignItems: "center",
  fontSize: 9, padding: "1px 5px", borderRadius: 8,
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
  fontWeight: 600, letterSpacing: "0.06em",
};
const restoreBtn: CSSProperties = {
  marginTop: 4, padding: "5px 10px", fontSize: 11,
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  cursor: "pointer", textAlign: "left",
};
const runningRow: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
};
const runningLabel: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)", fontStyle: "italic",
};
const cancelBtn: CSSProperties = {
  padding: "4px 8px", fontSize: 11,
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
const errorRow: CSSProperties = {
  fontSize: 11, color: "var(--accent-orange)", marginTop: 2,
};
const hintRow: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)", marginTop: 4,
};
