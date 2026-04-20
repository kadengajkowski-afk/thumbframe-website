// LandingPage — the "/" route.
//
// Hero-rebuild spec (hero-rebuild-spec.md §0): "Build only the hero
// scene. No below-fold, no other routes, no overlay copy yet."
//
// During the rebuild we swap in the current phase's test scene. The
// full hero assembly is wired back up in Phase 8. Navbar + hero overlay
// live in the prior commit (a6b701c / 91fea9a) and will come back on
// top of the final composition, not now.
//
// Current phase — Phase 2: nebula backdrop through the painterly pipeline.

import React from 'react';
import NebulaTest from '../scenes/_tests/NebulaTest';

export default function LandingPage() {
  return <NebulaTest />;
}
