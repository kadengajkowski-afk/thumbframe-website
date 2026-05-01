import type { CSSProperties } from "react";
import {
  STARTER_TEMPLATES,
  useOnboardingStore,
  type StarterTemplate,
} from "@/state/onboardingStore";

/** Day 51 — Step B scaffold. 4 starter cards in a 2×2 grid.
 *
 * Day 52 layers in:
 *   - Painterly preview thumbnails (placeholder boxes today)
 *   - Hover lift + glow
 *   - Click animation + transition out
 *   - Real template-load logic (background fill + 1-2 placeholder
 *     text layers per starter type — NOT full templates, those are
 *     v3.1)
 *
 * Today: cards select a starter id and advance to step D. The
 * preview boxes use design-token colors so the starter type is
 * visually distinct without real artwork. */
export function StepStarter() {
  const pickStarter = useOnboardingStore((s) => s.pickStarter);
  const goToStep = useOnboardingStore((s) => s.goToStep);
  const skip = useOnboardingStore((s) => s.skipFromCurrent);

  function pick(id: StarterTemplate["id"]) {
    pickStarter(id);
    // Day 52 — animate dismissal here, then transition.
    goToStep("thumbfriend");
  }

  return (
    <div style={card} data-testid="onboarding-step-starter">
      <h2 style={heading}>Pick your starting point</h2>
      <p style={sub}>Each starter is a basic structure — refine it as you go.</p>
      <div style={grid}>
        {STARTER_TEMPLATES.map((t) => (
          <StarterCard key={t.id} starter={t} onClick={() => pick(t.id)} />
        ))}
      </div>
      <div style={footerRow}>
        <button
          type="button"
          style={secondaryLink}
          onClick={() => goToStep("upload")}
          data-testid="onboarding-have-image-instead"
        >
          ← I have an image instead
        </button>
        <button
          type="button"
          style={skipBtn}
          onClick={skip}
          data-testid="onboarding-skip"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function StarterCard({
  starter,
  onClick,
}: {
  starter: StarterTemplate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={cardBox}
      onClick={onClick}
      data-testid={`onboarding-starter-${starter.id}`}
    >
      <div style={preview(starter.previewKind)} aria-hidden="true">
        {/* Day 52 — replace with painterly preview thumbnails. */}
      </div>
      <div style={cardLabel}>
        <span style={cardName}>{starter.name}</span>
        <span style={cardNiche}>{starter.niche}</span>
        <span style={cardTagline}>{starter.tagline}</span>
      </div>
    </button>
  );
}

// Day 51 — placeholder styling.
const card: CSSProperties = {
  position: "relative",
  width: "min(720px, 94vw)",
  padding: "36px 36px 56px",
  background: "var(--bg-space-1)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 20,
  boxShadow: "0 16px 60px rgba(0, 0, 0, 0.4)",
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "var(--accent-cream)",
  fontWeight: 500,
};

const sub: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--text-secondary)",
};

const grid: CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  marginTop: 6,
};

const cardBox: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 14,
  background: "var(--bg-space-0)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 12,
  cursor: "pointer",
  textAlign: "left",
  // Day 52 — add hover lift + glow.
};

const cardLabel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const cardName: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--accent-cream)",
};

const cardNiche: CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--accent-orange)",
  fontFamily: '"Geist Mono", ui-monospace, monospace',
};

const cardTagline: CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  marginTop: 2,
};

/** Day 51 — placeholder preview boxes. Different bg per niche so
 * cards are visually distinct without real artwork. Day 52 replaces
 * with painterly preview thumbnails. */
function preview(kind: "gaming" | "tutorial" | "vlog" | "blank"): CSSProperties {
  const base: CSSProperties = {
    aspectRatio: "16 / 9",
    width: "100%",
    borderRadius: 6,
    border: "1px solid var(--border-ghost)",
  };
  switch (kind) {
    case "gaming":
      return { ...base, background: "linear-gradient(135deg, #2a0040 0%, #f97316 100%)" };
    case "tutorial":
      return { ...base, background: "linear-gradient(180deg, #1a1f2e 0%, #2c3142 100%)" };
    case "vlog":
      return { ...base, background: "linear-gradient(135deg, #b87333 0%, #f9c089 100%)" };
    case "blank":
      return { ...base, background: "var(--bg-space-2)", borderStyle: "dashed" };
  }
}

const footerRow: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const secondaryLink: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: 12,
  cursor: "pointer",
};

const skipBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: "0.04em",
};
