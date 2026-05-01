/** Day 51 — ThumbFrame onboarding persistence.
 *
 * Stores the first-run flag in localStorage so a returning user
 * doesn't see the onboarding flow twice. Cycle 6 Day 53+ will sync
 * to Supabase profiles for cross-device parity, but localStorage is
 * the first cut.
 *
 * Migration rule (per Day 52 spec): existing signed-in users with
 * any rows in `v3_projects` are auto-marked completed on first
 * encounter (they're not new). That logic lives in App.tsx — this
 * file only handles raw read/write.
 *
 * Key namespacing matches the existing thumbframe:* convention. */

const COMPLETED_KEY = "thumbframe:onboarding-completed";
const FIRST_EXPORT_KEY = "thumbframe:onboarding-first-export-celebrated";

export type OnboardingStep =
  | "idle"        // not started or already completed
  | "welcome"     // step A — welcome card
  | "starter"    // step B — pick a starter template
  | "upload"     // step C — drag/drop image (only if user picked "I have an image")
  | "thumbfriend" // step D — meet the AI crew
  | "tour"       // optional guided tour from step D
  | "complete";   // terminal — fires onboarding_completed event then transitions to idle

export type StarterTemplateId =
  | "gaming"
  | "tutorial"
  | "vlog"
  | "blank";

export function loadCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistCompleted(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(COMPLETED_KEY, "1");
    else window.localStorage.removeItem(COMPLETED_KEY);
  } catch {
    // ignore — quota / private mode
  }
}

export function loadFirstExportCelebrated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FIRST_EXPORT_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistFirstExportCelebrated(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(FIRST_EXPORT_KEY, "1");
    else window.localStorage.removeItem(FIRST_EXPORT_KEY);
  } catch {
    // ignore
  }
}
