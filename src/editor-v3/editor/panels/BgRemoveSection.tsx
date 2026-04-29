import { type CSSProperties, useState } from "react";
import type { ImageLayer } from "@/state/types";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import { removeBg, BgRemoveError } from "@/lib/bgRemove";
import { FREE_BG_REMOVE_LIMIT } from "@/state/bgRemovePersistence";
import {
  setBgRemoveController,
  cancelBgRemove,
} from "../bgRemoveController";

/** Cycle 6 — Background remove section in ContextPanel for image
 * layers. Single "Remove BG" button calls the Remove.bg HD endpoint.
 * Free tier gets 3 trial uses/month; Pro gets 100/month. The scanning
 * animation lives in BgRemoveOverlay (mounted in App.tsx) — this
 * section just kicks off the request and surfaces the result. */

export function BgRemoveSection({ layer }: { layer: ImageLayer }) {
  const userTier = useUiStore((u) => u.userTier);
  const isPro = userTier === "pro";
  const bgRemoveCount = useUiStore((u) => u.bgRemoveCount);
  const incrementBgRemoveCount = useUiStore((u) => u.incrementBgRemoveCount);
  const setBgRemoveInProgress = useUiStore((u) => u.setBgRemoveInProgress);
  const inProgress = useUiStore((u) => u.bgRemoveInProgress);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, FREE_BG_REMOVE_LIMIT - bgRemoveCount);
  const freeAtCap = !isPro && remaining <= 0;
  const hasOriginal = !!layer.originalBitmap;

  async function run() {
    if (inProgress) return;
    if (freeAtCap) return;
    setError(null);
    const controller = new AbortController();
    setBgRemoveController(controller);
    setBgRemoveInProgress(layer.id);
    try {
      const result = await removeBg({
        bitmap: layer.bitmap,
        signal: controller.signal,
      });
      history.replaceLayerBitmap(layer.id, result.bitmap, "Remove BG");
      if (!isPro) incrementBgRemoveCount();
    } catch (err) {
      if (err instanceof BgRemoveError) {
        if (err.code === "ABORTED") {
          // Cancel — silent.
        } else if (err.code === "FREE_LIMIT_REACHED") {
          setError(
            `${FREE_BG_REMOVE_LIMIT} free removes used — upgrade to Pro for ${100}/month`,
          );
        } else if (err.code === "RATE_LIMITED") {
          setError("Monthly limit reached");
        } else if (err.code === "AUTH_REQUIRED") {
          setError("Sign in to remove backgrounds");
        } else {
          setError(err.message);
        }
      } else {
        setError("Couldn't cut out the background");
      }
    } finally {
      setBgRemoveController(null);
      setBgRemoveInProgress(null);
    }
  }

  function restore() {
    history.restoreLayerOriginalBitmap(layer.id);
  }

  return (
    <section style={section}>
      <label style={fieldLabel}>Background</label>
      {inProgress ? (
        <div style={runningRow} data-testid="bg-remove-running">
          <span style={runningLabel}>Removing background…</span>
          <button type="button" style={cancelBtn} onClick={() => cancelBgRemove()}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            style={freeAtCap ? primaryBtnDisabled : primaryBtn}
            disabled={freeAtCap}
            onClick={run}
            title={
              freeAtCap
                ? "Out of free removes — upgrade to Pro"
                : isPro
                  ? "HD background removal (Remove.bg)"
                  : "Try HD background removal — free trial"
            }
            data-testid="bg-remove-run"
          >
            {freeAtCap
              ? "Out of free removes — upgrade to Pro"
              : `Remove BG${isPro ? "" : ` (${remaining} left)`}`}
          </button>
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
          {error && (
            <div style={errorRow} data-testid="bg-remove-error">
              {error}
            </div>
          )}
          {freeAtCap && (
            <div style={hintRow} data-testid="bg-remove-cap">
              {FREE_BG_REMOVE_LIMIT} free removes used this month — upgrade
              to Pro for 100/month.
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
const primaryBtn: CSSProperties = {
  padding: "6px 10px", fontSize: 12,
  background: "var(--bg-space-0)", color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)", borderRadius: 6, cursor: "pointer",
};
const primaryBtnDisabled: CSSProperties = {
  ...primaryBtn, opacity: 0.5, cursor: "not-allowed",
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
