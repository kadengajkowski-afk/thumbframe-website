# ThumbFrame Landing — Hero Scene Rebuild

> **For Claude Code.** This is a targeted rebuild of the landing hero: purple nebula backdrop + detailed space station + tapered engine flame + painterly post-process. Scroll cinematics are OUT. Planet-to-planet navigation is OUT. Multi-page structure is IN, but this spec is ONLY for the `/` hero scene. Other pages come later.
>
> **Repo:** `C:/Users/marel/snapframe-website`
> **Route:** `/` only
>
> Previous attempts drifted from the look that worked. This spec is the original working version — build to this exact description.

---

## 0. Rules

- Build only the hero scene. No below-fold, no other routes, no overlay copy yet.
- No scroll choreography. No ScrollControls. No Theatre.js in this rebuild. Pure static hero with ambient motion.
- Use existing assets where they work. If an existing component matches the spec, reuse it. If it drifted, fix it.
- Stop after each sub-phase and show Kaden a screenshot.

---

## Phase 1 — Painterly Post-Process

Verify the painterly pipeline works on a test sphere.

### Requirements

Full-screen post-processing pipeline, applied via `@react-three/postprocessing` EffectComposer. Order:

1. **Render pass** — scene to render target
2. **Anisotropic Kuwahara** — kernel size 10-12, sharpness 14-18. This is the core painterly effect. Brush-stroke artifacts that follow local edge direction.
3. **Outline pass** — Sobel or depth-based edge detection. Dark violet-black lines (`#1a0820`), subtle strength (~0.4). Watercolor ink bleed level, not anime outline.
4. **Paper grain** — noise texture multiplied over output at ~20% strength. Makes the whole page feel printed.
5. **Color grade** — warm LUT, boost amber and violet, slight crush on blacks.

### Test

Render one icosphere with procedural color variation. Apply pipeline. Output should look genuinely painted — visible brush patches, paper texture, dark contour edges.

Stop and show.

---

## Phase 2 — Nebula Backdrop

### Requirements

Full-viewport painterly nebula. NOT drei's `<Stars>`, NOT a skybox cubemap. A custom shader on a large sphere surrounding the camera.

**Geometry:** Large inverted sphere, radius ~50, camera inside it.

**Fragment shader:**
- fBm noise, 5-6 octaves, sampled from 3D position (not UV — avoids seams)
- Two-tone gradient: core color `#2a1850` (deep violet), mid `#6a3880` (rose violet), highlight `#e8a8c0` (dusty rose), warm accent `#c86020` (amber pockets)
- Mix between tones using smoothed noise thresholds
- Subtle animated drift: `time * 0.01` offset on noise input

**Do NOT:**
- Use a pre-baked nebula texture
- Use particle systems for the nebula — it's a shader
- Make it a uniform purple haze — it needs visible cloud structure

### Lighting

- Ambient: `#2a1850` at 0.3 intensity
- Directional key: warm amber `#ffd890` from upper-right at 0.8 intensity
- No fill light — shadows are warm-to-cool contrast only

### Test

Render nebula with painterly pipeline on. Should look like a painted cosmic backdrop, not a gradient. Visible brush patches of violet, rose, and amber pockets. Warm directional light pickups on any surface in the scene.

Stop and show.

---

## Phase 3 — Space Station

Procedural assembly. NO Blender models. Pure Three.js primitives composed into a recognizable painterly space cruiser.

### Hull

- Primary hull: elongated box or stretched cylinder, ~4 units long, ~1.2 tall, ~1 wide
- Break hull into 3-4 visible panel sections with slight color variation:
  - Base color: cool grey-blue `#8090a0`
  - Panel variation: ±8% lightness, slight warm/cool shifts
  - Weathered rust staining near the engine end — warm umber overlay
- Lit surfaces (top, right-facing): warmer paper-highlight tint `#d4c8b0`
- Shadowed surfaces (bottom, left-facing): deeper violet-grey `#3a2d4a`

### Windows

- 6-8 small amber porthole windows along the hull length, varying intensity
- Emissive material, color `#ffb060`, intensity 0.6-1.2
- 2-3 windows should flicker subtly (someone moving past) — noise-modulated emissive
- One LARGE amber glowing window panel on the hull side, rectangular, more prominent

### Antennae

- 3 thin cylinders on top of hull, varying heights
- Dark metal base color with warm tip highlight
- Tips have tiny emissive amber dots (`#ffb060`, intensity 1.0)
- Slight asymmetric placement — not evenly spaced

### Beacon

- Small pulsing emissive sphere on top of the station
- Amber color, intensity animates 0.6 ↔ 1.2 at ~1Hz via sine wave on material intensity

### Nozzle

- Short dark-metal bell/cone at the rear of the hull
- Dark material `#2a2030`
- Bright emissive amber ring at the opening `#ffb060`, intensity 1.5
- This is where the engine flame emerges

### Radar dish (optional but recommended)

- Small dish or communications array on top, slowly rotating Y-axis
- Adds life to the model

### Position

- Ship placed at roughly `(2, 0, 0)` so it reads right-of-center in frame
- Y-axis rotation ±15° over ~8s (gentle rock)
- Vertical bob ±0.3 over ~4s
- Pitch ±3° over ~6s
- Three independent sine waves — not synchronized

### Test

Render ship alone on nebula backdrop with painterly pipeline on. Ship should read as architecture — panel lines visible, windows glowing, antennae thin and structural, beacon pulsing. Painterly filter should crisp the ship edges (kernel size 4-6 on ship regions) while keeping nebula soft (kernel 10-12).

If variable kernel per-object is too complex, use a single kernel of 8 as compromise. Do not skip the variable kernel attempt though — try it first.

Stop and show.

---

## Phase 4 — Engine Flame

The flame that emerges from the nozzle. This is where previous iterations struggled — follow this spec exactly.

### Outer cone

- CylinderGeometry with a pointed tip: base radius 0.4, tip radius 0.05, length 2.5 units
- 32 radial segments, 16 length segments
- Oriented pointing rearward from the nozzle
- Custom ShaderMaterial

**Vertex shader:**
- Displace each vertex outward along its normal using 3D simplex noise
- Noise input: `position * 2.0 + time * 4.0`
- Displacement amount: max at base (0.15 units), tapering to 0 at tip
- This creates the flickering turbulent silhouette

**Fragment shader:**
- Radial color ramp from axis to edge:
  - Center (distance 0.0): pure white-hot `#fff5e0`
  - Near center (0.2): bright amber `#ffd890`
  - Mid (0.5): orange `#f97316`
  - Outer (0.8): deep red `#c82020`
  - Edge (1.0): transparent
- Also fade along length: fully opaque at base, transparent at tip
- Add noise turbulence inside — sample noise, multiply brightness
- Additive blending (not normal blending)
- Depth write: false

### Inner core

- Second smaller cone inside the outer one
- Base radius 0.15, tip radius 0.02, length 1.8 units
- Pure bright emissive `#fff5e0`, intensity 2.0
- No displacement or very minimal
- Creates the "star inside the flame" look

### Sparks

- Separate particle system emitting from the nozzle
- 60 particles per second
- Each particle:
  - Initial position: nozzle opening with small random offset
  - Initial velocity: rearward + random radial spread within 20° cone
  - Size: 0.05-0.12 units, random per particle
  - Color animates warm amber (`#ffd890`) → dark red (`#c82020`) → transparent over 0.8-1.0s
  - Render as soft circle sprite with painterly texture
  - No gravity (space)
- Use a THREE.Points with BufferGeometry, not individual meshes

### Nozzle ring

- The amber emissive ring on the nozzle from Phase 3 should visibly glow brighter when flame is active
- Faint amber bloom around the ring only — not global bloom

### Test

Scene: nebula + ship + flame. Painterly pipeline on.

- Flame should have a clear hot-white core visible through amber outer layers
- Flame silhouette should flicker — not be a static cone
- Sparks should be visible as small fading points along and behind the flame
- No black blob at the nozzle — it should glow, not swallow light
- Overall: reads as "rocket exhaust firing" not "laser beam" or "cheese wheel" or "fire cloud"

Stop and show.

---

## Phase 5 — Stardust

Subtle ambient particles in the scene.

### Requirements

- 300-500 small points distributed in a large sphere around the scene (radius 30-50)
- Use THREE.Points with BufferGeometry
- Each point:
  - Size 0.03-0.08 random
  - Color: warm off-white `#f0e4d0` or cool ice `#d0d8f0`, randomly chosen
  - Base opacity 0.3-0.8 random
  - Twinkle: opacity oscillates ±0.2 with a per-point random phase offset
- No motion beyond twinkle — they're "far away stars"

### Test

Scene: nebula + ship + flame + stardust. Painterly pipeline on.

Stop and show.

---

## Phase 6 — Shooting Stars

Occasional streaks across the scene.

### Requirements

- Pool of 4-8 pre-allocated shooting-star objects (so we don't allocate in animation)
- Each shooting star: a thin painterly line geometry with gradient alpha (bright at head, fading to transparent at tail)
- Color: warm amber or pale blue, randomly chosen
- Motion: fast linear trajectory across a random arc through the scene
- Lifetime: ~400-700ms
- Trail length: ~4-6 units
- Spawn interval: random 6-18 seconds
- **Meteor shower moment:** every 60-120s, spawn 5-8 shooting stars in rapid succession (200-400ms apart) along similar trajectories
- Respect `prefers-reduced-motion`: if set, reduce frequency by 50% or disable

### Test

Scene complete. Watch for a full minute. Shooting stars should feel natural — not too frequent, not too rare. Meteor shower feels like a genuine event.

Stop and show.

---

## Phase 7 — Motion Tuning

Final pass on all ambient motion to make sure nothing feels synthetic.

### Ship motion

- Confirm Y-rotation ±15° over 8s, vertical bob ±0.3 over 4s, pitch ±3° over 6s
- All three sine waves should have different periods so the motion never repeats obviously
- Ship should feel like it's slowly swimming through space

### Nebula motion

- Confirm internal pattern drift at ~0.01 time multiplier
- Subtle pulsing: overall brightness oscillates ±5% over ~30s
- Brush patches should shift slowly — if motion is invisible it's too slow, if visible-frame-to-frame it's too fast

### Camera

- Static position for now, no scroll-driven movement
- Optional: ±0.5° camera drift over 10s for a "handheld" feel — only if it doesn't cause nausea

### Test

Watch the scene for 30 seconds. Motion should feel alive but not busy. Nothing should visibly "loop."

Stop and show.

---

## Phase 8 — Mount and Verify

### Wire up

- Ensure `/` route in `src/App.js` renders the LandingPage
- LandingPage renders the full-viewport scene (no overlay copy yet)
- Dev server runs clean, no console errors or WebGL warnings

### Performance check

- Target: 60fps desktop, 30fps mid-tier mobile
- Add `<Stats>` from drei in dev mode
- Report: FPS, draw calls, triangle count
- If under 45fps on desktop: lower Kuwahara kernel, reduce particle counts, profile in Chrome DevTools

### Screenshot

- Take 1440px-width screenshot
- Share with Kaden

---

## 9. What Good Looks Like

Reference composition:
- Full-viewport painterly nebula, warm violet/rose with amber pockets, visible brush structure
- Ship right-of-center, ~15-20% of viewport height, reads as detailed architecture
- Engine flame emerging cleanly, with a clear hot-white core and tapered amber trail
- Subtle sparks visible along the flame
- Stardust twinkling in the depth
- Occasional shooting stars
- Everything post-processed with visible brush strokes, paper grain, and subtle dark outlines
- Feels painted, not rendered

If it looks like CGI, the painterly filter isn't strong enough.
If it looks blurry, the outline pass is missing.
If the ship blends into the nebula, the ship needs lower Kuwahara kernel or higher contrast.
If the flame looks like a flat shape, the vertex displacement isn't running.
If there's a smiley face, three dots got misread — check noise sampling on the flame.

---

## 10. What This Is Not

- Not a scroll cinematic
- Not galaxy hub with clickable planets
- Not a 2D painted town
- Not a tour with camera choreography
- Not the entire landing page — this is just the hero

When the hero looks right, we stop and plan the rest separately.
