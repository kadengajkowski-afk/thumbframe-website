/** Day 21 — preview surface registry. Specs for the 7 contexts a
 * thumbnail will appear in. Day 21 ships ONE live surface
 * (sidebar-up-next, the legibility stress test); the rest land
 * Days 22-26. Today's specs are the geometry contract — chrome
 * HTML lands per surface as it gets implemented. */

export type PreviewSection = "desktop" | "mobile" | "tv" | "lockscreen";

export type SurfaceSpec = {
  /** Stable id for the registry + uiStore preferences. */
  id: string;
  /** Human-readable label rendered as the card header. */
  label: string;
  section: PreviewSection;
  /** Mock dimensions. The thumbnail sits at (thumbX, thumbY) within
   * the mock; chrome elements (title, avatar, metadata) occupy the
   * remaining space. */
  chrome: {
    width: number;
    height: number;
    thumbX: number;
    thumbY: number;
    thumbW: number;
    thumbH: number;
  };
  /** Number of title lines the chrome reserves space for. */
  titleLines: number;
  /** Channel-avatar circle size in mock-px. 0 = surface has no avatar. */
  avatarSize: number;
  /** Where view-count / timestamp metadata sits relative to title. */
  metadataPosition: "below" | "right" | "overlay";
};

/** All seven surfaces shipping in Cycle 3, ordered by priority of
 * implementation. Fields below are best-known approximations of the
 * real YouTube chrome dimensions; tweak per-surface as the design
 * matures. */
export const SURFACES: SurfaceSpec[] = [
  // ── The hardest case — Day 21 ships this one live ────────────
  {
    id: "sidebar-up-next",
    label: "Sidebar — Up Next",
    section: "desktop",
    chrome: {
      width: 380, height: 96, // total card
      thumbX: 0, thumbY: 0,
      thumbW: 168, thumbH: 94, // 16:9-ish, the cramp test
    },
    titleLines: 2,
    avatarSize: 0,
    metadataPosition: "below",
  },

  // ── Mobile feed — Day 22 ──────────────────────────────────────
  {
    id: "mobile-feed",
    label: "Mobile feed (iPhone 15)",
    section: "mobile",
    chrome: {
      width: 393, height: 320,
      thumbX: 18, thumbY: 16,
      thumbW: 357, thumbH: 201,
    },
    titleLines: 3,
    avatarSize: 24,
    metadataPosition: "below",
  },

  // ── Desktop home grid — Day 23 ────────────────────────────────
  {
    id: "desktop-home",
    label: "Desktop home grid",
    section: "desktop",
    chrome: {
      width: 310, height: 280,
      thumbX: 0, thumbY: 0,
      thumbW: 310, thumbH: 174,
    },
    titleLines: 2,
    avatarSize: 36,
    metadataPosition: "below",
  },

  // ── Desktop search results — Day 23 ───────────────────────────
  {
    id: "desktop-search",
    label: "Desktop search results",
    section: "desktop",
    chrome: {
      width: 600, height: 220,
      thumbX: 0, thumbY: 0,
      thumbW: 360, thumbH: 202,
    },
    titleLines: 2,
    avatarSize: 24,
    metadataPosition: "right",
  },

  // ── Mobile Shorts shelf — Day 25 ──────────────────────────────
  {
    id: "shorts-shelf",
    label: "Mobile Shorts shelf",
    section: "mobile",
    chrome: {
      width: 200, height: 280,
      thumbX: 10, thumbY: 10,
      thumbW: 180, thumbH: 225,
    },
    titleLines: 2,
    avatarSize: 0,
    metadataPosition: "overlay",
  },

  // ── TV Leanback — Day 25 ──────────────────────────────────────
  {
    id: "tv-leanback",
    label: "TV — Leanback",
    section: "tv",
    chrome: {
      width: 660, height: 420,
      thumbX: 10, thumbY: 10,
      thumbW: 640, thumbH: 360,
    },
    titleLines: 2,
    avatarSize: 0,
    metadataPosition: "below",
  },

  // ── Lockscreen push — Day 26 ──────────────────────────────────
  {
    id: "lockscreen-push",
    label: "Lockscreen — push",
    section: "lockscreen",
    chrome: {
      width: 320, height: 110,
      thumbX: 220, thumbY: 11,
      thumbW: 88, thumbH: 88, // iOS center-crop square
    },
    titleLines: 2,
    avatarSize: 0,
    metadataPosition: "right",
  },
];

/** Return the surface specs grouped by section, in display order. */
export function groupBySection(): Array<{ section: PreviewSection; surfaces: SurfaceSpec[] }> {
  const order: PreviewSection[] = ["desktop", "mobile", "tv", "lockscreen"];
  return order.map((section) => ({
    section,
    surfaces: SURFACES.filter((s) => s.section === section),
  }));
}

/** Subset of surfaces that have a real preview implementation today.
 * The rest render as placeholder cards in the rack. As Days 22–26
 * land, ids get added here and the placeholder branch in PreviewRack
 * narrows toward zero. */
export const LIVE_SURFACES = new Set<string>(["sidebar-up-next"]);

/** Section title for the rack header. */
export const SECTION_LABEL: Record<PreviewSection, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tv: "TV",
  lockscreen: "Lockscreen",
};
