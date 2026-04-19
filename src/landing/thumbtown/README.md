# Thumbtown

Painted-world landing page. See `/thumbtown-landing-spec.md` at repo root
for the full spec.

## Structure

```
thumbtown/
├── ThumbtownScene.jsx      Main scene compositor (populated in Phase 2)
├── layers/                 Background PNG layers — sky, mountain, forest, etc.
├── characters/             Painter, fisherman, gnome, birds, dragonflies
├── effects/                Cloud drift, wave loop, swirls, shooting stars
├── easter-eggs/            Click-triggered micro-animations
├── frame/                  The ONE 3D element — FrameWarp portal
└── pricing-island/         Floating island pricing view
```

## Phase status

- ✅ Phase 1 — scaffold + archive v3 galaxy code. **Current.**
- ⏳ Phase 2 — static composition. Awaiting first batch of Midjourney assets
  (see spec §11 asset list).
- ⏳ Phase 3 — ambient motion.
- ⏳ Phase 4 — easter eggs.
- ⏳ Phase 5 — pricing island.
- ⏳ Phase 6 — Frame warp transition.
- ⏳ Phase 7 — below-the-fold scroll content.
- ⏳ Phase 8 — mobile polish.

## Asset root

Midjourney output lives under `public/assets/thumbtown/` (created in
Phase 2 when first assets arrive).

## Salvage

The v3 galaxy hub code is preserved under `src/landing/_legacy_galaxy/`
and the commit tagged `v3-galaxy-hub-final`. Per spec §13 any of it
may be revisited later — shaders, wormhole, station geometry, procedural
meshes are all intact.
