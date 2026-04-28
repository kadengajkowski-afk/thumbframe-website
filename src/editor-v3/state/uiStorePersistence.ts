/** Day 32 — uiStore localStorage helpers, split out so the store
 * stays under the 400-line ceiling. Behavior identical to the
 * original inline helpers. */

import { normalizeHex } from "@/lib/color";

const RECENT_COLORS_KEY    = "thumbframe:recent-colors";
const LAST_FILL_KEY        = "thumbframe:last-fill";
const RECENT_FONTS_KEY     = "thumbframe:recent-fonts";

const DEFAULT_FILL = "#F97316";

export function loadString(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

export function loadNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function persistString(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode / quota
  }
}

export function loadRecentColors(maxRecent: number): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_COLORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => (typeof c === "string" ? normalizeHex(c) : null))
      .filter((c): c is string => c !== null)
      .slice(0, maxRecent);
  } catch {
    return [];
  }
}

export function persistRecentColors(colors: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors));
  } catch { /* swallow */ }
}

export function loadLastFillColor(): string {
  if (typeof window === "undefined") return DEFAULT_FILL;
  try {
    const raw = window.localStorage.getItem(LAST_FILL_KEY);
    const normalized = raw ? normalizeHex(raw) : null;
    return normalized ?? DEFAULT_FILL;
  } catch {
    return DEFAULT_FILL;
  }
}

export function persistLastFillColor(hex: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_FILL_KEY, hex);
  } catch { /* swallow */ }
}

export function loadRecentFonts(maxRecent: number): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FONTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((f): f is string => typeof f === "string")
      .slice(0, maxRecent);
  } catch {
    return [];
  }
}

export function persistRecentFonts(fonts: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(fonts));
  } catch { /* swallow */ }
}
