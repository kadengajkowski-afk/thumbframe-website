import type { CSSProperties } from "react";
import { useOnboardingStore } from "@/state/onboardingStore";

/** Day 51 — Step A scaffold. Welcome card + two CTAs.
 *
 * Day 52 layers in:
 *   - Fraunces font for "Welcome aboard."
 *   - Fade-in + scale entrance (300ms ease-out)
 *   - Parallax star drift behind card
 *   - Polished CTA button styling (primary --accent-orange + outline)
 *
 * Today the structure + state transitions work; the visual is
 * intentionally raw so Day 52's animation pass has a clear target. */
export function StepWelcome() {
  const goToStep = useOnboardingStore((s) => s.goToStep);
  const skip = useOnboardingStore((s) => s.skipFromCurrent);

  return (
    <div style={card} data-testid="onboarding-step-welcome">
      {/* Day 52 — fade-in + scale-up keyframe animation. */}
      <style>{keyframes}</style>
      <h1 style={heading}>Welcome aboard.</h1>
      <p style={sub}>Let&apos;s make your first thumbnail.</p>
      <div style={ctaRow}>
        <button
          type="button"
          style={primaryCTA}
          onClick={() => goToStep("starter")}
          data-testid="onboarding-start-fresh"
        >
          Start fresh
        </button>
        <button
          type="button"
          style={secondaryCTA}
          onClick={() => goToStep("upload")}
          data-testid="onboarding-have-image"
        >
          I have an image
        </button>
      </div>
      <button
        type="button"
        style={skipLink}
        onClick={skip}
        data-testid="onboarding-skip"
      >
        Skip tour
      </button>
    </div>
  );
}

// Day 52 — animated entrance keyframes (fade in from below + scale up).
const keyframes = `
@keyframes onboard-welcome-in {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-testid="onboarding-step-welcome"] {
    animation: none !important;
  }
}
`;

const card: CSSProperties = {
  position: "relative",
  width: "min(560px, 92vw)",
  padding: "48px 40px 56px",
  background: "var(--bg-space-1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 16,
  boxShadow: "0 16px 60px rgba(0, 0, 0, 0.4)",
  animation: "onboard-welcome-in 320ms cubic-bezier(0.22, 0.85, 0.34, 1) both",
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 40,
  // Day 52 — Spec asked for Fraunces; not in our 25-OFL bundle.
  // Playfair Display is the closest editorial serif we ship today
  // (it's already loaded by the FontPicker). Same brand register.
  fontFamily: '"Playfair Display", "Iowan Old Style", Georgia, serif',
  color: "var(--accent-cream)",
  fontWeight: 500,
  letterSpacing: "-0.01em",
};

const sub: CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "var(--text-secondary)",
};

const ctaRow: CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 12,
};

const primaryCTA: CSSProperties = {
  padding: "10px 22px",
  fontSize: 14,
  fontWeight: 600,
  background: "var(--accent-orange)",
  color: "var(--bg-space-0)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const secondaryCTA: CSSProperties = {
  padding: "10px 22px",
  fontSize: 14,
  background: "transparent",
  color: "var(--accent-cream)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 8,
  cursor: "pointer",
};

const skipLink: CSSProperties = {
  position: "absolute",
  right: 16,
  bottom: 12,
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: "0.04em",
};
