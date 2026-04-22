// src/editor-v2/ui/tokens.js
// -----------------------------------------------------------------------------
// Purpose:  Single source of visual truth for the Phase 4.6 UI rebuild.
//           Exposes:
//             THEMES           — the dark/light palettes from the design brief
//             PALETTES         — alias for THEMES (compat)
//             MOTION_TOKENS    — named durations (fast / standard / theme /
//                                shipAlive)
//             EASING           — default + theme curves
//             cssVariablesForTheme(themeName) -> CSS variable map
//
//           Also re-exports the Phase 4.a tokens (COLORS / TYPOGRAPHY /
//           SPACING / RADII / SHADOWS / MOTION / transition) so existing
//           Phase 4.a tests + components keep working while the 4.6
//           cockpit rolls out. The legacy COLORS bag maps to the dark-
//           theme values so nothing visually regresses during the
//           rebuild.
// -----------------------------------------------------------------------------

// ── Phase 4.6 design tokens ───────────────────────────────────────────────

/**
 * Full palette for each theme. Keys are the CSS-variable-style names
 * from the brief; values are concrete strings that can be copied into
 * inline styles or serialized into custom-property declarations.
 */
export const THEMES = Object.freeze({
  dark: Object.freeze({
    '--bg-space-1':           '#0a0a0f',
    '--bg-space-2':           '#15151e',
    '--bg-gradient-1':        '#0a0a0f',
    '--bg-gradient-2':        '#15151e',
    '--accent':               '#F9F0E1',
    '--accent-cream':         '#F9F0E1',
    '--accent-navy':          '#1B2430',
    '--canvas-surface':       '#1a1a22',
    '--canvas-surface-dark':  '#1a1a22',
    '--canvas-surface-light': '#EDE7DA',
    '--panel-bg':             'rgba(255, 255, 255, 0.04)',
    '--panel-bg-raised':      'rgba(255, 255, 255, 0.06)',
    '--panel-backdrop':       'blur(12px)',
    '--border-subtle':        'rgba(255, 255, 255, 0.08)',
    '--border-soft':          'rgba(255, 255, 255, 0.12)',
    '--text-primary':         '#F9F0E1',
    '--text-secondary':       'rgba(249, 240, 225, 0.72)',
    '--text-muted':           'rgba(249, 240, 225, 0.48)',
    '--text-inverse':         '#1B2430',
    '--ship-it-bg':           '#F9F0E1',
    '--ship-it-fg':           '#1B2430',
    '--success':              '#8aa090',
    '--warning':              '#ffb866',
    '--danger':               '#e87050',
  }),
  light: Object.freeze({
    '--bg-space-1':           '#F4F1EA',
    '--bg-space-2':           '#D8E3EC',
    '--bg-gradient-1':        '#F4F1EA',
    '--bg-gradient-2':        '#D8E3EC',
    '--accent':               '#1B2430',
    '--accent-cream':         '#F9F0E1',
    '--accent-navy':          '#1B2430',
    '--canvas-surface':       '#EDE7DA',
    '--canvas-surface-dark':  '#1a1a22',
    '--canvas-surface-light': '#EDE7DA',
    '--panel-bg':             'rgba(255, 255, 255, 0.6)',
    '--panel-bg-raised':      'rgba(255, 255, 255, 0.78)',
    '--panel-backdrop':       'blur(12px)',
    '--border-subtle':        'rgba(27, 36, 48, 0.08)',
    '--border-soft':          'rgba(27, 36, 48, 0.12)',
    '--text-primary':         '#1B2430',
    '--text-secondary':       'rgba(27, 36, 48, 0.72)',
    '--text-muted':           'rgba(27, 36, 48, 0.48)',
    '--text-inverse':         '#F9F0E1',
    '--ship-it-bg':           '#1B2430',
    '--ship-it-fg':           '#F9F0E1',
    '--success':              '#3F6C4E',
    '--warning':              '#B26E23',
    '--danger':               '#A44035',
  }),
});

/** Back-compat alias — some downstream code imports PALETTES. */
export const PALETTES = THEMES;

export const THEME_NAMES = Object.freeze(['dark', 'light']);

/** Named motion durations in milliseconds. */
export const MOTION_TOKENS = Object.freeze({
  fast:       150,   // hover flashes, tool pulses
  standard:   250,   // panel expand, modal
  theme:      300,   // theme crossfade
  shipAlive:  1200,  // first-upload cinematic
  slow:       400,
});

/** Named easing curves. */
export const EASING = Object.freeze({
  default: 'cubic-bezier(0.2, 0.8, 0.2, 1)',   // ease-out
  theme:   'cubic-bezier(0.4, 0, 0.2, 1)',     // ease-in-out
});

/**
 * Return a flat map of CSS custom-property names → values for the
 * named theme. Callers pipe this into
 *   Object.entries(map).forEach(([k, v]) => el.style.setProperty(k, v))
 */
export function cssVariablesForTheme(name) {
  const theme = THEMES[name] || THEMES.dark;
  return { ...theme };
}

// ── Legacy Phase 4.a exports ──────────────────────────────────────────────
// Kept so Phase 4.a / 4.b / 4.c / 4.d tests continue to pass during the
// 4.6 rebuild. The COLORS bag here maps to the DARK theme values so the
// editor's visual baseline stays stable until 4.6.b rewires the shell.

export const COLORS = Object.freeze({
  bgDeepSpace:   '#0a0a0f',
  bgPanel:       'rgba(255, 255, 255, 0.04)',
  bgPanelRaised: 'rgba(255, 255, 255, 0.06)',
  bgCanvasFrame: '#1a1a22',

  borderFaint:   'rgba(255, 255, 255, 0.06)',
  borderSoft:    'rgba(255, 255, 255, 0.10)',
  borderStrong:  'rgba(255, 255, 255, 0.16)',

  textPrimary:   '#faecd0',
  textSecondary: 'rgba(250, 236, 208, 0.7)',
  textMuted:     'rgba(250, 236, 208, 0.45)',

  cream:         '#faecd0',
  orange:        '#f97316',
  success:       '#8aa090',
  warning:       '#ffb866',
  danger:        '#e87050',
});

export const TYPOGRAPHY = Object.freeze({
  body:    "'Inter Variable', 'Inter', system-ui, sans-serif",
  numeric: "'Geist Variable', 'Geist', 'SFMono-Regular', ui-monospace, monospace",
  display: "'Fraunces Variable', 'Fraunces', Georgia, serif",
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
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
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
  fast:     MOTION_TOKENS.fast,
  standard: MOTION_TOKENS.standard,
  slow:     MOTION_TOKENS.slow,
  ease:     'cubic-bezier(0.22, 1, 0.36, 1)',
});

/**
 * Legacy helper — build a CSS transition string from the existing
 * MOTION tokens. New code should reach for `buildTransition` below,
 * which accepts the 4.6 MOTION_TOKENS + EASING names.
 * @param {string} property
 * @param {keyof MOTION} speed
 */
export function transition(property, speed = 'standard') {
  return `${property} ${MOTION[speed]}ms ${MOTION.ease}`;
}

/**
 * 4.6 transition composer. `speed` is any key in MOTION_TOKENS, `ease`
 * any key in EASING.
 */
export function buildTransition(property, speed = 'standard', ease = 'default') {
  const ms  = MOTION_TOKENS[speed] ?? MOTION_TOKENS.standard;
  const fn  = EASING[ease] ?? EASING.default;
  return `${property} ${ms}ms ${fn}`;
}
