// src/editor-v2/ui/ThemeProvider.jsx
// -----------------------------------------------------------------------------
// Purpose:  Theme context for the Phase 4.6 cockpit. Dark is default
//           ("space"); light is an opt-in toggle ("ocean"). Writes the
//           token palette to the <html> element as CSS custom properties
//           so the entire tree crossfades over MOTION_TOKENS.theme.
//
// Exports:  ThemeProvider, useTheme, getInitialTheme,
//           themeStorageKey
// Depends:  ./tokens
//
// Storage:  localStorage key is namespaced per user when a user id is
//           passed to ThemeProvider via the `userId` prop; otherwise
//           'anon' is used. Matches the brief's "persists keyed by
//           user id" directive.
//
// Safe under jsdom: every document.* / localStorage.* call is guarded,
// returning sensible defaults when absent.
// -----------------------------------------------------------------------------

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  cssVariablesForTheme, THEME_NAMES, MOTION_TOKENS, EASING,
} from './tokens';

/** Keys the <html>-attribute hook uses for feature detection. */
const HTML_ATTR = 'data-editor-theme';
const STORAGE_PREFIX = 'thumbframe.editor.theme';

/** @typedef {'dark'|'light'} ThemeName */

/**
 * @typedef {Object} ThemeContextValue
 * @property {ThemeName} theme
 * @property {(next: ThemeName) => void} setTheme
 * @property {() => void} toggleTheme
 * @property {string} userId
 */

/** @type {React.Context<ThemeContextValue>} */
const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
  userId: 'anon',
});

export function themeStorageKey(userId = 'anon') {
  return `${STORAGE_PREFIX}.${userId || 'anon'}`;
}

/** Read persisted preference. Returns null when unset or on SSR. */
export function getInitialTheme(userId = 'anon', fallback = 'dark') {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(themeStorageKey(userId));
    if (raw === 'dark' || raw === 'light') return raw;
  } catch { /* ignore */ }
  return fallback;
}

/**
 * Apply CSS variables for `theme` to the element. Idempotent.
 * Also sets a data-* attribute so consumers can style on
 *   [data-editor-theme='light']
 * without reading context.
 */
function applyTheme(element, theme) {
  if (!element || !element.style) return;
  const vars = cssVariablesForTheme(theme);
  for (const [k, v] of Object.entries(vars)) {
    try { element.style.setProperty(k, v); } catch { /* noop */ }
  }
  try { element.setAttribute(HTML_ATTR, theme); } catch { /* noop */ }
}

/** Install the CSS-variable transition so every theme flip crossfades. */
function installThemeTransition(element) {
  if (!element || !element.style) return;
  const propList = [
    'background-color', 'color', 'border-color',
    'box-shadow', 'fill', 'stroke',
  ].join(', ');
  try {
    element.style.setProperty(
      'transition',
      `${propList} ${MOTION_TOKENS.theme}ms ${EASING.theme}`,
    );
  } catch { /* noop */ }
}

/**
 * @param {{
 *   userId?: string,
 *   defaultTheme?: ThemeName,
 *   targetEl?: HTMLElement|null,   // test hook; defaults to document.documentElement
 *   children: React.ReactNode,
 * }} props
 */
export function ThemeProvider({ userId = 'anon', defaultTheme = 'dark', targetEl, children }) {
  const [theme, setThemeState] = useState(() => getInitialTheme(userId, defaultTheme));
  const appliedRef = useRef(null);

  // Resolve the element we're writing to. document may not exist (SSR).
  const resolvedTarget = useMemo(() => {
    if (targetEl) return targetEl;
    if (typeof document !== 'undefined') return document.documentElement;
    return null;
  }, [targetEl]);

  // Install the crossfade transition ONCE per target.
  useEffect(() => {
    if (!resolvedTarget) return;
    installThemeTransition(resolvedTarget);
  }, [resolvedTarget]);

  // Paint the current theme onto the target whenever it changes.
  useEffect(() => {
    if (!resolvedTarget) return;
    applyTheme(resolvedTarget, theme);
    appliedRef.current = theme;
  }, [resolvedTarget, theme]);

  const setTheme = useCallback((next) => {
    if (next !== 'dark' && next !== 'light') return;
    setThemeState(next);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(themeStorageKey(userId), next); } catch { /* ignore */ }
    }
  }, [userId]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, userId }),
    [theme, setTheme, toggleTheme, userId],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Access the current theme + setters. Must be called inside a
 * <ThemeProvider/>; falls back to the default context when used
 * without one (e.g. in isolated component tests).
 */
export function useTheme() {
  return useContext(ThemeContext);
}

/** Exported for use by tests that need to reset state between runs. */
export const __THEME_NAMES = THEME_NAMES;
