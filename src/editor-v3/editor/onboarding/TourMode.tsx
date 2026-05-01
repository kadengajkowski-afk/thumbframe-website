import type { CSSProperties } from "react";
import { useOnboardingStore } from "@/state/onboardingStore";

/** Day 51 — Tour mode scaffold. 5 stops walking through the editor
 * surfaces. Today this renders as a simple modal card — no real
 * positional tooltip overlay yet.
 *
 * Day 52 layers in:
 *   - Per-stop positional tooltip anchored to the actual editor
 *     surface element (toolbar / layer panel / context panel /
 *     thumbfriend / ship-it). Probably via a Portal + measured
 *     bounding rects.
 *   - Painterly tooltip styling (cream background, navy text,
 *     subtle drop shadow + arrow pointer).
 *   - Spotlight overlay that dims everything except the focused
 *     surface.
 *
 * Today: stop counter + Next/Skip buttons advance the state. The
 * spec says "5 stops"; the store's TOUR_STOPS const matches. */

const STOPS = [
  {
    title: "Your tools",
    body: "Tools live on the left. Select, draw rectangles, drop in text — the basics.",
    target: "toolbar",
  },
  {
    title: "Layers",
    body: "Every layer is editable. Drag to reorder, double-click to rename, lock or hide as needed.",
    target: "layers",
  },
  {
    title: "Properties",
    body: "Fine-tune any layer here — color, font, blend mode, drop shadow.",
    target: "context",
  },
  {
    title: "ThumbFriend",
    body: "An AI crew that can critique, suggest, or build with you. Cmd+/ opens it.",
    target: "thumbfriend",
  },
  {
    title: "Ship it",
    body: "Export when ready. PNG or JPEG. 4K is Pro-only.",
    target: "shipit",
  },
] as const;

export function TourMode() {
  const tourStop = useOnboardingStore((s) => s.tourStop);
  const advance = useOnboardingStore((s) => s.advanceTour);
  const skip = useOnboardingStore((s) => s.skipFromCurrent);
  const finish = useOnboardingStore((s) => s.finishTour);

  // Defensive bounds check.
  const idx = Math.max(0, Math.min(tourStop, STOPS.length - 1));
  const stop = STOPS[idx]!;
  const isLast = idx === STOPS.length - 1;

  return (
    <div style={card} data-testid={`onboarding-tour-stop-${idx}`} data-stop-target={stop.target}>
      <span style={counter}>
        {idx + 1} / {STOPS.length}
      </span>
      <h3 style={heading}>{stop.title}</h3>
      <p style={body}>{stop.body}</p>
      <div style={ctaRow}>
        <button
          type="button"
          style={skipBtn}
          onClick={skip}
          data-testid="onboarding-tour-skip"
        >
          Skip tour
        </button>
        <button
          type="button"
          style={nextBtn}
          onClick={isLast ? finish : advance}
          data-testid="onboarding-tour-next"
        >
          {isLast ? "Start designing" : "Next"}
        </button>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  position: "relative",
  width: "min(420px, 92vw)",
  padding: "28px 28px 24px",
  background: "var(--accent-cream)",
  color: "var(--text-primary)",
  borderRadius: 14,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxShadow: "0 16px 60px rgba(0, 0, 0, 0.45)",
};

const counter: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#1B2430",
  opacity: 0.6,
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 600,
  color: "#1B2430",
};

const body: CSSProperties = {
  margin: "4px 0 14px",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#1B2430",
};

const ctaRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 8,
};

const skipBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#1B2430",
  opacity: 0.6,
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: "0.04em",
};

const nextBtn: CSSProperties = {
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  background: "#1B2430",
  color: "var(--accent-cream)",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
