import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import * as s from "./ContextPanel.styles";

/** Shared primitives + styles for the TextEffects panel. Pulled into
 * its own file so TextEffects.tsx stays under the 400-line file
 * ceiling and the per-section sources read tightly. */

export function Section({
  title,
  summary,
  open,
  onToggle,
  enabled,
  onEnableChange,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  enabled?: boolean;
  onEnableChange?: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeader}>
        {onEnableChange ? (
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnableChange(e.target.checked)}
            style={{ marginRight: 6 }}
            aria-label={`Enable ${title}`}
          />
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          style={sectionTitleButton}
          aria-expanded={open}
        >
          <span style={sectionTitle}>{title}</span>
          <span style={sectionSummary}>{summary}</span>
          <span style={sectionChevron}>{open ? "▾" : "▸"}</span>
        </button>
      </div>
      {open ? children : null}
    </section>
  );
}

export function EffectRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={effectRow}>
      <span style={effectRowLabel}>{label}</span>
      {children}
    </div>
  );
}

/** Number input wrapper — keeps the value as a controlled string
 * draft until commit so partial edits ("0.0") don't get coerced and
 * a per-keystroke history entry isn't pushed. Commits on blur or
 * Enter; clamps to [min, max]. */
export function NumberInput({
  min,
  max,
  step,
  value,
  onCommit,
  decimals,
  suffix,
  compact,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onCommit: (v: number) => void;
  decimals: number;
  suffix?: string;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? Number(value.toFixed(decimals)).toString();

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(min, Math.min(max, parsed));
    if (clamped === value) return;
    onCommit(clamped);
  };

  return (
    <div style={numWrap}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={display}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        style={compact ? numFieldCompact : numField}
      />
      {suffix ? <span style={numSuffix}>{suffix}</span> : null}
    </div>
  );
}

const sectionStyle: CSSProperties = {
  ...s.section,
  background: "var(--bg-space-2)",
  borderRadius: 6,
  padding: "8px 10px",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const sectionTitleButton: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  textAlign: "left",
  color: "var(--text-primary)",
};

const sectionTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const sectionSummary: CSSProperties = {
  flex: 1,
  fontSize: 11,
  color: "var(--text-secondary)",
};

const sectionChevron: CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
};

export const effectColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 8,
};

const effectRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const effectRowLabel: CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: "var(--text-secondary)",
};

const numField: CSSProperties = {
  width: 64,
  height: 28,
  padding: "0 8px",
  background: "var(--bg-space-1)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "var(--font-mono)",
};

const numFieldCompact: CSSProperties = {
  ...numField,
  width: 48,
};

const numWrap: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const numSuffix: CSSProperties = {
  fontSize: 11,
  color: "var(--text-secondary)",
};

export const colorField: CSSProperties = {
  width: 32,
  height: 28,
  padding: 0,
  background: "transparent",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  cursor: "pointer",
};

export const removeButton: CSSProperties = {
  width: 24,
  height: 24,
  background: "var(--bg-space-1)",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

export const addButton: CSSProperties = {
  height: 28,
  background: "var(--bg-space-1)",
  color: "var(--text-primary)",
  border: "1px dashed var(--border-ghost)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};
