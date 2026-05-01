import { useEffect, type CSSProperties } from "react";
import { useOnboardingStore } from "@/state/onboardingStore";
import { StepWelcome } from "./StepWelcome";
import { StepStarter } from "./StepStarter";
import { StepUpload } from "./StepUpload";
import { StepThumbFriend } from "./StepThumbFriend";
import { TourMode } from "./TourMode";

/** Day 51 — Onboarding orchestrator.
 *
 * Reads `step` from onboardingStore and renders the matching panel.
 * Returns null when the step is "idle" or "complete" (also handles
 * the `complete` → `idle` transition + persistence flip on mount).
 *
 * Mounted at the App level so it overlays the editor regardless of
 * which surface is in front (right rail, preview rack, etc).
 *
 * Day 52 will add the entrance/exit animations + the right-side
 * Esc + skip-link plumbing. Day 51 leaves them as TODO markers in
 * the per-step components. */
export function OnboardingFlow() {
  const step = useOnboardingStore((s) => s.step);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const skipFromCurrent = useOnboardingStore((s) => s.skipFromCurrent);

  // Day 51 — when step lands at "complete", flip persistence + reset
  // to idle in one tick so the orchestrator unmounts cleanly. Day 52
  // will animate the dismissal here.
  useEffect(() => {
    if (step === "complete") completeOnboarding();
  }, [step, completeOnboarding]);

  // Day 51 — Esc anywhere skips. Day 52 may revisit (some steps
  // could prefer "go back" semantics on Esc instead of skip).
  useEffect(() => {
    if (step === "idle" || step === "complete") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipFromCurrent();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, skipFromCurrent]);

  if (step === "idle" || step === "complete") return null;

  return (
    <div style={overlay} data-testid="onboarding-overlay">
      {step === "welcome" && <StepWelcome />}
      {step === "starter" && <StepStarter />}
      {step === "upload" && <StepUpload />}
      {step === "thumbfriend" && <StepThumbFriend />}
      {step === "tour" && <TourMode />}
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(8, 12, 22, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};
