// src/editor-v2/ui/tokens.js
// -----------------------------------------------------------------------------
// Purpose:  Single source for every editor UI visual constant. Every
//           Phase 4 component reads from here — no hex codes, spacing,
//           durations, or shadow strings live inline in component files.
// Exports:  COLORS, TYPOGRAPHY, SPACING, RADII, SHADOWS, MOTION
// Depends:  nothing
//
// Voice: direct address, honest, terse. Reflected by `COLORS.cream` as
// the default accent (matched to the landing page) and `COLORS.orange`
// as the active-tool glow.
// -----------------------------------------------------------------------------

export const COLORS = Object.freeze({
  // Backgrounds
  bgDeepSpace:   '#0a0a0f',
  bgPanel:       'rgba(255, 255, 255, 0.04)',
  bgPanelRaised: 'rgba(255, 255, 255, 0.06)',
  bgCanvasFrame: '#0f0a18',

  // Borders
  borderFaint:   'rgba(255, 255, 255, 0.06)',
  borderSoft:    'rgba(255, 255, 255, 0.10)',
  borderStrong:  'rgba(255, 255, 255, 0.16)',

  // Text
  textPrimary:   '#faecd0',                   // cream, from landing
  textSecondary: 'rgba(250, 236, 208, 0.7)',
  textMuted:     'rgba(250, 236, 208, 0.45)',

  // Accents
  cream:         '#faecd0',                   // default accent
  orange:        '#f97316',                   // active state
  success:       '#8aa090',
  warning:       '#ffb866',
  danger:        '#e87050',
});

export const TYPOGRAPHY = Object.freeze({
  body:    "'Inter Variable', 'Inter', system-ui, sans-serif",
  numeric: "'Geist Variable', 'Geist', 'SFMono-Regular', ui-monospace, monospace",
  sizeXs:  11,
  sizeSm:  12,
  sizeMd:  14,
  sizeLg:  16,
  sizeXl:  20,
  weightRegular: 400,
  weightMedium:  500,
  weightBold:    700,
});

export const SPACING = Object.freeze({
  xs:  4,  sm:  8,  md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
});

export const RADII = Object.freeze({
  sm: 6, md: 10, lg: 16,
});

export const SHADOWS = Object.freeze({
  panel:         '0 10px 30px rgba(0, 0, 0, 0.35)',
  panelRaised:   '0 20px 50px rgba(0, 0, 0, 0.5)',
  canvasDrop:    '0 30px 80px rgba(0, 0, 0, 0.45)',
  activeToolGlow:
    '0 0 0 1px rgba(250, 236, 208, 0.6), 0 0 16px rgba(250, 236, 208, 0.35)',
});

export const MOTION = Object.freeze({
  fast:     150,    // ms  — hover flashes, tool pulses
  standard: 250,    // ms  — panel expand, modal
  slow:     400,    // ms  — layout shifts, tour overlays
  ease:     'cubic-bezier(0.22, 1, 0.36, 1)',  // ease-out default
});

/**
 * Helper: build a CSS transition string from the tokens.
 * @param {string} property
 * @param {keyof MOTION} speed
 */
export function transition(property, speed = 'standard') {
  return `${property} ${MOTION[speed]}ms ${MOTION.ease}`;
}
