import type { CrewId } from "@/lib/crew";

/** Days 41-42 polish — filled + animated crew avatars.
 *
 * Each avatar is a self-contained SVG with subtle motion:
 *   Captain    — ship wheel rotates 360° every 8s.
 *   First Mate — anchor sways ±3° on a 4s ease-in-out loop.
 *   Cook       — three steam wisps rise and fade above the chef hat.
 *   Navigator  — compass needle rotates through cardinals on a 6s loop.
 *   Doctor     — soft scale pulse 1.0 → 1.05 → 1.0 every 2s.
 *   Lookout    — eye blinks every 5s.
 *
 * Filled cream by default; the `active` prop swaps the badge fill to
 * --accent-orange so the picker can highlight the selected member.
 * Animations use SMIL where rotation is enough (Captain, First Mate,
 * Navigator) and CSS keyframes for everything else (Cook steam,
 * Doctor pulse, Lookout blink). */

type Props = { size?: number; active?: boolean };

const PRIMARY_FILL = "var(--accent-cream, #F9F0E1)";
const ACTIVE_FILL = "var(--accent-orange, #F97316)";
const INK = "var(--bg-space-0, #0A0C14)";

function badgeFill(active: boolean | undefined) {
  return active ? ACTIVE_FILL : PRIMARY_FILL;
}

// ── Keyframes injected once at module level ─────────────────────────
// Inline `<style>` shipped via a marker check in the render path so
// reloads don't multiply the rule set. React mounts <style>{...}</style>
// declaratively and de-dupes by string content.
const KEYFRAMES = `
@keyframes tf-cook-steam { 0%{opacity:0;transform:translateY(0)} 25%{opacity:.85} 100%{opacity:0;transform:translateY(-7px)} }
.tf-steam-1 { animation: tf-cook-steam 3s 0.0s ease-out infinite; transform-origin: center; }
.tf-steam-2 { animation: tf-cook-steam 3s 1.0s ease-out infinite; transform-origin: center; }
.tf-steam-3 { animation: tf-cook-steam 3s 2.0s ease-out infinite; transform-origin: center; }
@keyframes tf-doc-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
.tf-doc-pulse { animation: tf-doc-pulse 2s ease-in-out infinite; transform-origin: 16px 16px; transform-box: fill-box; }
@keyframes tf-blink { 0%,90%,100%{transform:scaleY(0)} 93%,97%{transform:scaleY(1)} }
.tf-blink { animation: tf-blink 5s ease-in-out infinite; transform-origin: 16px 21px; transform-box: fill-box; }
`;

function svg(size: number, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {children}
    </svg>
  );
}

// ── Avatars ─────────────────────────────────────────────────────────

function Captain({ size = 32, active }: Props) {
  return svg(size, <>
    {/* hexagonal shield */}
    <path d="M16 2 L29 9 L29 23 L16 30 L3 23 L3 9 Z" fill={badgeFill(active)} />
    {/* rotating ship wheel */}
    <g>
      <animateTransform attributeName="transform" type="rotate"
        from="0 16 16" to="360 16 16" dur="8s" repeatCount="indefinite" />
      <circle cx="16" cy="16" r="6.5" fill={INK} />
      <circle cx="16" cy="16" r="1.4" fill={badgeFill(active)} />
      {/* spokes */}
      <line x1="16" y1="9.5" x2="16" y2="13" stroke={badgeFill(active)} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="19" x2="16" y2="22.5" stroke={badgeFill(active)} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9.5" y1="16" x2="13" y2="16" stroke={badgeFill(active)} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19" y1="16" x2="22.5" y2="16" stroke={badgeFill(active)} strokeWidth="1.5" strokeLinecap="round" />
      {/* outer rim handles */}
      <circle cx="16" cy="9" r="0.9" fill={badgeFill(active)} />
      <circle cx="16" cy="23" r="0.9" fill={badgeFill(active)} />
      <circle cx="9" cy="16" r="0.9" fill={badgeFill(active)} />
      <circle cx="23" cy="16" r="0.9" fill={badgeFill(active)} />
    </g>
  </>);
}

function FirstMate({ size = 32, active }: Props) {
  return svg(size, <>
    <rect x="2" y="2" width="28" height="28" rx="5" fill={badgeFill(active)} />
    {/* swaying anchor */}
    <g>
      <animateTransform attributeName="transform" type="rotate"
        values="-3 16 16; 3 16 16; -3 16 16" dur="4s" repeatCount="indefinite" />
      <circle cx="16" cy="9" r="2" fill={INK} />
      <circle cx="16" cy="9" r="0.8" fill={badgeFill(active)} />
      <line x1="16" y1="11" x2="16" y2="22.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <line x1="11" y1="13.5" x2="21" y2="13.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M9 21 Q9 25 16 25 Q23 25 23 21"
        stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  </>);
}

function Cook({ size = 32, active }: Props) {
  return svg(size, <>
    <circle cx="16" cy="16" r="14" fill={badgeFill(active)} />
    {/* chef hat */}
    <path d="M9 19 Q9 11 12 11 Q12 7.5 16 7.5 Q20 7.5 20 11 Q23 11 23 19 Z" fill={INK} />
    <rect x="9" y="19" width="14" height="3" fill={badgeFill(active)} />
    <line x1="11" y1="22" x2="21" y2="22" stroke={INK} strokeWidth="1.5" />
    {/* steam wisps */}
    <g>
      <circle className="tf-steam-1" cx="12" cy="6" r="0.9" fill={INK} />
      <circle className="tf-steam-2" cx="16" cy="5" r="0.9" fill={INK} />
      <circle className="tf-steam-3" cx="20" cy="6" r="0.9" fill={INK} />
    </g>
  </>);
}

function Navigator({ size = 32, active }: Props) {
  return svg(size, <>
    <path d="M16 2 L30 16 L16 30 L2 16 Z" fill={badgeFill(active)} />
    <circle cx="16" cy="16" r="8" fill={INK} />
    {/* cardinal ticks */}
    <line x1="16" y1="9.5" x2="16" y2="11" stroke={badgeFill(active)} strokeWidth="1" />
    <line x1="16" y1="21" x2="16" y2="22.5" stroke={badgeFill(active)} strokeWidth="1" />
    <line x1="9.5" y1="16" x2="11" y2="16" stroke={badgeFill(active)} strokeWidth="1" />
    <line x1="21" y1="16" x2="22.5" y2="16" stroke={badgeFill(active)} strokeWidth="1" />
    {/* needle (rotating) */}
    <g>
      <animateTransform attributeName="transform" type="rotate"
        values="0 16 16; 90 16 16; 180 16 16; 220 16 16; 45 16 16; 0 16 16"
        dur="6s" repeatCount="indefinite" />
      <path d="M16 10.5 L18 16 L16 16 Z" fill={badgeFill(active)} />
      <path d="M16 21.5 L14 16 L16 16 Z" fill={INK} stroke={badgeFill(active)} strokeWidth="0.6" />
    </g>
    <circle cx="16" cy="16" r="1.2" fill={badgeFill(active)} />
  </>);
}

function Doctor({ size = 32, active }: Props) {
  return svg(size, <>
    <g className="tf-doc-pulse">
      <circle cx="16" cy="16" r="13" fill={badgeFill(active)} />
      <rect x="14" y="8" width="4" height="16" rx="1" fill={INK} />
      <rect x="8" y="14" width="16" height="4" rx="1" fill={INK} />
    </g>
  </>);
}

function Lookout({ size = 32, active }: Props) {
  return svg(size, <>
    <path d="M16 3 L29 27 L3 27 Z" fill={badgeFill(active)} />
    <ellipse cx="16" cy="21" rx="5" ry="3" fill={INK} />
    <circle cx="16" cy="21" r="1.6" fill={badgeFill(active)} />
    {/* blink-down lid */}
    <ellipse className="tf-blink" cx="16" cy="21" rx="5.2" ry="3.2" fill={badgeFill(active)} />
  </>);
}

const AVATARS: Record<CrewId, (p: Props) => React.JSX.Element> = {
  "captain":     Captain,
  "first-mate":  FirstMate,
  "cook":        Cook,
  "navigator":   Navigator,
  "doctor":      Doctor,
  "lookout":     Lookout,
};

/** Render a crew avatar at any size. Pass `active` to swap the badge
 * fill to --accent-orange (used in the picker dropdown for the
 * currently-selected crew member). */
export function CrewAvatar({ id, size = 32, active = false }: { id: CrewId; size?: number; active?: boolean }) {
  const Comp = AVATARS[id] ?? Captain;
  return (
    <>
      <Comp size={size} active={active} />
      <style>{KEYFRAMES}</style>
    </>
  );
}
