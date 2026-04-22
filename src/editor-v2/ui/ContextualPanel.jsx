// src/editor-v2/ui/ContextualPanel.jsx
// -----------------------------------------------------------------------------
// Purpose:  The right-hand property panel. Picks its body based on the
//           current selection: nothing, single image, single text,
//           single shape, single adjustment, or multi-select.
// Exports:  ContextualPanel (default), resolvePanelKind
// Depends:  ./tokens, ./ScrubNumber, ../actions/registry
// -----------------------------------------------------------------------------

import React from 'react';
import { COLORS, TYPOGRAPHY, SPACING } from './tokens';
import ScrubNumber from './ScrubNumber';
import ColorPicker from './ColorPicker';
import { executeAction } from '../actions/registry';
import { useDocumentLayer, useSelection } from '../store/hooks';

/** @typedef {'empty'|'image'|'text'|'shape'|'adjustment'|'multi'} PanelKind */

/** @returns {PanelKind} */
export function resolvePanelKind(layers, selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return 'empty';
  if (selectedIds.length > 1) return 'multi';
  const layer = (layers || []).find(l => l.id === selectedIds[0]);
  if (!layer) return 'empty';
  switch (layer.type) {
    case 'image':      return 'image';
    case 'text':       return 'text';
    case 'shape':      return 'shape';
    case 'adjustment': return 'adjustment';
    default:           return 'empty';
  }
}

/** Internal helper — handles both prop-driven and hook-driven paths. */
function _resolveKindForPanel(layersProp, selectedIds, singleFromStore) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) return 'empty';
  if (selectedIds.length > 1) return 'multi';
  const layer = Array.isArray(layersProp)
    ? layersProp.find(l => l.id === selectedIds[0])
    : singleFromStore;
  if (!layer) return 'empty';
  switch (layer.type) {
    case 'image':      return 'image';
    case 'text':       return 'text';
    case 'shape':      return 'shape';
    case 'adjustment': return 'adjustment';
    default:           return 'empty';
  }
}

/**
 * Props are optional — when omitted the panel reads directly from the
 * document + ephemeral stores so slider scrubs on siblings don't
 * re-render unrelated trees. Phase 4c/4d tests still pass explicit
 * arrays for isolated rendering.
 */
export default function ContextualPanel({ layers, selectedIds }) {
  // Two subscription paths depending on whether the caller passed props
  // explicitly (isolated tests do) or we're in the live editor.
  //
  // In the live path we deliberately AVOID useDocumentLayers() so that
  // slider drags on unrelated layers don't wake this panel. Instead:
  //   • useSelection()          — primitive array, small diff
  //   • useDocumentLayer(id)    — patch-scoped to THIS layer only
  const docSel     = useSelection();
  const selectedIdsResolved = Array.isArray(selectedIds) ? selectedIds : docSel;
  const singleId   = selectedIdsResolved.length === 1 ? selectedIdsResolved[0] : null;
  const singleFromStore = useDocumentLayer(singleId);

  // Prop path (tests) — read from the caller's layers array.
  // Hook path (live) — singleFromStore already has the layer.
  const layer = Array.isArray(layers)
    ? (singleId ? (layers.find(l => l.id === singleId) || null) : null)
    : singleFromStore;
  const kind = _resolveKindForPanel(layers, selectedIdsResolved, singleFromStore);

  return (
    <div
      data-testid="contextual-panel"
      data-kind={kind}
      style={{
        padding: SPACING.lg,
        fontSize: TYPOGRAPHY.sizeMd,
        color: COLORS.textPrimary,
      }}
    >
      <PanelHeader kind={kind} layer={layer} selectedIds={selectedIdsResolved} />
      {kind === 'empty'      && <CanvasSettingsBody />}
      {kind === 'image'      && <ImageBody      layer={layer} />}
      {kind === 'text'       && <TextBody       layer={layer} />}
      {kind === 'shape'      && <ShapeBody      layer={layer} />}
      {kind === 'adjustment' && <AdjustmentBody layer={layer} />}
      {kind === 'multi'      && <MultiSelectBody selectedIds={selectedIdsResolved} />}
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
function PanelHeader({ kind, layer, selectedIds }) {
  const title =
    kind === 'empty'      ? 'Canvas'
  : kind === 'multi'      ? `${selectedIds.length} layers`
  : (layer?.name || kind);
  const sub =
    kind === 'empty'      ? "Nothing selected — here's the canvas."
  : kind === 'multi'      ? 'Align and distribute the selection.'
  : kind === 'image'      ? 'Tune this image.'
  : kind === 'text'       ? 'Type, weight, colour — the whole typography stack.'
  : kind === 'shape'      ? 'Shape, fill, stroke, gradient.'
  : kind === 'adjustment' ? 'Tweak this adjustment.'
  : '';

  return (
    <div style={{ marginBottom: SPACING.lg }}>
      <div style={{ fontSize: TYPOGRAPHY.sizeLg, fontWeight: TYPOGRAPHY.weightMedium }}>{title}</div>
      <div style={{ fontSize: TYPOGRAPHY.sizeSm, color: COLORS.textSecondary, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ── Canvas settings (nothing selected) ─────────────────────────────────────
function CanvasSettingsBody() {
  return (
    <Section title="Size">
      <Row>
        <Field label="Width"  value="1280" suffix="px" />
        <Field label="Height" value="720"  suffix="px" />
      </Row>
      <Row>
        <ColorField label="Background" value="#0f0a18" />
      </Row>
    </Section>
  );
}

// ── Image panel ────────────────────────────────────────────────────────────
function ImageBody({ layer }) {
  return (
    <>
      <Section title="Transform">
        <TransformRows layer={layer} />
      </Section>
      <Section title="Appearance">
        <ScrubNumber label="Opacity" value={(layer.opacity ?? 1) * 100} min={0} max={100} step={1}
          onChange={(v) => executeAction('layer.setOpacity', layer.id, v / 100)} />
      </Section>
      <Section title="AI actions" advanced>
        <Hint>Pro: ThumbFriend feedback, background removal, SAM selection.</Hint>
      </Section>
    </>
  );
}

// ── Text panel ─────────────────────────────────────────────────────────────
function TextBody({ layer }) {
  const td = layer.textData || {};
  return (
    <>
      <Section title="Content">
        <TextInput
          value={td.content || ''}
          onChange={(v) => executeAction('layer.update', layer.id, { textData: { ...td, content: v } })}
        />
      </Section>
      <Section title="Typography">
        <Row>
          <ScrubNumber label="Size" value={td.fontSize || 96} min={8} max={500}
            onChange={(v) => executeAction('layer.update', layer.id, { textData: { ...td, fontSize: v } })} />
          <ScrubNumber label="Weight" value={Number(td.fontWeight || 800)} min={100} max={900} step={100}
            onChange={(v) => executeAction('layer.update', layer.id, { textData: { ...td, fontWeight: String(v) } })} />
        </Row>
        <ColorField
          label="Fill"
          value={td.fill || '#faecd0'}
          onChange={(v) => executeAction('layer.update', layer.id, { textData: { ...td, fill: v } })}
        />
      </Section>
      <Section title="Transform">
        <TransformRows layer={layer} />
      </Section>
      <Section title="Effects (stroke, glow, shadow)" advanced>
        <Hint>Add via the effects panel; edit stacks stroke-by-stroke.</Hint>
      </Section>
    </>
  );
}

// ── Shape panel ────────────────────────────────────────────────────────────
function ShapeBody({ layer }) {
  const sd = layer.shapeData || {};
  return (
    <>
      <Section title="Shape">
        <ReadOnlyField label="Kind" value={sd.shapeType || 'rect'} />
        <ColorField
          label="Fill"
          value={sd.fill || '#f97316'}
          onChange={(v) => executeAction('layer.update', layer.id, { shapeData: { ...sd, fill: v } })}
        />
        <ColorField
          label="Stroke"
          value={sd.stroke || '#00000000'}
          onChange={(v) => executeAction('layer.update', layer.id, { shapeData: { ...sd, stroke: v } })}
        />
        <ScrubNumber label="Stroke width" value={sd.strokeWidth || 0} min={0} max={48}
          onChange={(v) => executeAction('layer.update', layer.id, { shapeData: { ...sd, strokeWidth: v } })} />
      </Section>
      <Section title="Transform">
        <TransformRows layer={layer} />
      </Section>
    </>
  );
}

// ── Adjustment panel ───────────────────────────────────────────────────────
function AdjustmentBody({ layer }) {
  const ad = layer.adjustmentData || {};
  const params = ad.params || {};
  return (
    <Section title={ad.kind || 'Adjustment'}>
      {Object.entries(params).map(([k, v]) => (
        typeof v === 'number' ? (
          <ScrubNumber
            key={k} label={k} value={v} min={-100} max={100} step={1}
            onChange={(newVal) => executeAction('layer.adjustment.update', layer.id, { [k]: newVal })}
          />
        ) : null
      ))}
      {Object.keys(params).length === 0 && <Hint>No params yet — pick an adjustment to edit.</Hint>}
    </Section>
  );
}

// ── Multi-select panel ─────────────────────────────────────────────────────
function MultiSelectBody({ selectedIds }) {
  return (
    <>
      <Section title={`${selectedIds.length} layers`}>
        <Hint>Align and distribute; individual properties disabled until one layer is selected.</Hint>
      </Section>
      <Section title="Align">
        <Row>
          <button style={btn()}>Left</button>
          <button style={btn()}>Center</button>
          <button style={btn()}>Right</button>
        </Row>
        <Row>
          <button style={btn()}>Top</button>
          <button style={btn()}>Middle</button>
          <button style={btn()}>Bottom</button>
        </Row>
      </Section>
    </>
  );
}

// ── Shared UI atoms ────────────────────────────────────────────────────────
function Section({ title, advanced = false, children }) {
  const [open, setOpen] = React.useState(!advanced);
  return (
    <section style={{ marginBottom: SPACING.lg }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left',
          background: 'transparent', border: 0, padding: 0, margin: `0 0 ${SPACING.sm}px 0`,
          color: COLORS.textSecondary, fontSize: 11, letterSpacing: '0.08em',
          textTransform: 'uppercase', cursor: advanced ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>{title}</span>
        {advanced && <span style={{ fontSize: 12 }}>{open ? '–' : '+'}</span>}
      </button>
      {open && children}
    </section>
  );
}

function Row({ children }) {
  return (
    <div style={{ display: 'flex', gap: SPACING.sm, alignItems: 'center' }}>
      {children}
    </div>
  );
}

function Field({ label, value, suffix = '' }) {
  return (
    <ScrubNumber label={label} value={value} suffix={suffix} />
  );
}

function ColorField({ label, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const resolved = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000';
  return (
    <div style={{ position: 'relative', padding: `${SPACING.xs}px 0` }}>
      <button
        type="button"
        data-color-field
        aria-label={`Edit ${label}`}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: SPACING.sm,
          width: '100%',
          background: 'transparent', border: 0, padding: 0,
          fontSize: TYPOGRAPHY.sizeSm,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <span>{label}</span>
        <span
          aria-hidden
          style={{
            width: 36, height: 22,
            borderRadius: 4,
            border: '1px solid var(--border-soft)',
            background: resolved,
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0,
            zIndex: 20,
            marginTop: SPACING.xs,
            background: 'var(--panel-bg-raised)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            padding: SPACING.sm,
            width: 220,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          <ColorPicker label={label} value={resolved} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function TextInput({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      rows={2}
      style={{
        width: '100%', resize: 'vertical',
        fontFamily: TYPOGRAPHY.body, fontSize: TYPOGRAPHY.sizeSm,
        background: COLORS.bgPanelRaised,
        color: COLORS.textPrimary,
        border: `1px solid ${COLORS.borderSoft}`,
        borderRadius: 6, padding: 8,
      }}
    />
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: `${SPACING.xs}px 0`,
      fontSize: TYPOGRAPHY.sizeSm, color: COLORS.textSecondary,
    }}>
      <span>{label}</span>
      <span style={{ color: COLORS.textPrimary }}>{value}</span>
    </div>
  );
}

function Hint({ children }) {
  return (
    <div style={{ fontSize: TYPOGRAPHY.sizeSm, color: COLORS.textMuted, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

function TransformRows({ layer }) {
  return (
    <>
      <Row>
        <ScrubNumber label="X" value={layer.x ?? 0}
          onChange={(v) => executeAction('layer.update', layer.id, { x: v })} />
        <ScrubNumber label="Y" value={layer.y ?? 0}
          onChange={(v) => executeAction('layer.update', layer.id, { y: v })} />
      </Row>
      <Row>
        <ScrubNumber label="W" value={layer.width  ?? 0} min={1}
          onChange={(v) => executeAction('layer.update', layer.id, { width: v })} />
        <ScrubNumber label="H" value={layer.height ?? 0} min={1}
          onChange={(v) => executeAction('layer.update', layer.id, { height: v })} />
      </Row>
    </>
  );
}

function btn() {
  return {
    flex: 1, padding: `${SPACING.xs + 2}px`,
    background: COLORS.bgPanelRaised,
    color: COLORS.textPrimary,
    border: `1px solid ${COLORS.borderSoft}`,
    borderRadius: 6, cursor: 'pointer',
    fontSize: 12,
  };
}
