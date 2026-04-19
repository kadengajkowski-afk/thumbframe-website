# Legacy — v3 Galaxy Hub

Code from the retired v3 click-to-travel galaxy landing page.

**Status.** Out of the build path. Nothing under this directory is imported
by the active landing. Preserved per `thumbtown-landing-spec.md` §13 for
possible future salvage.

**Snapshot.** The full working v3 state is tagged `v3-galaxy-hub-final`
on commit `26e04b9`. Recoverable via:

    git checkout v3-galaxy-hub-final

## Contents

```
_legacy_galaxy/
├── Experience.jsx                 R3F Canvas root for the galaxy
├── Galaxy.jsx                     Scene graph — 5 planets arranged in space
├── scenes/                        Planet meshes + wormhole scene
│   ├── Planet1SignalMesh.jsx      Space station + ship (Scene 1)
│   ├── Planet3SingularityIdle.jsx Event-horizon swirl disc
│   ├── Planet3SingularityReveal.jsx  Editor plane + 6 feature satellites
│   ├── Planet4DockingMesh.jsx     Procedural commerce station
│   ├── Planet5ScienceMesh.jsx     Placeholder hot-core planet
│   ├── ProblemPlanet.jsx          Texture-based dead planet + 3 artefacts
│   ├── GalaxyPlanet.jsx           Generic planet wrapper (hover/click)
│   ├── Wormhole.jsx               Full v2 tunnel + editor + halo stack
│   ├── WormholeTags.jsx           6 feature-icon polar trajectories
│   ├── WormholeDebris.jsx         11 decorative vortex objects
│   ├── SpaceStation.jsx           Ship toon-shader model
│   ├── EnginePlume.jsx            Ship engine flame
│   ├── Stardust.jsx               Ambient dust particles
│   └── Nebula.jsx                 BackSide starfield sky sphere
├── shaders/painterly/             Kuwahara / Outline / PaperGrain /
│                                  ColorGrade / StructureTensor pipeline
├── system/                        Camera controller, rocket, scroll tour,
│                                  keyboard nav, hash router, mouse parallax
├── overlays/                      Galaxy hero / planet content / hover label
├── state/galaxyStore.js           Zustand store — activePlanet, transition…
└── components/bg/StarField.jsx    Canvas-2D starfield (not R3F)
```

## Re-activating

To restore any component to the build path, `git mv` it back and re-wire
its imports. Stand-alone modules (MouseParallax, motion presets, Zustand
shape) are easiest to lift. Full scenes (Wormhole, ProblemPlanet) are
tightly coupled — check their imports.
