import { describe, it, expect, beforeEach, vi } from "vitest";

/** Day 51 — Onboarding flow scaffold tests.
 *
 * Day 51 ships the state machine + skip wiring. Day 52 will add the
 * full UX (animations, ThumbFriend handoff, tour overlay, first-
 * export celebration). These tests cover what landed today:
 *   - state machine transitions across the 5 steps
 *   - skip from any step persists the completed flag
 *   - existing-completed user does NOT auto-trigger onboarding
 *   - tour mode advances + finishes correctly
 *   - markFirstExport is one-shot + idempotent + only fires post-
 *     onboarding-complete */

beforeEach(() => {
  // Wipe localStorage before each test so persistence doesn't leak.
  window.localStorage.clear();
});

describe("Day 51 — onboarding state machine", () => {
  it("starts at idle when not completed", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    expect(useOnboardingStore.getState().step).toBe("idle");
    expect(useOnboardingStore.getState().completed).toBe(false);
  });

  it("startOnboarding moves idle → welcome", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    useOnboardingStore.getState().startOnboarding();
    expect(useOnboardingStore.getState().step).toBe("welcome");
  });

  it("startOnboarding is no-op when already completed", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    useOnboardingStore.getState().completeOnboarding();
    expect(useOnboardingStore.getState().completed).toBe(true);
    useOnboardingStore.getState().startOnboarding();
    // Stays at idle — completed flag should block re-entry.
    expect(useOnboardingStore.getState().step).toBe("idle");
  });

  it("goToStep transitions through the 5 steps", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.startOnboarding();
    expect(useOnboardingStore.getState().step).toBe("welcome");
    s.goToStep("starter");
    expect(useOnboardingStore.getState().step).toBe("starter");
    s.goToStep("upload");
    expect(useOnboardingStore.getState().step).toBe("upload");
    s.goToStep("thumbfriend");
    expect(useOnboardingStore.getState().step).toBe("thumbfriend");
  });

  it("pickStarter records selection", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    useOnboardingStore.getState().pickStarter("gaming");
    expect(useOnboardingStore.getState().selectedStarter).toBe("gaming");
  });

  it("skipFromCurrent persists completed + clears state", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.startOnboarding();
    s.goToStep("starter");
    s.pickStarter("vlog");
    s.skipFromCurrent();

    expect(useOnboardingStore.getState().step).toBe("idle");
    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(useOnboardingStore.getState().selectedStarter).toBe(null);
    expect(window.localStorage.getItem("thumbframe:onboarding-completed")).toBe("1");
  });

  it("startTour + advanceTour walks 0..4 then completes", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.startOnboarding();
    s.goToStep("thumbfriend");
    s.startTour();
    expect(useOnboardingStore.getState().tourStop).toBe(0);
    expect(useOnboardingStore.getState().step).toBe("tour");
    for (let i = 0; i < 4; i++) s.advanceTour();
    expect(useOnboardingStore.getState().tourStop).toBe(4);
    s.advanceTour(); // 5th advance falls through to complete
    expect(useOnboardingStore.getState().step).toBe("complete");
    expect(useOnboardingStore.getState().tourStop).toBe(-1);
  });

  it("finishTour shortcuts the loop", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.startOnboarding();
    s.startTour();
    s.advanceTour();
    expect(useOnboardingStore.getState().tourStop).toBe(1);
    s.finishTour();
    expect(useOnboardingStore.getState().step).toBe("complete");
    expect(useOnboardingStore.getState().tourStop).toBe(-1);
  });

  it("completeOnboarding fires only once (idempotent)", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.completeOnboarding();
    expect(useOnboardingStore.getState().completed).toBe(true);
    // Second call is a no-op — but doesn't throw.
    s.completeOnboarding();
    expect(useOnboardingStore.getState().completed).toBe(true);
  });

  it("markFirstExport returns false BEFORE onboarding completes", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.startOnboarding();
    expect(s.markFirstExport()).toBe(false);
    expect(useOnboardingStore.getState().firstExportCelebrated).toBe(false);
  });

  it("markFirstExport returns true ONCE post-completion", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.completeOnboarding();
    expect(s.markFirstExport()).toBe(true);
    expect(useOnboardingStore.getState().firstExportCelebrated).toBe(true);
    // Second call is no-op.
    expect(s.markFirstExport()).toBe(false);
  });

  it("markFirstExport persists across reload via localStorage", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const s = useOnboardingStore.getState();
    s.completeOnboarding();
    s.markFirstExport();
    expect(window.localStorage.getItem("thumbframe:onboarding-first-export-celebrated")).toBe("1");
  });
});

describe("Day 51 — STARTER_TEMPLATES", () => {
  it("ships exactly 4 starter templates", async () => {
    const { STARTER_TEMPLATES } = await import("@/state/onboardingStore");
    expect(STARTER_TEMPLATES).toHaveLength(4);
    const ids = STARTER_TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual(["blank", "gaming", "tutorial", "vlog"]);
  });

  it("every template has name + niche + tagline + previewKind", async () => {
    const { STARTER_TEMPLATES } = await import("@/state/onboardingStore");
    for (const t of STARTER_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(t.niche).toBeTruthy();
      expect(t.tagline).toBeTruthy();
      expect(t.previewKind).toBeTruthy();
    }
  });
});

describe("Day 51 — analytics events", () => {
  it("emitAnalyticsEvent logs to console.log (PostHog wiring is Day 56)", async () => {
    const { emitAnalyticsEvent } = await import("@/state/onboardingStore");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    emitAnalyticsEvent({ name: "onboarding_started" });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0]?.[0]).toBe("[onboarding]");
    expect(spy.mock.calls[0]?.[1]).toBe("onboarding_started");
    spy.mockRestore();
  });

  it("startOnboarding fires onboarding_started", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    useOnboardingStore.getState().startOnboarding();
    const calls = spy.mock.calls.filter((c) => c[1] === "onboarding_started");
    expect(calls.length).toBe(1);
    spy.mockRestore();
  });

  it("skipFromCurrent fires onboarding_skipped with from_step", async () => {
    const { useOnboardingStore } = await import("@/state/onboardingStore");
    useOnboardingStore.getState()._reset();
    useOnboardingStore.getState().startOnboarding();
    useOnboardingStore.getState().goToStep("starter");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    useOnboardingStore.getState().skipFromCurrent();
    const calls = spy.mock.calls.filter((c) => c[1] === "onboarding_skipped");
    expect(calls.length).toBe(1);
    expect(calls[0]?.[2]).toBe("starter");
    spy.mockRestore();
  });
});
