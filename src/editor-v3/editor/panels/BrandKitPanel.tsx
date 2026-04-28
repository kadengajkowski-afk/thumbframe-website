import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { useBrandKit } from "@/editor/hooks/useBrandKit";
import type { BrandKit } from "@/lib/brandKit";
import * as s from "./BrandKitPanel.styles";
import "./brand-kit.css";

/** Day 31 — Brand Kit panel.
 *
 * Modal panel. User pastes a YouTube channel URL / @handle / channel id;
 * server resolves it, returns metadata + thumbnails + extracted color
 * palette. No apply-to-canvas yet (Day 32). */

export function BrandKitPanel() {
  const open  = useUiStore((u) => u.brandKitPanelOpen);
  const close = useUiStore((u) => u.setBrandKitPanelOpen);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, extract, reset } = useBrandKit();

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => inputRef.current?.focus());
    setInput("");
    reset();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, reset]);

  if (!open) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void extract(input);
  };

  return (
    <div
      role="dialog"
      aria-label="Brand Kit"
      style={s.backdrop}
      onClick={() => close(false)}
      data-testid="brand-kit-panel"
    >
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <header style={s.cardHeader}>Brand Kit</header>
        <p style={s.subtitle}>
          Paste a YouTube channel URL or @handle to pull the channel's
          colors and thumbnails.
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
            <span>Extracting brand kit…</span>
          </div>
        )}

        {state.status === "error" && (
          <div style={s.errorBlock} role="alert" data-testid="brand-kit-error">
            {state.error.message}
          </div>
        )}

        {state.status === "success" && <BrandKitResult kit={state.kit} />}

        <button type="button" style={s.cancelBtn} onClick={() => close(false)}>
          Close
        </button>
      </div>
    </div>
  );
}

function BrandKitResult({ kit }: { kit: BrandKit }) {
  return (
    <div style={s.resultWrap} data-testid="brand-kit-success">
      <div style={s.channelHeader}>
        {kit.avatarUrl ? (
          <img src={kit.avatarUrl} alt="" style={s.avatar} />
        ) : (
          <div style={s.avatarPlaceholder}>—</div>
        )}
        <div style={s.channelText}>
          <div style={s.channelName}>{kit.channelTitle}</div>
          {kit.customUrl && <div style={s.channelHandle}>{kit.customUrl}</div>}
          <div style={s.channelStats}>
            {formatCount(kit.subscriberCount)} subscribers · {formatCount(kit.videoCount)} videos
          </div>
        </div>
      </div>

      {kit.palette.length > 0 ? (
        <section style={s.section}>
          <div style={s.sectionLabel}>Colors</div>
          <div style={s.swatchRow} data-testid="brand-kit-swatches">
            {kit.primaryAccent && (
              <Swatch hex={kit.primaryAccent} label="Primary" primary />
            )}
            {kit.palette.map((hex) => (
              <Swatch key={hex} hex={hex} label={hex} />
            ))}
          </div>
        </section>
      ) : (
        <div style={s.emptyHint}>
          Couldn't extract colors — try a channel with more public uploads.
        </div>
      )}

      {kit.recentThumbnails.length > 0 && (
        <section style={s.section}>
          <div style={s.sectionLabel}>Recent thumbnails</div>
          <div style={s.thumbStrip}>
            {kit.recentThumbnails.slice(0, 6).map((t) => (
              <img key={t.videoId} src={t.url} alt={t.title} style={s.thumbImg} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Swatch({ hex, label, primary = false }: { hex: string; label: string; primary?: boolean }) {
  return (
    <div style={s.swatchBox}>
      <div
        style={{
          ...s.swatchChip,
          background: hex,
          outline: primary ? "2px solid var(--accent-cream)" : "1px solid var(--border-ghost)",
        }}
      />
      <div style={s.swatchLabel}>{label}</div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
