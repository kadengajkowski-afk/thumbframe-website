// LandingPage — the "/" route.
//
// Hero-rebuild spec (hero-rebuild-spec.md §0): scene-only during the
// rebuild, overlay copy held back for Phase 8.
//
// Current phase — full hero assembly: Nebula + Stardust + ShootingStars
// + SpaceStation (with EnginePlume as a child) routed through the
// painterly composer.

import React from 'react';
import LandingScene from '../scenes/LandingScene';

export default function LandingPage() {
  return <LandingScene />;
}
