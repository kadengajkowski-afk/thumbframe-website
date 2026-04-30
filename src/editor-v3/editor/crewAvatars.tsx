import type { CrewId } from "@/lib/crew";

/** Days 41-42 — geometric crew badges. Single-color cream stroke,
 * no fills. Renders at any size via the `size` prop. Real illustrated
 * avatars come Cycle 6; these placeholders just need to be RECOGNIZABLE.
 *
 * Captain     — hexagonal shield with ship-wheel spokes
 * First Mate  — rounded square with anchor
 * Cook        — circle with chef-hat silhouette
 * Navigator   — diamond with compass needle
 * Doctor      — circle with medical cross
 * Lookout     — triangle with eye */

type Props = { size?: number };

const STROKE = "var(--accent-cream, #F9F0E1)";
const SW = 1.4;

function svg(children: React.ReactNode, size = 32) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={STROKE} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {children}
    </svg>
  );
}

function Captain({ size = 32 }: Props) {
  return svg(<>
    {/* hexagonal shield */}
    <path d="M16 3 L27 9 L27 21 L16 29 L5 21 L5 9 Z" />
    {/* ship-wheel spokes */}
    <circle cx="16" cy="16" r="4.5" />
    <line x1="16" y1="11.5" x2="16" y2="20.5" />
    <line x1="11.5" y1="16" x2="20.5" y2="16" />
    <line x1="12.8" y1="12.8" x2="19.2" y2="19.2" />
    <line x1="19.2" y1="12.8" x2="12.8" y2="19.2" />
  </>, size);
}

function FirstMate({ size = 32 }: Props) {
  return svg(<>
    <rect x="4" y="4" width="24" height="24" rx="4" />
    {/* anchor: ring at top, stem, crossbar, hooks */}
    <circle cx="16" cy="9.5" r="1.6" />
    <line x1="16" y1="11" x2="16" y2="22.5" />
    <line x1="12.5" y1="14" x2="19.5" y2="14" />
    <path d="M10 20 Q10 24 16 24 Q22 24 22 20" />
  </>, size);
}

function Cook({ size = 32 }: Props) {
  return svg(<>
    <circle cx="16" cy="16" r="13" />
    {/* chef-hat silhouette: pleated top + band */}
    <path d="M9 17 Q9 11 12 11 Q12 8 16 8 Q20 8 20 11 Q23 11 23 17 Z" />
    <line x1="9" y1="17" x2="23" y2="17" />
    <line x1="11" y1="20" x2="21" y2="20" />
  </>, size);
}

function Navigator({ size = 32 }: Props) {
  return svg(<>
    {/* diamond outline */}
    <path d="M16 3 L29 16 L16 29 L3 16 Z" />
    {/* compass needle (north filled-ish) */}
    <path d="M16 9 L19 16 L16 23 L13 16 Z" />
    <circle cx="16" cy="16" r="1" fill={STROKE} stroke="none" />
  </>, size);
}

function Doctor({ size = 32 }: Props) {
  return svg(<>
    <circle cx="16" cy="16" r="13" />
    {/* medical cross */}
    <line x1="16" y1="9" x2="16" y2="23" />
    <line x1="9" y1="16" x2="23" y2="16" />
  </>, size);
}

function Lookout({ size = 32 }: Props) {
  return svg(<>
    {/* triangle */}
    <path d="M16 4 L29 27 L3 27 Z" />
    {/* eye inside */}
    <ellipse cx="16" cy="20" rx="5" ry="3" />
    <circle cx="16" cy="20" r="1.4" fill={STROKE} stroke="none" />
  </>, size);
}

const AVATARS: Record<CrewId, (p: Props) => React.JSX.Element> = {
  "captain":     Captain,
  "first-mate":  FirstMate,
  "cook":        Cook,
  "navigator":   Navigator,
  "doctor":      Doctor,
  "lookout":     Lookout,
};

export function CrewAvatar({ id, size = 32 }: { id: CrewId; size?: number }) {
  const Comp = AVATARS[id] ?? Captain;
  return <Comp size={size} />;
}
