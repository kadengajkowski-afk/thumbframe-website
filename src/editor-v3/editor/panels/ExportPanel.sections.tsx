import { type CSSProperties } from "react";
import type { ExportFormat } from "@/lib/export";
import type { RecentExport } from "@/state/uiStore";
import { formatBytes } from "@/lib/export";
import * as s from "./ExportPanel.styles";

/** Day 19 — sub-sections + helper text for ExportPanel. Lives in
 * its own file so the orchestrating ExportPanel.tsx fits under the
 * 250-line panel ceiling. */

export const HELPER_TEXT: Record<ExportFormat, string> = {
  png: "Lossless. Best for graphics, larger file.",
  jpeg: "Smaller file. Slight quality loss.",
  youtube: "Optimized 1280×720 JPEG, sized for YouTube.",
  "4k": "Pro only — high-res for thumbnails on bigger screens.",
};

export const BG_PRESETS: { id: string; label: string; color?: number; transparent?: boolean }[] = [
  { id: "transparent", label: "Transparent", transparent: true },
  { id: "black", label: "Black", color: 0x000000 },
  { id: "white", label: "White", color: 0xffffff },
  { id: "dark", label: "Dark", color: 0x050510 },
];

export function FormatSection(props: {
  format: ExportFormat;
  onPick: (f: ExportFormat) => void;
  isPro: boolean;
}) {
  // Day 38 — clicking 4K as a free user opens the UpgradePanel instead
  // of selecting the format. Pro users get the real format picker.
  const onPickFormat = (f: ExportFormat) => {
    if (f === "4k" && !props.isPro) {
      // Lazy import to avoid pulling uiStore into the sections file's
      // top-level deps unnecessarily — Day 38 wiring only.
      import("@/state/uiStore").then((m) =>
        m.useUiStore.getState().setUpgradePanelOpen(true),
      );
      return;
    }
    props.onPick(f);
  };
  return (
    <div style={s.section}>
      <div style={s.sectionLabel}>Format</div>
      <div style={s.formatRow}>
        <FormatBtn id="youtube" current={props.format} onPick={onPickFormat} label="YouTube" sub="1280×720 JPEG" />
        <FormatBtn id="png" current={props.format} onPick={onPickFormat} label="PNG" sub="lossless" />
        <FormatBtn id="jpeg" current={props.format} onPick={onPickFormat} label="JPEG" sub="custom q" />
        <FormatBtn id="4k" current={props.format} onPick={onPickFormat} label="4K" sub={props.isPro ? "2560×1440" : "Upgrade"} pro={!props.isPro} />
      </div>
      <div style={helperText}>{HELPER_TEXT[props.format]}</div>
    </div>
  );
}

export function BackgroundSection(props: {
  bgId: string;
  onPick: (id: string) => void;
  format: ExportFormat;
}) {
  // Transparent only meaningful for PNG / 4K(PNG). JPEG/YouTube
  // collapse to white if the user picked transparent.
  return (
    <div style={s.section}>
      <div style={s.sectionLabel}>Background</div>
      <div style={s.formatRow}>
        {BG_PRESETS.map((p) => {
          const isJpeg = props.format === "jpeg" || props.format === "youtube";
          const muted = p.transparent && isJpeg;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => props.onPick(p.id)}
              style={{
                ...s.formatBtn,
                ...(props.bgId === p.id ? s.formatBtnActive : null),
                ...(muted ? { opacity: 0.5 } : null),
              }}
              data-testid={`export-bg-${p.id}`}
              title={muted ? "Transparent → white in JPEG" : undefined}
            >
              <div style={s.formatBtnLabel}>{p.label}</div>
              {p.transparent && <div style={s.formatBtnSub}>α</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RecentSection(props: {
  recents: RecentExport[];
  onPick: (entry: RecentExport) => void;
}) {
  if (props.recents.length === 0) return null;
  return (
    <div style={s.section}>
      <div style={s.sectionLabel}>Recent</div>
      <div style={recentList}>
        {props.recents.slice(0, 5).map((r) => (
          <button
            key={r.timestamp}
            type="button"
            onClick={() => props.onPick(r)}
            style={recentBtn}
            data-testid="export-recent"
          >
            <span style={recentBtnLabel}>{labelFor(r)}</span>
            <span style={recentBtnSub}>{r.width}×{r.height}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function labelFor(r: RecentExport): string {
  if (r.format === "youtube") return "YouTube";
  if (r.format === "4k") return "4K";
  if (r.format === "png") return "PNG";
  return `JPEG q${r.quality}`;
}

function FormatBtn(props: {
  id: ExportFormat;
  current: ExportFormat;
  onPick: (f: ExportFormat) => void;
  label: string;
  sub: string;
  pro?: boolean;
}) {
  const active = props.id === props.current;
  return (
    <button
      type="button"
      onClick={() => props.onPick(props.id)}
      style={{
        ...s.formatBtn,
        ...(active ? s.formatBtnActive : null),
        ...(props.pro ? s.formatBtnPro : null),
        position: "relative",
      }}
      data-testid={`export-format-${props.id}`}
    >
      <div style={s.formatBtnLabel}>{props.label}</div>
      <div style={s.formatBtnSub}>{props.sub}</div>
      {props.pro && <span style={proBadge}>PRO</span>}
    </button>
  );
}

export function PreviewMeta(props: {
  width: number;
  height: number;
  bytes: number;
  overTarget: boolean;
}) {
  return (
    <div style={s.previewMeta}>
      {props.width}×{props.height} · {formatBytes(props.bytes)}
      {props.overTarget && (
        <span style={s.warn}> · over 2 MB — YouTube may downscale</span>
      )}
    </div>
  );
}

const helperText: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary)",
  marginTop: 6,
  fontStyle: "italic",
};
const proBadge: CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: "var(--bg-space-0)",
  background: "var(--accent-orange)",
  padding: "1px 4px",
  borderRadius: 3,
};
const recentList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const recentBtn: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 10px",
  background: "transparent",
  border: "1px solid var(--border-ghost)",
  borderRadius: 5,
  color: "var(--text-primary)",
  fontSize: 12,
  cursor: "pointer",
  textAlign: "left",
};
const recentBtnLabel: CSSProperties = { fontWeight: 500 };
const recentBtnSub: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary)",
};
