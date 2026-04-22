// src/editor-v2/ui/CockpitShell.jsx
// -----------------------------------------------------------------------------
// Purpose:  The editor's top-level frame. Hosts the three regions —
//           tool palette (left), canvas stage (center, floating), and
//           contextual panel (right, collapsible) — plus the layer
//           panel (bottom, collapsible) and the status bar.
// Exports:  CockpitShell (default)
// Depends:  ./tokens
//
// Layout math:
//   • tool palette: fixed 56px wide
//   • contextual panel: 320px when open, 0 when collapsed
//   • layer panel: 160px when open, 32px tab when collapsed
//   • remaining space is the canvas stage with ~48px inset padding
//
// Phase 4.a scope: layout structure + status bar. No tool logic, no
// canvas rendering — children are rendered via slot props (canvas,
// toolPalette, contextualPanel, layerPanel, commandPalette).
// -----------------------------------------------------------------------------

import React, { useState } from 'react';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, transition } from './tokens';

export default function CockpitShell({
  canvas,
  toolPalette,
  contextualPanel,
  layerPanel,
  commandPalette,
  projectName = 'Untitled',
  layerCount  = 0,
  saveStatus  = 'saved',
  zoomPercent = 100,
  editorVersion = 'v2',
}) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.bgDeepSpace,
        color: COLORS.textPrimary,
        fontFamily: TYPOGRAPHY.body,
        fontSize: TYPOGRAPHY.sizeMd,
        display: 'grid',
        gridTemplateColumns: `56px 1fr ${panelOpen ? '320px' : '0'}`,
        gridTemplateRows: `1fr ${layersOpen ? '160px' : '32px'} 28px`,
        gridTemplateAreas: `
          "tools  canvas   panel"
          "tools  layers   layers"
          "status status   status"
        `,
        transition: transition('grid-template-columns', 'standard'),
      }}
      data-cockpit
    >
      {/* Tool palette — left */}
      <div
        style={{
          gridArea: 'tools',
          background: COLORS.bgPanel,
          borderRight: `1px solid ${COLORS.borderFaint}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${SPACING.md}px 0`,
          gap: SPACING.xs,
        }}
      >
        {toolPalette}
      </div>

      {/* Canvas stage — center */}
      <div
        style={{
          gridArea: 'canvas',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACING.xxxl,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            boxShadow: SHADOWS.canvasDrop,
            borderRadius: SPACING.sm,
            overflow: 'hidden',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {canvas}
        </div>
      </div>

      {/* Contextual panel — right */}
      <aside
        style={{
          gridArea: 'panel',
          background: COLORS.bgPanel,
          borderLeft: `1px solid ${COLORS.borderFaint}`,
          overflow: panelOpen ? 'auto' : 'hidden',
          opacity: panelOpen ? 1 : 0,
          transition: transition('opacity', 'fast'),
        }}
      >
        {contextualPanel}
        <PanelToggle
          direction="right"
          open={panelOpen}
          onToggle={() => setPanelOpen(v => !v)}
        />
      </aside>

      {/* Layer panel — bottom */}
      <section
        style={{
          gridArea: 'layers',
          background: COLORS.bgPanel,
          borderTop: `1px solid ${COLORS.borderFaint}`,
          overflow: layersOpen ? 'auto' : 'hidden',
        }}
      >
        <LayerPanelHeader
          open={layersOpen}
          onToggle={() => setLayersOpen(v => !v)}
        />
        {layersOpen && layerPanel}
      </section>

      {/* Status bar — full width */}
      <footer
        style={{
          gridArea: 'status',
          background: COLORS.bgPanelRaised,
          borderTop: `1px solid ${COLORS.borderFaint}`,
          display: 'flex',
          alignItems: 'center',
          padding: `0 ${SPACING.lg}px`,
          gap: SPACING.lg,
          fontSize: TYPOGRAPHY.sizeXs,
          color: COLORS.textSecondary,
          fontFamily: TYPOGRAPHY.numeric,
          fontVariantNumeric: 'tabular-nums',
        }}
        data-status
      >
        <span>{editorVersion}</span>
        <span>·</span>
        <span>{projectName}</span>
        <span>·</span>
        <span>layers: {layerCount}</span>
        <span style={{ marginLeft: 'auto' }}>zoom: {Math.round(zoomPercent)}%</span>
        <SaveStatusDot status={saveStatus} />
      </footer>

      {/* Command palette overlay lives above everything */}
      {commandPalette}
    </div>
  );
}

function PanelToggle({ open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={open ? 'Hide properties panel' : 'Show properties panel'}
      style={{
        position: 'absolute',
        right: open ? 312 : 4,
        top: 8,
        width: 24, height: 24,
        background: COLORS.bgPanelRaised,
        color: COLORS.textPrimary,
        border: `1px solid ${COLORS.borderSoft}`,
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        lineHeight: '22px',
        padding: 0,
        transition: transition('all', 'fast'),
      }}
    >
      {open ? '›' : '‹'}
    </button>
  );
}

function LayerPanelHeader({ open, onToggle }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center',
        padding: `${SPACING.xs}px ${SPACING.md}px`,
        height: 32, boxSizing: 'border-box',
        fontSize: TYPOGRAPHY.sizeXs,
        color: COLORS.textSecondary,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}
    >
      <span>Layers</span>
      <button
        onClick={onToggle}
        aria-label={open ? 'Collapse layers' : 'Expand layers'}
        style={{
          marginLeft: 'auto',
          background: 'transparent',
          border: 0, cursor: 'pointer',
          color: COLORS.textSecondary,
          fontSize: 14,
        }}
      >
        {open ? '˅' : '˄'}
      </button>
    </div>
  );
}

function SaveStatusDot({ status }) {
  const color =
    status === 'saved'   ? COLORS.success
  : status === 'saving'  ? COLORS.warning
  : status === 'offline' ? COLORS.textMuted
  :                        COLORS.danger;
  return (
    <span
      aria-label={`save: ${status}`}
      style={{
        display: 'inline-flex', alignItems: 'center',
        gap: 6, color: COLORS.textSecondary,
      }}
    >
      <span style={{
        display: 'inline-block', width: 8, height: 8,
        borderRadius: '50%', background: color,
      }} />
      {status}
    </span>
  );
}
