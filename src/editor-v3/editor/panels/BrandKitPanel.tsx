import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { useBrandKit } from "@/editor/hooks/useBrandKit";
import { toast } from "@/toasts/toastStore";
import {
  listSavedBrandKits,
  saveBrandKit,
  deleteSavedBrandKit,
  rowToBrandKit,
  type SavedBrandKitRow,
} from "@/lib/savedBrandKits";
import { BrandKitResult, SavedKitsTab } from "./BrandKitPanel.parts";
import * as s from "./BrandKitPanel.styles";
import "./brand-kit.css";

/** Day 31 + 32 — Brand Kit panel.
 *
 * Day 31: extract a kit from a YouTube URL (display only).
 * Day 32: click swatch → recent + (apply to selection if any).
 *         Drag thumbnail → reference layer at 35% opacity, locked.
 *         Save / load saved kits (per-user Supabase).
 *         Pin kit → palette in ColorPicker, badge in TopBar. */

type Tab = "extract" | "saved";

export function BrandKitPanel() {
  const open  = useUiStore((u) => u.brandKitPanelOpen);
  const close = useUiStore((u) => u.setBrandKitPanelOpen);
  const user  = useUiStore((u) => u.user);
  const [tab, setTab] = useState<Tab>("extract");
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState<SavedBrandKitRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, extract, reset, setKit } = useBrandKit();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => inputRef.current?.focus());
    setInput("");
    setTab("extract");
    reset();
    if (user) void listSavedBrandKits().then(setSaved);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, reset, user]);

  // Persist a freshly-extracted kit if the user is signed in. Idempotent
  // upsert by (user_id, channel_id) so re-extracting just refreshes.
  useEffect(() => {
    if (state.status !== "success" || !user) return;
    void saveBrandKit(state.kit).then((ok) => {
      if (ok) void listSavedBrandKits().then(setSaved);
    });
  }, [state, user]);

  // Day 33 fix — keep the input populated when a saved kit loads in,
  // so the "Re-extract" link in BrandKitResult always has a known
  // handle to send back to the backend.
  useEffect(() => {
    if (state.status === "success" && !input) {
      setInput(state.kit.customUrl ?? state.kit.channelTitle);
    }
    // We intentionally only fire on status change, not input change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  if (!open) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void extract(input);
  };

  return (
    <div role="dialog" aria-label="Brand Kit" style={s.backdrop} onClick={() => close(false)} data-testid="brand-kit-panel">
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <header style={s.cardHeader}>Brand Kit</header>

        <div style={s.tabRow} role="tablist">
          <TabBtn active={tab === "extract"} onClick={() => setTab("extract")}>Extract</TabBtn>
          <TabBtn active={tab === "saved"}   onClick={() => setTab("saved")}>
            Saved {user && saved.length > 0 ? `(${saved.length})` : ""}
          </TabBtn>
        </div>

        {tab === "extract" && (
          <>
            <p style={s.subtitle}>
              Paste a YouTube channel URL or @handle to pull the channel's colors and thumbnails.
            </p>
            <form onSubmit={onSubmit} style={s.inputRow}>
              <input
                ref={inputRef}
                type="text"
                placeholder="youtube.com/@channel  or  @channel"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={state.status === "loading"}
                style={s.textInput}
                data-testid="brand-kit-input"
              />
              <button
                type="submit"
                disabled={state.status === "loading" || !input.trim()}
                style={s.submitBtn}
                data-testid="brand-kit-submit"
              >
                {state.status === "loading" ? "Extracting…" : "Extract"}
              </button>
            </form>

            {state.status === "loading" && (
              <div style={s.loadingBlock} data-testid="brand-kit-loading">
                <div style={s.spinner} />
                <LoadingPhases />
              </div>
            )}
            {state.status === "error" && (
              <div style={s.errorBlock} role="alert" data-testid="brand-kit-error">
                {state.error.message}
              </div>
            )}
            {state.status === "success" && (
              <BrandKitResult
                kit={state.kit}
                onReextract={() => void extract(input || state.kit.channelTitle, { bypassCache: true })}
              />
            )}
          </>
        )}

        {tab === "saved" && (
          <SavedKitsTab
            user={user}
            rows={saved}
            onOpen={(row) => {
              setKit(rowToBrandKit(row));
              setTab("extract");
            }}
            onDelete={async (row) => {
              const ok = window.confirm(`Remove "${row.channel_title}" from saved kits?`);
              if (!ok) return;
              if (await deleteSavedBrandKit(row.id)) {
                setSaved((rs) => rs.filter((r) => r.id !== row.id));
                toast("Kit removed");
              }
            }}
          />
        )}

        <button type="button" style={s.cancelBtn} onClick={() => close(false)}>Close</button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} style={active ? s.tabBtnActive : s.tabBtn} onClick={onClick}>
      {children}
    </button>
  );
}

/** Day 33 — fake-progress message that cycles through the three real
 * backend phases at sensible intervals. The backend POST is one
 * round-trip with no streaming, so this is purely UX — but the timings
 * roughly match what actually happens server-side: channels.list runs
 * fast (~300ms), playlistItems.list adds a beat, then sharp colors +
 * vision fonts run in parallel for ~3-5s. */
function LoadingPhases() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase(1), 800);
    const t2 = window.setTimeout(() => setPhase(2), 2200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);
  const messages = [
    "Fetching channel…",
    "Extracting colors…",
    "Detecting fonts…",
  ];
  return <span>{messages[phase]}</span>;
}
