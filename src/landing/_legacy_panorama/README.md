# Legacy — Panorama Hero

Code from the retired Midjourney-panorama landing page hero.

**Status.** Out of the build path. Nothing under this directory is imported
by the active landing. Preserved for possible future salvage of the
Ken Burns panorama approach.

**Snapshot.** The full working state is the commit tagged
`5c37420` (`feat(thumbtown): hybrid animated hero with CSS + offset-path +
visibility handling`). Recoverable via:

    git checkout 5c37420 -- src/landing/thumbtown/

## Contents

```
_legacy_panorama/
├── ThumbtownScene.jsx        Panorama <img> + Ken Burns + SceneOverlay
├── SceneOverlay.jsx          SVG cloud wisps + birds + sun-glow div
├── frameConstants.js         Doorway pixel coords measured against mountain-main.png
├── styles/
│   └── hero-animations.css   @keyframes for ken-burns, drift, fly, sun-breathe
└── (empty .gitkeep scaffolds) characters, easter-eggs, effects, frame,
                              layers, pricing-island
```

The panorama PNG itself is archived at
`public/assets/thumbtown/_unused/panorama.png`.

## Re-activating

`git mv` the files back to `src/landing/thumbtown/` and restore
`public/assets/thumbtown/panorama.png` from `_unused/`. Update
`LandingPageV2.jsx` imports — it currently loads the code-native scene.
