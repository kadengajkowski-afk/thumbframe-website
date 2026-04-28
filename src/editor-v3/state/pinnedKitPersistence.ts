/** Day 32 — pinned Brand Kit localStorage helpers, split out of
 * uiStore.ts so the store stays under the 400-line ceiling. */

import type { PinnedBrandKit } from "./uiStore";

const PINNED_KIT_KEY = "thumbframe:pinned-brand-kit";

export function loadPinnedKit(): PinnedBrandKit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PINNED_KIT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PinnedBrandKit;
    if (!parsed || typeof parsed !== "object" || !parsed.channelId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistPinnedKit(kit: PinnedBrandKit | null) {
  if (typeof window === "undefined") return;
  try {
    if (kit) window.localStorage.setItem(PINNED_KIT_KEY, JSON.stringify(kit));
    else window.localStorage.removeItem(PINNED_KIT_KEY);
  } catch {
    // private mode / quota
  }
}
