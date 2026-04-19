// Galaxy state machine — v3 click-to-travel model.
//
// Planet ids are string literals so they can be used as object keys and URL
// hash slugs interchangeably. `null` means the user is on the galaxy
// overview (default state).
//
// Transition lifecycle:
//   idle  → user clicks planet → entering → (camera curve animates) →
//                                 on-planet → user clicks Return → exiting →
//                                 (camera curve reverses) → idle

import { create } from 'zustand';

// Scope v3.1: landing reduced to 3 planets — Signal / Singularity / Docking.
// Dead and Science removed from the galaxy layout (their scenes stay in
// the repo under ProblemPlanet.jsx / Planet5ScienceMesh.jsx but are no
// longer mounted). CTR scoring content moved into a Singularity feature.
export const PLANET_IDS = ['signal', 'singularity', 'docking'];

// World-space positions — 3-layer depth composition.
// Foreground planet reads large with rich detail, midground at medium
// scale and up-left, background far and lower-right. Creates real
// perspective parallax when mouse moves (see CameraController).
export const PLANET_POSITIONS = {
  signal:      [ 0, -1,  -4],   // FOREGROUND — close, large, centre-bottom
  docking:     [-7,  2, -10],   // MIDGROUND  — upper-left
  singularity: [ 9, -1, -18],   // BACKGROUND — far, lower-right
};

// Close-approach camera poses per planet. Planet fills ~50–70% of frame,
// right half kept clear for the content overlay.
export const PLANET_ORBIT_POSES = {
  signal:      { cam: [ 0, -0.6, -0.5], look: [ 0, -1,  -4] },
  docking:     { cam: [-7,  2.2, -5.5], look: [-7,  2, -10] },
  singularity: { cam: [ 9, -1,   -12], look: [ 9, -1, -18] },
};

// Galaxy-overview default camera pose.
export const OVERVIEW_POSE = {
  cam:  [0, 2, 22],
  look: [0, 0,  0],
};

// Transition durations (ms). Singularity is longer because it includes
// the full wormhole plunge; other planets are a straight catmull-rom curve.
export const TRANSITION_DURATIONS = {
  singularityEnter: 1400,   // 1.4s click-initiated tunnel
  singularityTour:  2000,   // 2.0s during scroll-tour mode
  defaultEnter:     1800,
  exit:             1200,
};

export const useGalaxyStore = create((set, get) => ({
  // ── state ───────────────────────────────────────────────────────────────
  activePlanet:         null,    // null | id string
  transitionState:      'idle',  // 'idle' | 'entering' | 'on-planet' | 'exiting'
  transitionProgress:   0,       // 0..1 inside the current entering/exiting phase
  transitionStartTime:  0,       // performance.now() when transition began
  transitionDuration:   0,       // ms for current transition
  fromPose:             OVERVIEW_POSE, // pose at transition start
  toPose:               OVERVIEW_POSE, // pose at transition end
  tourMode:             false,
  tourScrollOffset:     0,       // 0..1 scroll position while tour active
  audioEnabled:         false,
  hoveredPlanet:        null,

  // ── actions ─────────────────────────────────────────────────────────────

  goToPlanet: (id, opts = {}) => {
    const s = get();
    if (s.activePlanet === id && s.transitionState !== 'exiting') return;

    const fromPose = s.activePlanet === null
      ? OVERVIEW_POSE
      : PLANET_ORBIT_POSES[s.activePlanet] || OVERVIEW_POSE;
    const toPose = PLANET_ORBIT_POSES[id] || OVERVIEW_POSE;

    let duration = TRANSITION_DURATIONS.defaultEnter;
    if (id === 'singularity') {
      duration = s.tourMode
        ? TRANSITION_DURATIONS.singularityTour
        : TRANSITION_DURATIONS.singularityEnter;
    }
    if (opts.skipIntro) duration = 0;

    set({
      activePlanet:        id,
      transitionState:     duration === 0 ? 'on-planet' : 'entering',
      transitionProgress:  duration === 0 ? 1 : 0,
      transitionStartTime: performance.now(),
      transitionDuration:  duration,
      fromPose,
      toPose,
    });
  },

  returnToGalaxy: () => {
    const s = get();
    if (s.activePlanet === null) return;

    const fromPose = PLANET_ORBIT_POSES[s.activePlanet] || OVERVIEW_POSE;
    set({
      transitionState:     'exiting',
      transitionProgress:  0,
      transitionStartTime: performance.now(),
      transitionDuration:  TRANSITION_DURATIONS.exit,
      fromPose,
      toPose:              OVERVIEW_POSE,
      tourMode:            false,
    });
  },

  tickTransition: (nowMs) => {
    const s = get();
    if (s.transitionState !== 'entering' && s.transitionState !== 'exiting') return;

    const elapsed = nowMs - s.transitionStartTime;
    const t = Math.max(0, Math.min(1, elapsed / Math.max(1, s.transitionDuration)));
    set({ transitionProgress: t });

    if (t >= 1) {
      if (s.transitionState === 'entering') {
        set({ transitionState: 'on-planet' });
      } else {
        set({ transitionState: 'idle', activePlanet: null, fromPose: OVERVIEW_POSE, toPose: OVERVIEW_POSE });
      }
    }
  },

  setHovered: (id) => {
    if (get().hoveredPlanet !== id) set({ hoveredPlanet: id });
  },

  startTour: () => {
    set({ tourMode: true, tourScrollOffset: 0 });
    get().goToPlanet('signal');
  },

  setTourScrollOffset: (v) => {
    set({ tourScrollOffset: Math.max(0, Math.min(1, v)) });
  },

  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
}));
