// Galaxy — v3 scene-graph root. Replaces v2's scroll-driven SceneGraph.
//
// Mounts the 5 planets at their v3 §3 world positions, each wrapped in
// <GalaxyPlanet> for click/hover/raycasting. Camera control is handled
// externally by <CameraController> — this file stays pure-visual.
//
// The full wormhole scene (tunnel + tags + debris + editor plane) is NOT
// mounted here. It gets conditionally mounted by Planet3SingularityTransit
// during click-to-travel to the Singularity planet in Step 5.

import React from 'react';
import Nebula from './scenes/Nebula';
import GalaxyPlanet from './scenes/GalaxyPlanet';
import Planet1SignalMesh from './scenes/Planet1SignalMesh';
import ProblemPlanet from './scenes/ProblemPlanet';
import Planet3SingularityIdle from './scenes/Planet3SingularityIdle';
import Planet4DockingMesh from './scenes/Planet4DockingMesh';
import Planet5ScienceMesh from './scenes/Planet5ScienceMesh';
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

      <GalaxyPlanet id="dead" position={PLANET_POSITIONS.dead} radius={3.0}>
        {/* ProblemPlanet is a pure mesh package — planet body + 3 artefacts. */}
        <ProblemPlanet />
      </GalaxyPlanet>

      <GalaxyPlanet id="singularity" position={PLANET_POSITIONS.singularity} radius={2.2}>
        <Planet3SingularityIdle />
      </GalaxyPlanet>

      <GalaxyPlanet id="docking" position={PLANET_POSITIONS.docking} radius={1.8}>
        <Planet4DockingMesh />
      </GalaxyPlanet>

      <GalaxyPlanet id="science" position={PLANET_POSITIONS.science} radius={1.5}>
        <Planet5ScienceMesh />
      </GalaxyPlanet>
    </>
  );
}
