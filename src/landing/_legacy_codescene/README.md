# Legacy — Code-Native Scene

Code from the retired landing page hero that drew the entire valley
landscape in code — Paper MeshGradient sky + hand-drawn SVG mountains,
river, trees, pagoda, sun disc, and ornate Frame.

**Status.** Out of the build path. Nothing under this directory is
imported by the active landing. Preserved for possible future salvage
of the code-native approach.

**Snapshot.** The full working state is the commit tagged
`6d68a40` (`refactor(thumbtown): valley perspective — sun, river, trees,
pagoda`). Recoverable via:

    git checkout 6d68a40 -- src/landing/thumbtown/

## Contents

```
_legacy_codescene/
├── ThumbtownScene.jsx        Composes SkyShader + MountainRange +
│                             SunDisc + River + Foreground + Frame
├── WorldHero.jsx             Hero copy overlay (top-left, Fraunces + Inter)
├── scene/
│   ├── SkyShader.jsx         Paper MeshGradient sunset sky + vertical band overlay
│   ├── MountainRange.jsx     3 depth tiers: far hazy, mid rose, near dark.
│   │                         Exports MOUNTAIN_DOORWAY coords for the Frame.
│   ├── SunDisc.jsx           Upper-right warm radial bloom + core
│   ├── River.jsx             Meandering static teal ribbon down the valley
│   ├── Foreground.jsx        Japanese kuromatsu pines + 3-tier pagoda +
│   │                         extended dark earth slope
│   └── Frame.jsx             Ornate SVG portal at MOUNTAIN_DOORWAY
└── styles/
    └── thumbtown.css         Frame pulse keyframes (reduced-motion gated)
```

## Dependencies

The code-native approach depended on `@paper-design/shaders-react` for
the animated sky. The dependency stays in `package.json` because
removing it would churn the lockfile — no imports in the active build
reference it.

## Re-activating

`git mv` the files back to `src/landing/thumbtown/` and update
`LandingPageV2.jsx` imports. Note that activating this scene re-enables
the WebGL shader, which has battery cost on mobile.
