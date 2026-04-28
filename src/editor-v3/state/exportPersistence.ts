/** Day 19 — localStorage helpers for the tier flag, recent-exports
 * stack, and last-export snapshot. Lives in its own file so uiStore.ts
 * stays under the 400-line ceiling. The store imports these and wires
 * them into the matching setters. */

export type RecentExport = {
  format: "png" | "jpeg" | "youtube" | "4k";
  quality: number;
  width: number;
  height: number;
  filename: string;
  timestamp: number;
};

const DEV_TIER_KEY = "thumbframe:dev-tier";
const RECENT_EXPORTS_KEY = "thumbframe:recent-exports";
const LAST_EXPORT_KEY = "thumbframe:last-export";
export const MAX_RECENT_EXPORTS = 10;

export function loadDevTier(): "free" | "pro" {
  if (typeof window === "undefined") return "free";
  try {
    const raw = window.localStorage.getItem(DEV_TIER_KEY);
    return raw === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

export function persistDevTier(tier: "free" | "pro") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEV_TIER_KEY, tier);
  } catch {
    // swallow
  }
}

export function loadRecentExports(): RecentExport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_EXPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentExport).slice(0, MAX_RECENT_EXPORTS);
  } catch {
    return [];
  }
}

export function persistRecentExports(entries: RecentExport[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_EXPORTS_KEY, JSON.stringify(entries));
  } catch {
    // swallow
  }
}

export function loadLastExport(): RecentExport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_EXPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isRecentExport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function persistLastExport(entry: RecentExport) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_EXPORT_KEY, JSON.stringify(entry));
  } catch {
    // swallow
  }
}

function isRecentExport(v: unknown): v is RecentExport {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.format === "png" || o.format === "jpeg" || o.format === "youtube" || o.format === "4k") &&
    typeof o.quality === "number" &&
    typeof o.width === "number" &&
    typeof o.height === "number" &&
    typeof o.filename === "string" &&
    typeof o.timestamp === "number"
  );
}
