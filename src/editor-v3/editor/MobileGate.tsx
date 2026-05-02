import { useEffect, useState, type CSSProperties } from "react";

/** Day 54 — mobile gate for /editor.
 *
 * The PixiJS canvas + tool palette + right rail + bottom layer panel
 * all assume desktop input + viewport. On mobile (≤768px or coarse
 * pointer with touch-only) we short-circuit the editor mount and
 * show a "use a desktop browser" card with a sign-up + Discord CTA so
 * the visit isn't a dead end.
 *
 * We do NOT render the full editor + then hide it — gating before
 * mount avoids wasting GPU + bandwidth + accidental Pixi crashes on
 * mobile WebGL contexts.
 *
 * Detection logic mirrors v1's `useIsMobile`:
 *   - innerWidth <= 768, OR
 *   - matchMedia('(pointer: coarse)') AND no fine pointer.
 *
 * `?desktop=1` query string overrides the gate so QA can boot the
 * full editor on a tablet for layout testing.
 */

const MOBILE_BREAKPOINT = 768;

export function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() => detectMobile());
  useEffect(() => {
    function onResize() {
      setMobile(detectMobile());
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  // QA / dev escape hatch.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("desktop") === "1") return false;
  } catch {
    // Non-browser env / malformed URL — fall through.
  }
  if (window.innerWidth <= MOBILE_BREAKPOINT) return true;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const fine = window.matchMedia?.("(pointer: fine)").matches ?? false;
  return coarse && !fine;
}

export function MobileGate() {
  return (
    <div style={wrap} role="dialog" aria-label="Open ThumbFrame on a desktop">
      <div style={card}>
        <div style={iconWrap} aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <rect x="6" y="10" width="44" height="30" rx="2"
              fill="none" stroke="var(--accent-cream)" strokeWidth="2" />
            <rect x="22" y="42" width="12" height="2" fill="var(--accent-cream)" />
            <rect x="14" y="46" width="28" height="2" rx="1" fill="var(--accent-cream)" />
          </svg>
        </div>
        <h1 style={heading}>ThumbFrame is desktop-only for now</h1>
        <p style={body}>
          The editor uses a precise drag-and-drop canvas that hasn't
          come to mobile yet. Open this page on a laptop or desktop
          to ship your first thumbnail.
        </p>
        <div style={ctaRow}>
          <a href="/" style={primaryCta}>Back to homepage</a>
          <a
            href="https://discord.gg/thumbframe"
            target="_blank"
            rel="noopener noreferrer"
            style={secondaryCta}
          >
            Join Discord for updates
          </a>
        </div>
        <p style={hint}>
          Mobile editor is on the roadmap. Sign up at{" "}
          <a href="/" style={inlineLink}>thumbframe.com</a> to be
          notified when it ships.
        </p>
        <p style={tinyHint}>
          On a tablet and want to try anyway?{" "}
          <a href="?desktop=1" style={inlineLink}>Force desktop mode</a>.
        </p>
      </div>
    </div>
  );
}

const wrap: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background:
    "radial-gradient(900px 600px at 30% 20%, rgba(96, 56, 180, 0.28), transparent 70%), " +
    "radial-gradient(700px 500px at 70% 80%, rgba(208, 112, 64, 0.18), transparent 70%), " +
    "var(--bg-space-1)",
  color: "var(--text-primary)",
  zIndex: 1000,
};

const card: CSSProperties = {
  maxWidth: 420,
  width: "100%",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
  padding: "28px 22px",
  background: "var(--bg-space-2)",
  border: "1px solid var(--border-ghost)",
  borderRadius: 12,
};

const iconWrap: CSSProperties = {
  width: 56, height: 56,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: "0.01em",
  color: "var(--accent-cream)",
};

const body: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "var(--text-secondary)",
};

const ctaRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: "100%",
  marginTop: 6,
};

const primaryCta: CSSProperties = {
  background: "var(--accent-orange)",
  color: "var(--bg-space-0)",
  padding: "10px 16px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  letterSpacing: "0.02em",
};

const secondaryCta: CSSProperties = {
  background: "transparent",
  color: "var(--text-primary)",
  padding: "10px 16px",
  borderRadius: 6,
  border: "1px solid var(--border-ghost-hover)",
  fontSize: 13,
  textDecoration: "none",
};

const hint: CSSProperties = {
  margin: "10px 0 0",
  fontSize: 12,
  color: "var(--text-tertiary)",
};

const tinyHint: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "var(--text-tertiary)",
};

const inlineLink: CSSProperties = {
  color: "var(--accent-orange)",
  textDecoration: "none",
};
