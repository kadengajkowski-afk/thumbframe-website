// Galaxy — v3.1 scene-graph root. Replaces v2's scroll-driven SceneGraph.
//
// Scope reduced to 3 planets: Signal / Singularity / Docking.
// ProblemPlanet (Dead) and Planet5ScienceMesh remain in the repo for a
// possible future return but are NOT mounted here — the CTR Score idea
// previously owned by Planet 5 now lives as a feature on Singularity.
//
// Each planet wraps in <GalaxyPlanet> for click/hover/raycasting; camera
// control is handled externally by <CameraController>.

import React from 'react';
import Nebula from './scenes/Nebula';
import GalaxyPlanet from './scenes/GalaxyPlanet';
import Planet1SignalMesh from './scenes/Planet1SignalMesh';
import Planet3SingularityIdle from './scenes/Planet3SingularityIdle';
import Planet3SingularityReveal from './scenes/Planet3SingularityReveal';
import Planet4DockingMesh from './scenes/Planet4DockingMesh';
import Stardust from './scenes/Stardust';
import { PLANET_POSITIONS } from './state/galaxyStore';

export default function Galaxy() {
  return (
    <>
      <Nebula radius={80} />
      <Stardust />

      <GalaxyPlanet id="signal" position={PLANET_POSITIONS.signal} radius={2.8}>
        <Planet1SignalMesh />
      </GalaxyPlanet>

      <GalaxyPlanet id="singularity" position={PLANET_POSITIONS.singularity} radius={3.2}>
        <Planet3SingularityIdle />
      </GalaxyPlanet>

      <GalaxyPlanet id="docking" position={PLANET_POSITIONS.docking} radius={2.2}>
        <Planet4DockingMesh />
      </GalaxyPlanet>

      {/* Active-state reveal: editor plane + 6 feature satellites visible
          only while the Singularity planet is entering / on-planet.
          Placed at world-space so it renders independently of the
          Singularity GalaxyPlanet wrapper's raycast proxy. */}
      <Planet3SingularityReveal />
    </>
  );
}
