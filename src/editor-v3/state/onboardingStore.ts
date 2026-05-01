import { create } from "zustand";
import {
  loadCompleted,
  loadFirstExportCelebrated,
  persistCompleted,
  persistFirstExportCelebrated,
  type OnboardingStep,
  type StarterTemplateId,
} from "./onboardingPersistence";

/** Day 51 — Onboarding state machine.
 *
 * Lives in its own store (not uiStore — uiStore is already at the
 * 460-line ceiling). Step sequencing is the load-bearing logic;
 * UI components subscribe to `step` and render the matching panel.
 *
 * Day 51 ships the state machine + skip wiring + 4 placeholder
 * starter templates. Day 52 adds the actual per-step UX (animations,
 * copy, ThumbFriend handoff, tour mode). */

export type AnalyticsEvent =
  | { name: "onboarding_started" }
  | { name: "onboarding_step_completed"; step: OnboardingStep }
  | { name: "onboarding_skipped"; from_step: OnboardingStep }
  | { name: "onboarding_completed" }
  | { name: "first_thumbnail_exported" };

/** Day 51 — analytics sink. Day 56 will wire to PostHog; today we
 * console.log so the events are observable without infra. Single
 * place to swap once PostHog lands. */
export function emitAnalyticsEvent(event: AnalyticsEvent): void {
  // eslint-disable-next-line no-console
  console.log("[onboarding]", event.name, "step" in event ? event.step : "from_step" in event ? event.from_step : "");
  // Day 56 — replace with `posthog.capture(event.name, payload)`.
}

export type OnboardingState = {
  step: OnboardingStep;
  /** True after the user finishes (or skips) the flow. Persisted. */
  completed: boolean;
  /** Tracks the first export after onboarding completes; one-time
   * celebration toast fires when this flips false → true and the
   * persisted flag is still false. */
  firstExportCelebrated: boolean;
  /** When the user picked a starter template at Step B, we keep the
   * id around so Step D can mention it in the Captain's greeting
   * ("I see you picked a Gaming thumbnail"). Cleared after onboarding
   * completes. */
  selectedStarter: StarterTemplateId | null;
  /** When the user uploaded an image at Step C, the dominant-color
   * hex (computed lazily). Cleared after onboarding completes. */
  pickedDominantColor: string | null;
  /** Tour mode runs from Step D. 0..4 indexes the 5 stops. -1 means
   * tour not started. */
  tourStop: number;

  startOnboarding: () => void;
  goToStep: (next: OnboardingStep) => void;
  pickStarter: (id: StarterTemplateId) => void;
  setDominantColor: (hex: string | null) => void;
  startTour: () => void;
  advanceTour: () => void;
  finishTour: () => void;
  skipFromCurrent: () => void;
  completeOnboarding: () => void;
  /** First-export detection — call once when user actually exports
   * post-onboarding. Idempotent: re-calls are no-ops if already
   * celebrated. Returns true on the first call (caller renders the
   * celebration), false on subsequent calls. */
  markFirstExport: () => boolean;
  /** Reset for tests + dev. */
  _reset: () => void;
};

const TOUR_STOPS = 5;

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  step: "idle",
  completed: loadCompleted(),
  firstExportCelebrated: loadFirstExportCelebrated(),
  selectedStarter: null,
  pickedDominantColor: null,
  tourStop: -1,

  startOnboarding: () => {
    if (get().completed) return;
    emitAnalyticsEvent({ name: "onboarding_started" });
    set({ step: "welcome", tourStop: -1 });
  },

  goToStep: (next) => {
    const { step } = get();
    if (step !== next) {
      emitAnalyticsEvent({ name: "onboarding_step_completed", step });
    }
    set({ step: next });
  },

  pickStarter: (id) => {
    set({ selectedStarter: id });
  },

  setDominantColor: (hex) => set({ pickedDominantColor: hex }),

  startTour: () => set({ step: "tour", tourStop: 0 }),

  advanceTour: () =>
    set((s) => {
      const next = s.tourStop + 1;
      if (next >= TOUR_STOPS) {
        // Past the last stop — fall through to complete.
        return { tourStop: -1, step: "complete" };
      }
      return { tourStop: next };
    }),

  finishTour: () => set({ tourStop: -1, step: "complete" }),

  skipFromCurrent: () => {
    const { step } = get();
    emitAnalyticsEvent({ name: "onboarding_skipped", from_step: step });
    persistCompleted(true);
    set({
      step: "idle",
      completed: true,
      tourStop: -1,
      selectedStarter: null,
      pickedDominantColor: null,
    });
  },

  completeOnboarding: () => {
    if (get().completed) return;
    emitAnalyticsEvent({ name: "onboarding_completed" });
    persistCompleted(true);
    set({
      step: "idle",
      completed: true,
      tourStop: -1,
    });
  },

  markFirstExport: () => {
    if (get().firstExportCelebrated) return false;
    if (!get().completed) {
      // Still in onboarding — celebration will fire post-onboarding,
      // not mid-flow. Don't burn the flag yet.
      return false;
    }
    emitAnalyticsEvent({ name: "first_thumbnail_exported" });
    persistFirstExportCelebrated(true);
    set({ firstExportCelebrated: true });
    return true;
  },

  _reset: () => {
    persistCompleted(false);
    persistFirstExportCelebrated(false);
    set({
      step: "idle",
      completed: false,
      firstExportCelebrated: false,
      selectedStarter: null,
      pickedDominantColor: null,
      tourStop: -1,
    });
  },
}));

/** Day 51 — placeholder starter templates. Day 52 wires per-template
 * basic structures (background fill + 1-2 placeholder text layers).
 * Real templates are v3.1 work — these are STARTING POINTS, not
 * finished thumbnails. Each has a niche tag + a one-line preview
 * description for the card UI. */
export type StarterTemplate = {
  id: StarterTemplateId;
  name: string;
  niche: string;
  /** One-line preview for the card. */
  tagline: string;
  /** Day 52 will swap this for actual layer-spawn logic. Today it's
   * a marker — components render a styled placeholder box. */
  previewKind: "gaming" | "tutorial" | "vlog" | "blank";
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "gaming",
    name: "Gaming",
    niche: "Gaming",
    tagline: "Bold colors, big text, action.",
    previewKind: "gaming",
  },
  {
    id: "tutorial",
    name: "Tutorial",
    niche: "How-to / Tech",
    tagline: "Clean, focused, title-led.",
    previewKind: "tutorial",
  },
  {
    id: "vlog",
    name: "Vlog",
    niche: "Lifestyle / Vlog",
    tagline: "Warm tones, expressive face.",
    previewKind: "vlog",
  },
  {
    id: "blank",
    name: "Blank",
    niche: "Anything",
    tagline: "Empty canvas. Build from scratch.",
    previewKind: "blank",
  },
];
