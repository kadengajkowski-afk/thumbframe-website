// src/editor-v2/ui/CockpitShell.jsx
// -----------------------------------------------------------------------------
// Purpose:  Phase 4.6 cockpit shell. Lays out the editor like the
//           bridge of a sailship:
//             • thin top bar with brand mark + save indicator + ship-it
//             • left tool palette, 48px (collapsible)
//             • center canvas stage, floating over a nebula/ripple bg
//             • right contextual panel, 320px (240px at tablet)
//             • bottom layer panel, 120px default (collapsible)
//           Below 1024px viewport, a banner explains this is the
//           bridge, not the compressed-panel experience.
// Exports:  default (CockpitShell)
// Depends:  ./tokens, ./ThemeProvider
//
// Children are rendered via slot props (topBar, toolPalette, canvas,
// contextualPanel, layerPanel, commandPalette) so this file stays a
// layout. No tool logic lives here. No side effects beyond a single
// window resize listener.
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import {
  TYPOGRAPHY, SPACING, MOTION_TOKENS, EASING, buildTransition,
} from './tokens';
import { useTheme } from './ThemeProvider';
import { COPY } from './copy';

const TOOL_WIDTH            = 48;
// TOOL_COLLAPSED_WIDTH (12) is used by the 4.6.d tool palette itself
// when its own chevron collapses the strip. The shell treats the
// palette as always-visible; it's the palette that handles its own
// collapse. Kept here as a design-token reference point only.
const PANEL_WIDTH_DESKTOP   = 320;
const PANEL_WIDTH_TABLET    = 240;
const LAYER_HEIGHT_OPEN     = 120;
const LAYER_HEIGHT_CLOSED   = 32;
const TOPBAR_HEIGHT         = 44;
const TABLET_BREAKPOINT     = 1280;
const CRAMPED_BREAKPOINT    = 1024;

export default function CockpitShell({
  topBar,
  toolPalette,
  canvas,
  contextualPanel,
  layerPanel,
  commandPalette,
  emptyOverlay,       // optional — e.g. the Phase 4.6.c empty state
  shipAliveOverlay,   // optional — e.g. the Phase 4.6.c transition
  showChrome = true,  // false during the pre-upload empty state
  layerPanelOpen = true,
  onLayerPanelToggle,
}) {
  const { theme } = useTheme();
  // Contextual panel collapse is a Phase 4.6.e concern (toggled from
  // inside the panel header). Shell default: always open.
  const [panelOpen] = useState(true);
  const [viewport, setViewport] = useState(() => ({
    width:  typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900  : window.innerHeight,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewport({
      width: window.innerWidth, height: window.innerHeight,
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isTablet  = viewport.width < TABLET_BREAKPOINT;
  const isCramped = viewport.width < CRAMPED_BREAKPOINT;

  const panelWidth = showChrome && panelOpen
    ? (isTablet ? PANEL_WIDTH_TABLET : PANEL_WIDTH_DESKTOP)
    : 0;
  const toolWidth  = showChrome ? TOOL_WIDTH : 0;
  const layerHeightResolved = showChrome && layerPanelOpen
    ? LAYER_HEIGHT_OPEN : (showChrome ? LAYER_HEIGHT_CLOSED : 0);
  const topBarHeight = showChrome ? TOPBAR_HEIGHT : 0;

  return (
    <div
      data-cockpit
      data-theme={theme}
      style={{
        position: 'fixed',
        inset: 0,
        color: 'var(--text-primary)',
        fontFamily: TYPOGRAPHY.body,
        fontSize: TYPOGRAPHY.sizeMd,
        background: _backgroundGradient(theme),
        overflow: 'hidden',
      }}
    >
      {/* Ambient background layer — nebula in dark, rippled ocean
          in light. Pure CSS; no assets. Sits behind everything and
          doesn't catch pointer events. */}
      <AmbientBackdrop theme={theme} />

      {showChrome && (
        <div
          data-cockpit-grid
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: `${toolWidth}px 1fr ${panelWidth}px`,
            gridTemplateRows:    `${topBarHeight}px 1fr ${layerHeightResolved}px`,
            gridTemplateAreas: `
              "topbar topbar  topbar"
              "tools  canvas  panel"
              "tools  layers  layers"
            `,
            transition: [
              buildTransition('grid-template-columns', 'standard'),
              buildTransition('grid-template-rows',    'standard'),
            ].join(', '),
          }}
        >
          {/* Top bar */}
          <header
            data-cockpit-topbar
            style={{
              gridArea: 'topbar',
              background: 'var(--panel-bg)',
              backdropFilter: 'var(--panel-backdrop)',
              WebkitBackdropFilter: 'var(--panel-backdrop)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              paddingInline: SPACING.md,
            }}
          >
            {topBar}
          </header>

          {/* Tool palette */}
          <aside
            data-cockpit-tools
            style={{
              gridArea: 'tools',
              background: 'var(--panel-bg)',
              backdropFilter: 'var(--panel-backdrop)',
              WebkitBackdropFilter: 'var(--panel-backdrop)',
              borderRight: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              paddingBlock: SPACING.sm,
            }}
          >
            {toolPalette}
          </aside>

          {/* Canvas stage */}
          <main
            data-cockpit-canvas
            style={{
              gridArea: 'canvas',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: SPACING.xxl,
            }}
          >
            <CanvasFrame>{canvas}</CanvasFrame>
          </main>

          {/* Contextual panel */}
          <aside
            data-cockpit-panel
            style={{
              gridArea: 'panel',
              background: 'var(--panel-bg)',
              backdropFilter: 'var(--panel-backdrop)',
              WebkitBackdropFilter: 'var(--panel-backdrop)',
              borderLeft: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              transition: buildTransition('width', 'standard'),
            }}
          >
            {contextualPanel}
          </aside>

          {/* Layer panel */}
          <section
            data-cockpit-layers
            style={{
              gridArea: 'layers',
              background: 'var(--panel-bg)',
              backdropFilter: 'var(--panel-backdrop)',
              WebkitBackdropFilter: 'var(--panel-backdrop)',
              borderTop: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <LayerPanelHeader
              open={layerPanelOpen}
              onToggle={onLayerPanelToggle}
            />
            {layerPanelOpen && layerPanel}
          </section>
        </div>
      )}

      {/* When showChrome is false we render ONLY the canvas area — the
          4.6.c empty state uses this path, and the ship-alive overlay
          flips showChrome back on after the cinematic completes. */}
      {!showChrome && (
        <main
          data-cockpit-canvas-only
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: SPACING.xxl,
          }}
        >
          {canvas}
        </main>
      )}

      {/* Overlays — rendered above the grid so they can dim / cover
          the chrome without participating in layout. */}
      {emptyOverlay}
      {shipAliveOverlay}

      {/* Command palette modal */}
      {commandPalette}

      {/* Cramped viewport banner */}
      {isCramped && (
        <div
          role="status"
          data-cockpit-cramped-banner
          style={{
            position: 'absolute',
            left: 0, right: 0, top: 0,
            background: 'var(--panel-bg-raised)',
            backdropFilter: 'var(--panel-backdrop)',
            WebkitBackdropFilter: 'var(--panel-backdrop)',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: TYPOGRAPHY.sizeSm,
            padding: `${SPACING.sm}px ${SPACING.md}px`,
            textAlign: 'center',
            zIndex: 40,
          }}
        >
          {COPY.cockpit.crampedBanner}
        </div>
      )}
    </div>
  );
}

// ── Canvas frame (floating document) ──────────────────────────────────────
function CanvasFrame({ children }) {
  return (
    <div
      data-canvas-frame
      style={{
        position: 'relative',
        width:  1280,
        height: 720,
        maxWidth:  '100%',
        maxHeight: '100%',
        background: 'var(--canvas-surface)',
        border: `1px solid var(--accent-cream)`,
        borderRadius: 6,
        boxShadow:
          '0 30px 80px rgba(0,0,0,0.35), '
        + '0 0 0 1px var(--border-subtle)',
        overflow: 'hidden',
        // Subtle dot pattern so the canvas edges are legible when an
        // image is smaller than 1280x720 or transparent.
        backgroundImage: _canvasDotPattern(),
        backgroundSize: '14px 14px',
        backgroundPosition: '0 0',
      }}
    >
      {children}
    </div>
  );
}

// ── Ambient backdrop ──────────────────────────────────────────────────────
// Dark = nebula (a dim radial gradient with faint stars via
// background-image). Light = rippled ocean (stacked soft gradients).
function AmbientBackdrop({ theme }) {
  const isDark = theme === 'dark';
  return (
    <div
      aria-hidden
      data-cockpit-backdrop
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        backgroundImage: isDark
          ? [
              // Nebula glow
              'radial-gradient(1200px 700px at 30% 20%, rgba(98, 120, 180, 0.12), transparent 70%)',
              'radial-gradient(900px  600px at 75% 80%, rgba(180, 120, 160, 0.08), transparent 70%)',
              // Starfield
              'radial-gradient(1px 1px at 20% 20%, rgba(249,240,225,0.5), transparent 60%)',
              'radial-gradient(1px 1px at 60% 40%, rgba(249,240,225,0.4), transparent 60%)',
              'radial-gradient(1px 1px at 80% 70%, rgba(249,240,225,0.3), transparent 60%)',
              'radial-gradient(1px 1px at 40% 85%, rgba(249,240,225,0.35), transparent 60%)',
            ].join(', ')
          : [
              // Water ripple
              'radial-gradient(1000px 700px at 20% 80%, rgba(180, 210, 225, 0.35), transparent 70%)',
              'radial-gradient(900px  600px at 80% 25%, rgba(200, 220, 230, 0.30), transparent 70%)',
              'linear-gradient(180deg, rgba(244, 241, 234, 0.5), rgba(216, 227, 236, 0.5))',
            ].join(', '),
        transition: `opacity ${MOTION_TOKENS.theme}ms ${EASING.theme}`,
      }}
    />
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
        color: 'var(--text-secondary)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}
    >
      <span>{COPY.cockpit.layersHeader}</span>
      <button
        onClick={onToggle}
        aria-label={open ? COPY.cockpit.collapseLayers : COPY.cockpit.expandLayers}
        style={{
          marginLeft: 'auto', background: 'transparent',
          border: 0, cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 14,
        }}
      >
        {open ? '˅' : '˄'}
      </button>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────
function _backgroundGradient(theme) {
  return theme === 'dark'
    ? 'linear-gradient(180deg, var(--bg-space-1), var(--bg-space-2))'
    : 'linear-gradient(180deg, var(--bg-space-1), var(--bg-space-2))';
}

function _canvasDotPattern() {
  // A tiny cream dot on a transparent grid — subtle enough to read
  // like paper grain, visible enough to signal canvas bounds.
  return 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)';
}
