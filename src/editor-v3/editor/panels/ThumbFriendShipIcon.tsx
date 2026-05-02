import type { CrewId } from "@/lib/crew";
import { CrewAvatar } from "../crewAvatars";

/** Day 53 — ThumbFriend dedicated toolbar icon.
 *
 * A small ship silhouette (hull + sail + flag) with the active crew
 * member's avatar peeking out at the helm. The whole icon bobs ±1.5px
 * on a 3s loop — gentle "ship at sea" motion that signals the panel
 * is alive without being distracting.
 *
 * When `active` (panel open) the bobbing pauses ("ship anchored") and
 * the hull tints --accent-orange. The crew avatar swaps based on the
 * active crew id — see crewAvatars.tsx for each member's SVG.
 *
 * Animation respects `prefers-reduced-motion` via a media-query rule
 * inside the same KEYFRAMES block.
 *
 * Implementation note: we wrap the avatar in a clipPath so it appears
 * to peek out of a porthole. The avatar SVG is ~12px so it reads even
 * at 24px container size.
 */

const KEYFRAMES = `
@keyframes tf-ship-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-1.5px); }
}
.tf-ship-bob { animation: tf-ship-bob 3s ease-in-out infinite; }
.tf-ship-bob--anchored { animation: none; transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .tf-ship-bob { animation: none; }
}
`;

type Props = {
  crewId: CrewId;
  active?: boolean;
  size?: number;
};

export function ThumbFriendShipIcon({ crewId, active = false, size = 22 }: Props) {
  const hull = active ? "var(--accent-orange)" : "currentColor";
  return (
    <span
      className={`tf-ship-bob${active ? " tf-ship-bob--anchored" : ""}`}
      style={{ display: "inline-flex", lineHeight: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <defs>
          {/* Porthole clip — circular window the crew peeks through. */}
          <clipPath id={`tf-porthole-${crewId}`}>
            <circle cx="12" cy="11" r="3.4" />
          </clipPath>
        </defs>
        {/* Sail — single triangle on a thin mast. */}
        <line x1="12" y1="2" x2="12" y2="9" stroke={hull} strokeWidth="1" strokeLinecap="round" />
        <path d="M 12 3 L 18 8.5 L 12 8.5 Z" fill={hull} fillOpacity="0.85" />
        {/* Hull — trapezoid base. */}
        <path d="M 4 16 L 20 16 L 17.5 20.5 L 6.5 20.5 Z" fill={hull} fillOpacity="0.72" />
        {/* Porthole ring (drawn over the hull edge). */}
        <circle cx="12" cy="11" r="3.6" fill="var(--bg-space-1)" stroke={hull} strokeWidth="0.7" />
        {/* Crew peek — clipped to the porthole. Avatar is rendered larger
            than the porthole so only the central face area shows. */}
        <g clipPath={`url(#tf-porthole-${crewId})`} transform="translate(7.5 6.5) scale(0.28)">
          <CrewAvatar id={crewId} size={32} active={active} />
        </g>
      </svg>
      <style>{KEYFRAMES}</style>
    </span>
  );
}
