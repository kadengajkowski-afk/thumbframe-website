import type { CSSProperties } from "react";
import { useOnboardingStore } from "@/state/onboardingStore";
import { useUiStore } from "@/state/uiStore";
import { usePartnerStore } from "@/state/partnerStore";
import { getCrew } from "@/lib/crew";

/** Day 51 — Step D scaffold. Meet ThumbFriend (the wow moment).
 *
 * Day 52 layers in:
 *   - ThumbFriend panel slides in from the right with crew avatar
 *     materializing
 *   - "Yes, let's build" pre-fills Partner mode with the user's
 *     starter context (selected starter id + dominant color from
 *     Step C if applicable) and opens the panel on the Partner tab
 *   - Voice flavored to active crew (default Captain). The greeting
 *     copy below uses Captain's register only — Day 52 swaps in
 *     per-crew greetings.
 *   - Tour hand-off: "Show me everything" → tour mode (Step E)
 *
 * Today: three CTAs land but don't actually fire Partner mode or
 * the tour — they just transition state. Day 52 wires the side
 * effects. */
export function StepThumbFriend() {
  const finishTourOrComplete = useOnboardingStore((s) => s.goToStep);
  const startTour = useOnboardingStore((s) => s.startTour);
  const skip = useOnboardingStore((s) => s.skipFromCurrent);
  const selectedStarter = useOnboardingStore((s) => s.selectedStarter);
  const dominantColor = useOnboardingStore((s) => s.pickedDominantColor);
  const activeCrewId = useUiStore((s) => s.activeCrewMember);
  const crew = getCrew(activeCrewId);

  function startBuild() {
    // Day 52 — open ThumbFriend panel, force the Partner tab, and
    // queue an initial message that gives the AI useful onboarding
    // context (selected starter or uploaded image's dominant color).
    // PartnerMode reads `pendingInitialMessage` on mount and fires
    // partner.send(text); the panel's tab effect snaps to "partner"
    // because we set thumbfriendInitialTab here.
    const ui = useUiStore.getState();
    ui.setThumbfriendPanelOpen(true);
    ui.setThumbfriendInitialTab("partner");
    const message = buildInitialMessage(selectedStarter, dominantColor);
    usePartnerStore.getState().setPendingInitialMessage(message);
    finishTourOrComplete("complete");
  }

  function exploreSolo() {
    finishTourOrComplete("complete");
  }

  return (
    <div style={card} data-testid="onboarding-step-thumbfriend">
      <div style={greeting}>
        <span style={crewLabel}>{crew.name}</span>
        <p style={greetingText}>{greetingFor(crew.id)}</p>
      </div>
      <div style={ctaCol}>
        <button
          type="button"
          style={primaryCTA}
          onClick={startBuild}
          data-testid="onboarding-thumbfriend-build"
        >
          Yes, let&apos;s build
        </button>
        <button
          type="button"
          style={secondaryCTA}
          onClick={startTour}
          data-testid="onboarding-thumbfriend-tour"
        >
          Show me everything
        </button>
        <button
          type="button"
          style={tertiaryCTA}
          onClick={exploreSolo}
          data-testid="onboarding-thumbfriend-explore"
        >
          I&apos;ll explore on my own
        </button>
      </div>
      <button
        type="button"
        style={skipLink}
        onClick={skip}
        data-testid="onboarding-skip"
      >
        Skip
      </button>
    </div>
  );
}

/** Day 52 — per-crew greeting on the Step D card. Each greeting
 * matches the crew's voice register so the user gets a small dose
 * of personality before they pick a CTA. Captain blunt, Cook playful,
 * Doctor clinical, Navigator teaching, Lookout restrained, First
 * Mate adaptive. */
function greetingFor(id: string): string {
  switch (id) {
    case "captain":
      return "Welcome aboard. I see your canvas. Want me to help build this thumbnail with you?";
    case "first-mate":
      return "I'm here when you need a hand. Want me to help build this, or are you steering?";
    case "cook":
      return "What's cooking? I've got ideas — let me cook up some directions for this thumbnail.";
    case "navigator":
      return "Let me chart this with you. We'll start from hierarchy and work outward — sound good?";
    case "doctor":
      return "Canvas opens. Let me look it over. Want a quick triage, or building from here?";
    case "lookout":
      return "From up here, simpler reads better. Want me to help, or do less?";
    default:
      return "Welcome aboard. I see your canvas. Want me to help build this thumbnail with you?";
  }
}

/** Day 52 — build a context-rich first message for Partner mode.
 * The AI gets enough to react meaningfully: which starter the user
 * picked OR the dominant color of an uploaded image. */
function buildInitialMessage(
  starter: ReturnType<typeof useOnboardingStore.getState>["selectedStarter"],
  color: string | null,
): string {
  if (starter && starter !== "blank") {
    return `Help me build this thumbnail. I picked the ${starter} starter — what do you suggest first?`;
  }
  if (color) {
    return `Help me build this thumbnail. I uploaded an image; the dominant color is ${color} — what would you do with it?`;
  }
  return "Help me build this thumbnail.";
}

const card: CSSProperties = {
  position: "relative",
  width: "min(520px, 92vw)",
  padding: "40px 40px 56px",
  background: "var(--bg-space-1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 24,
  boxShadow: "0 16px 60px rgba(0, 0, 0, 0.4)",
};

const greeting: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const crewLabel: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--accent-orange)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

const greetingText: CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.4,
  color: "var(--accent-cream)",
};

const ctaCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const primaryCTA: CSSProperties = {
  padding: "12px 20px",
  fontSize: 14,
  fontWeight: 600,
  background: "var(--accent-orange)",
  color: "var(--bg-space-0)",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const secondaryCTA: CSSProperties = {
  padding: "12px 20px",
  fontSize: 14,
  background: "transparent",
  color: "var(--accent-cream)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 8,
  cursor: "pointer",
};

const tertiaryCTA: CSSProperties = {
  padding: "8px 12px",
  fontSize: 12,
  background: "transparent",
  color: "var(--text-secondary)",
  border: "none",
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
