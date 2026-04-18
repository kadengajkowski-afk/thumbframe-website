# ThumbFrame Landing Page v2 — Painterly Space Experience

> **Status:** This spec supersedes the previous flat 2D landing page spec. The v1 scaffolding (Navbar, Footer, UI primitives, Tailwind setup) stays. Everything else is rebuilt.
>
> **For Claude Code.** Repo: `C:/Users/marel/snapframe-website`. This is not a conventional landing page. It is a scroll-choreographed cinematic experience in a painted 3D galaxy. Read this spec end-to-end before writing any code. Execute scene by scene. Do not parallelize scenes. Do not skip iteration cycles.
>
> **Non-negotiable rule:** when in doubt about art direction, stop and ask Kaden. This entire project is about visual craft — guessing produces slop.

---

## 0. The Vision in One Paragraph

The user arrives at ThumbFrame and finds themselves in a painted galaxy — brushstrokes visible on every surface, nebulae that bleed like watercolor on cold-pressed paper, planets that look like Moebius or Syd Mead or a Ghibli background artist rendered them by hand. As they scroll, a camera on rails carries them cinematically between five planets, each one a scene that sells the product through visual narrative. The Editor Planet is the signature moment: it rotates as you scroll, and its surface opens to reveal the actual ThumbFrame editor built into the world. Pricing and FAQ live on a docking station floating between planets. Ambient sound accompanies the journey, muted by default, one-click to enable. Every pixel is intentional. Nothing is stock. Nothing is flat.

---

## 1. Art Direction

### 1.1 Style References

Claude Code: before writing code for any scene, internalize these references:

- **Moebius (Jean Giraud)** — bold line work, dreamlike space architecture, color fields that feel printed
- **Syd Mead** — industrial concept painter, Blade Runner, 2001 — surfaces lit with painterly confidence
- **Simon Stålenhag** — painterly realism, atmosphere heavy, melancholy tech
- **Makoto Shinkai nebulae** — saturated purples and oranges, deep stars, emotional skyboxes
- **NASA concept art (1970s-80s)** — Robert McCall, Don Davis — space painted with oil and brush, not rendered
- **Studio Ghibli backgrounds** — hand-painted skies, texture visible, no vector cleanliness
- **The painterly shader reference:** Maxime Heckel's Kuwahara filter work on painterly WebGL. That's the technical anchor. Anisotropic Kuwahara filters use smoothing that preserves edges while introducing brush-stroke-like artifacts, and are the state of the art for post-processed painterly WebGL.

### 1.2 Palette

The Observatory dark base **warms** in this direction. Not cold electric blue. Warm deep purples, inky navy, rust orange suns, muted teal atmospheres. Think Moebius and Shinkai, not Tron.

```css
--space-deep:      #0a0714;    /* deepest shadow, pure space */
--space-violet:    #1a1030;    /* primary atmosphere */
--space-indigo:    #2a1850;    /* lifted space */
--nebula-rose:     #4a2040;    /* warm nebula accents */
--nebula-amber:    #8a4020;    /* distant sun glow */
--orange-core:     #f97316;    /* ThumbFrame orange, for CTAs and key highlights */
--orange-wash:     #c86020;    /* painterly muted orange for surface tones */
--teal-mist:       #3a6660;    /* atmospheric teal, painterly */
--paper-highlight: #f0e4d0;    /* watercolor paper highlight, creamy white */
--ink-line:        #1a0820;    /* line work, text on light */
```

**Rule:** no pure white, no pure black. Even stars are warm off-white (`#f0e4d0`) or cool ice (`#d0d8f0`). Pure `#ffffff` breaks the painterly illusion instantly.

### 1.3 Type

- **Display:** A serif or warm geometric, not Geist. Candidates: **Fraunces Variable** (display serif with optical sizes), **Tusker Grotesk** (bold condensed display), **Migra** (editorial display). Default to **Fraunces** unless Kaden says otherwise — it carries weight and feels hand-set.
- **Body:** **Inter Variable** stays. It's neutral enough to not fight the art direction.
- **Numerals / tech captions:** **JetBrains Mono** for CTR scores, pricing numbers, anything that should feel "data."

Typography rules on the 3D overlay:
- H1 and H2 over scenes: Fraunces, weight 400-500 (not bold — lean into the editorial weight)
- All overlay text has a subtle drop shadow: `text-shadow: 0 2px 20px rgba(10, 7, 20, 0.8)` so it reads over any scene
- Letter spacing: H1 = `-0.02em`, body = normal
- Never use uppercase for body. Only for small eyebrow labels.

### 1.4 Texture

Every flat surface gets texture. No CSS gradient goes unmodulated.

- **Paper grain overlay:** subtle noise texture (~5% opacity) multiplied over everything HTML-layer. Makes the whole page feel printed.
- **Brush stroke particles:** on each planet, an additional layer of semi-transparent brush-stroke sprites in the shader, giving the feeling of visible strokes.
- **Color bleed on atmospheres:** atmospheres use noise-modulated radial gradients, not hard circles, so they bleed like wet ink.

---

## 2. Tech Stack

### 2.1 Additions to the existing stack

**Install:**

```bash
npm install three @react-three/fiber @react-three/drei maath @theatre/core @theatre/r3f @theatre/studio howler
npm install --save-dev @types/three
```

**Why each one:**

- `three` + `@react-three/fiber` — 3D engine and React renderer. The stack for painterly WebGL on the web.
- `@react-three/drei` — utilities: `ScrollControls`, `useScroll`, `Html`, `PerspectiveCamera`, `Environment`, `Stats`.
- `maath` — damping and easing for interruption-safe camera work. Use `easing.damp3()` for any state that might change mid-animation.
- `@theatre/core` + `@theatre/r3f` — scripted camera choreography with a timeline editor. Theatre.js integrates with React Three Fiber via @theatre/r3f and pairs with drei's ScrollControls to drive animation playheads from scroll position.
- `@theatre/studio` — dev-only visual editor. Load conditionally in development.
- `howler` — audio playback with autoplay-policy handling. Howler manages Chrome's autoplay policy by unlocking autoplay when the page loads after user interaction, and wraps the Web Audio API with HTML5 audio fallback.

### 2.2 Keep

- Vite 5, React 19, Tailwind v4, Framer Motion (for non-3D UI), lucide-react.

### 2.3 Do NOT add

- drei's `<Stars>` (it's ugly and overused). We build a custom painted starfield.
- Any pre-made planet asset packs. Everything is custom.
- GSAP. Theatre.js + maath covers all motion needs.
- Locomotive Scroll, Lenis. `ScrollControls` from drei handles scroll integration.

---

## 3. Architecture

### 3.1 High-level structure

```
src/landing/
  LandingPageV2.jsx            # Top-level route component
  Experience.jsx               # <Canvas> wrapper, scene graph
  scenes/
    Arrival.jsx                # Scene 1: space station + H1
    ProblemPlanet.jsx          # Scene 2: broken tools planet
    EditorPlanet.jsx           # Scene 3: SIGNATURE — spinning editor reveal
    DockingStation.jsx         # Pricing + FAQ zone
    ScorePlanet.jsx            # Scene 4: CTR scoring visualization
    Departure.jsx              # Scene 5: final CTA
  overlays/
    HeroCopy.jsx               # H1/H2/CTA pinned to Arrival scene
    ProblemCopy.jsx
    EditorCopy.jsx
    PricingPanel.jsx
    FAQPanel.jsx
    ScoreCopy.jsx
    DepartureCopy.jsx
    ScrollHint.jsx             # Subtle "scroll to explore" indicator
    AudioToggle.jsx            # Top-right mute/unmute
    StaticFallbackLink.jsx     # "Having trouble? View static version"
  shaders/
    painterly/
      kuwahara.glsl            # Anisotropic Kuwahara post-process
      paperGrain.glsl          # Multiplicative paper texture
      painterly.js             # ShaderMaterial wrapper + EffectComposer integration
    planets/
      problemPlanet.glsl       # Per-planet shader
      editorPlanet.glsl
      scorePlanet.glsl
      nebula.glsl              # Backdrop atmosphere
    particles/
      brushStroke.glsl
      stardust.glsl
  choreography/
    theatreProject.js          # Theatre.js project + sheet setup
    scrollSheet.js             # Bind scroll to sheet playhead
    keyframes.json             # Exported Theatre.js state (checked into repo)
  audio/
    AudioManager.js            # Howler wrapper
    assets/
      ambient-bed.mp3
      ambient-bed.webm
      transition-whoosh.mp3
      planet-arrival.mp3
      ui-click.mp3
  lib/
    useReducedMotion.js
    useIsLowEndDevice.js
  static/
    StaticFallback.jsx         # SEO + no-WebGL fallback page
  LandingPageV2.css            # Overlay-only styles, no scene styles
```

### 3.2 Render loop architecture

```
┌─────────────────────────────────────┐
│  LandingPageV2 (decides experience) │
└───────────────┬─────────────────────┘
                │
        ┌───────┴───────┐
        │               │
   full experience   static fallback
        │
┌───────▼────────────────────────────┐
│  Experience.jsx                    │
│  ┌──────────────────────────────┐  │
│  │  <Canvas>                    │  │
│  │    <ScrollControls pages=7>  │  │
│  │      <SheetProvider>         │  │
│  │        <SceneGraph />        │  │
│  │        <PainterlyPost />     │  │
│  │      </SheetProvider>        │  │
│  │    </ScrollControls>         │  │
│  │  </Canvas>                   │  │
│  │  <HTMLOverlays />            │  │
│  │  <AudioToggle />             │  │
│  │  <ScrollHint />              │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

Seven scroll pages maps to five scenes plus intro breathing room and docking station:

| Scroll page | Scene |
|---|---|
| 0.0 – 1.0 | Arrival (scene 1) |
| 1.0 – 2.2 | Problem Planet (scene 2) |
| 2.2 – 4.0 | Editor Planet (scene 3, signature) |
| 4.0 – 5.2 | Docking Station (pricing + FAQ) |
| 5.2 – 6.2 | Score Planet (scene 4) |
| 6.2 – 7.0 | Departure (scene 5) |

Scene boundaries are soft — transitions blend across ~0.2 pages of scroll. The camera never cuts; it always flies.

### 3.3 Scroll-to-animation binding

Using Theatre.js sheet with drei's `ScrollControls`:

```jsx
function Scene() {
  const sheet = useCurrentSheet();
  const scroll = useScroll();

  useFrame(() => {
    const sequenceLength = val(sheet.sequence.pointer.length);
    // Drive the Theatre.js playhead from scroll position
    sheet.sequence.position = scroll.offset * sequenceLength;
  });
  // ...
}
```

This means every keyframe in Theatre.js is tied to scroll position. No scroll-jacking, no smooth-scroll libraries, just deterministic mapping.

### 3.4 Painterly post-processing pipeline

The painterly look is NOT per-planet shader. It's a full-screen post-process that runs after normal scene rendering. This is critical — it's what makes everything look painted in one unified style.

Pipeline:
```
Scene render → Render target A
   ↓
Anisotropic Kuwahara pass → Render target B
   ↓
Paper grain multiply → Render target C
   ↓
Color grade (warm LUT) → Screen
```

The Kuwahara filter is the core of the look. Per the research: start with a basic sector-based Kuwahara kernel, then extend to the anisotropic version that aligns brush strokes with local edge direction.

Starter approach: port Maxime Heckel's implementation from his painterly shader writeup. Don't reinvent. Reference: https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/

Key uniforms for tuning:
- `uKernelSize` — 4-8. Higher = more painterly, less detail.
- `uSharpness` — 8-16. Controls the anisotropic weighting.
- `uPaperStrength` — 0.0-0.3. Paper grain blend.
- `uBrushScale` — 1.0-3.0. Brush stroke texture scale.

**Phase 2 of build:** get this shader working on a simple test scene (one sphere + one directional light) before touching any other scene. The shader is the entire aesthetic. Nothing else ships until it looks painted.

---

## 4. Scene Specifications

Each scene spec below contains: setting, camera choreography, geometry, shader notes, lighting, particles, overlay copy, overlay positioning, audio, and acceptance criteria.

### Scene 1 — Arrival (scroll 0.0 – 1.0)

**Setting:**
The user arrives inside a nebula. Deep violet-black space with warm rose-amber gaseous clouds billowing in the distance. A single small space station hangs in front of them, slowly rotating. It's a painted object — brushstroke edges, no panel-line detail. Visible ThumbFrame logo embossed on one face. Behind it and to the right, the first planet of the journey hangs as a distant silhouette (the Problem Planet, scene 2), giving a sense of "there's more out there."

**Camera choreography:**
- Scroll 0.0: camera is positioned deep in the nebula, facing the station, static. Faint drift (±1 degree rotation over 3 seconds, looped) makes it feel alive.
- Scroll 0.5: camera begins slow forward creep toward the station.
- Scroll 1.0: camera has pulled just past the station, now oriented toward the Problem Planet. Cross-fade transition engages.

**Geometry:**
- **Space station:** low-poly hand-modeled hull (200-400 tris). Kaden can hand-model in Blender or Claude Code can procedurally assemble from primitives. Must be asymmetric, not symmetric — painted things have asymmetry. Three antennae, one docking bay opening, one glowing window (animated emissive).
- **Station detailing:** one set of subtle animated elements — a slow-rotating radar dish, a blinking warm amber beacon.
- **Background planet silhouette:** simple sphere at distance, no shader detail, just a painterly silhouette color.

**Shader notes:**
- Station uses a custom `MeshStandardMaterial` with a **stepped toon ramp** (3 bands: shadow, midtone, highlight), painted in the warm palette. Orange emissive on window and beacon.
- No photorealistic reflections. Rim light as a shader effect.
- Post-process painterly pass makes brushstrokes read.

**Lighting:**
- Key light: warm amber directional from upper-right (the unseen sun). Intensity ~0.8.
- Fill: violet ambient, intensity 0.3.
- Rim: none as a proper light — faked in shader.

**Particles:**
- ~300 stardust motes drifting slowly across the frame. Billboard sprites with a hand-painted twinkle texture. Slight Y-axis drift + per-particle phase.
- Occasional (every 8-12s) faint "cosmic ray" streak — a thin painterly line fading in and out across the frame.

**Overlay copy:**
```
[Eyebrow, small, amber]
You are here.

[H1, Fraunces 56px desktop / 36px mobile, paper-highlight color]
Every thumbnail is a universe.
Most editors are the wrong map.

[Subhead, Inter 18px, teal-mist color]
ThumbFrame is the editor built for the one image that decides
whether anyone clicks play. AI generation. CTR scoring.
Painted with care.

[CTAs]
[ Start free — no credit card ]   [ See the galaxy ↓ ]
     (orange-core, warm glow)       (ghost, paper-highlight border)
```

**Overlay positioning:**
- Left half of viewport, vertically centered.
- Stays pinned to the Arrival scene — fades out as scroll passes 0.85.
- Fade uses opacity only. No transform tricks that would cause layout shift.

**Audio:**
- Ambient bed begins (low drone, warm harmonics, ~A minor pad).
- One soft "arrival" stinger on page load (muted by default — only plays after user clicks the audio toggle).

**Acceptance criteria:**
- [ ] Station renders with visibly painterly texture at 1440px width
- [ ] H1 is readable over scene at all breakpoints without DOM resize jank
- [ ] Camera drift does not cause nausea — max 1.5deg rotation, frequency <0.3 Hz
- [ ] Scene holds 60fps on M1 Mac / RTX 2060 desktop
- [ ] Scene holds 30fps on iPhone 13 / mid-tier Android
- [ ] H1 is present in static HTML (via SSG or fallback render) for SEO

---

### Scene 2 — Problem Planet (scroll 1.0 – 2.2)

**Setting:**
The camera approaches a dead planet. Painted gray-violet, cracked surface, no atmosphere. Broken tools drift around it in decaying orbit — a cracked Photoshop-looking icon, a leaning Canva-ish frame, a half-dissolved Photopea wireframe. These don't need to be trademark-accurate, they need to be *evocative* — a tool that looks like it belongs to the past, not branded copies.

**Camera choreography:**
- Scroll 1.0: camera enters frame from upper-left, wide shot of planet.
- Scroll 1.4: camera slowly arcs around planet, left to right, revealing a massive crack running across the surface.
- Scroll 1.8: camera zooms past planet, focusing momentarily on one of the drifting broken tools.
- Scroll 2.2: camera peels away toward Scene 3.

**Geometry:**
- **Planet:** icosahedron with displacement from a custom noise function, radius ~4 units.
- **Crack:** a deep displacement groove, carved by a masking noise in the vertex shader.
- **Drifting tools:** 3 low-poly "artifact" objects, hand-modeled or procedurally built. Each is rigged with a simple break/dissolve shader — they look fragmented.

**Shader notes:**
- Planet surface uses fBm noise (6 octaves) displaced on the vertex shader, colored with a desaturated palette map.
- Crack interior glows faintly dim amber (heat escaping).
- Tools use a fractured-material shader: the model's UVs are broken into Voronoi cells, each cell semi-transparent with slight displacement from the mesh surface.

**Lighting:**
- Harsh directional key from below (unusual — makes it feel ominous). Intensity 0.6.
- Cold violet fill, intensity 0.2.

**Particles:**
- Debris field drifting around the planet — 100-200 tiny flat painterly shards, slow rotation.

**Overlay copy:**
```
[Eyebrow, amber]
Chapter 1 — The dead planet

[H2, Fraunces 44px]
Every thumbnail tool was built for something else.

[Three stacked lines, Inter 16px, teal-mist]
Canva was built for everything. That's the problem.
Photoshop was built for magazines in 1988.
Photopea was built to imitate Photoshop in 2013. It shows.

[Tag line, orange-core]
ThumbFrame is built for exactly one thing.
```

**Overlay positioning:**
- Right half of viewport.
- Enters at scroll 1.1 (fade + 20px Y), exits at scroll 2.0.

**Audio:**
- Ambient bed shifts — a low dissonant note enters the pad. Subtle.
- One soft mechanical creak on scene arrival.

**Acceptance criteria:**
- [ ] Planet displacement is clearly visible, painterly, not procedural-generic
- [ ] Drifting tool objects don't read as branded clones (aesthetic evocation only)
- [ ] Camera arc feels smooth, not robotic
- [ ] Scene transitions from Scene 1 with no visible cut

---

### Scene 3 — Editor Planet (scroll 2.2 – 4.0) — SIGNATURE SCENE

**Setting:**
A vibrant planet slowly rotating. Warm palette, alive, rich. As the camera approaches and the user scrolls deeper, the planet rotates to reveal — embedded in its surface — an actual working ThumbFrame editor. Not a screenshot. A functioning UI rendered via `drei`'s `Html` with `transform` prop, mapped to the planet surface curvature. The user can watch the editor do its thing — a thumbnail is being composed in real-time via a canned "demo loop."

This is the moment people screenshot.

**Camera choreography:**
- Scroll 2.2: camera emerges from Scene 2, wide shot of planet from distance.
- Scroll 2.5: planet fills more of the frame. Camera begins orbital approach.
- Scroll 2.8: camera is close, planet is rotating. The "editor side" of the planet is still facing away.
- Scroll 3.1: planet rotates into view. The surface cracks open along a seam, revealing the editor UI embedded.
- Scroll 3.5: camera pushes into the editor UI. Editor fills ~60% of the viewport.
- Scroll 3.8: camera pulls back slightly, shows tool icons now orbiting the planet like satellites.
- Scroll 4.0: camera peels off toward Scene 4 docking station.

**Geometry:**
- **Planet:** icosphere, subdivision 5, radius 5 units. Surface has hand-painted continents (custom-generated heightmap or procedural).
- **Surface seam:** a great-circle line that "opens" between scroll 2.8 and 3.1. Implemented as a shader-level mask on the planet's surface that fades out a band revealing an inner surface.
- **Editor UI:** rendered via `drei`'s `<Html transform occlude>` component, mapped to a plane inside the planet seam. The plane is curved slightly to follow the planet surface (use a subdivided plane with vertex shader curvature).
- **Orbiting satellites:** 6 small hand-modeled tool icons (one per feature: scissors, target, dice, sparkles, face, grid). Each orbits the planet on a unique axis at unique speed. Paintedwith the same ramp shader.

**Shader notes:**
- Planet surface shader combines: base fBm noise, hand-painted continent mask (uploaded texture), cloud layer on a second slightly-larger sphere with independent rotation, atmosphere glow via Fresnel on a third sphere.
- Seam opening: when `uSeamProgress` uniform goes 0 → 1, a Voronoi-noise-modulated band of surface fades to transparent, revealing the layer beneath (the editor). The transition feels organic, not CNC-cut.

**The embedded editor:**
- Render a simplified ThumbFrame editor UI as a React component inside `<Html>`.
- Canned demo loop: every 6 seconds, the UI shows: blank canvas → photo drops → BG removes → text appears → CTR score pops up (43 → 71 → 87 with color shifts). Loops silently.
- The UI is interactive in a limited way: cursor can hover over it and tooltips appear, but clicks only go to the CTA (one big "Try ThumbFrame →" button overlaid on the UI after the CTR score appears).

**Lighting:**
- Warm key light (amber), intensity 1.0.
- Violet fill, intensity 0.4.
- A subtle rim light (painted via shader) in teal.

**Particles:**
- Dense stardust in the area around this planet.
- Brush-stroke particles near the surface suggest atmosphere shimmer.

**Overlay copy:**

Two copy blocks, one before the reveal and one after:

**Pre-reveal (scroll 2.3 – 2.9):**
```
[Eyebrow, amber]
Chapter 2 — The living world

[H2, Fraunces 48px]
This is what a thumbnail editor
was supposed to be.
```

**Post-reveal (scroll 3.2 – 3.9):**
```
[Eyebrow, amber]
Six features no one else ships.

[Six feature tags, laid out around the planet as floating labels, 
 each adjacent to its orbiting satellite:]

🔪 Free AI Background Remover
🎯 CTR Score
🎲 A/B Variants
✨ AI Generate
😀 Face Cutout + Outline
📐 Niche Templates

[Final tag, centered below planet:]
[ Try ThumbFrame free → ]
```

The feature tags are `drei` `<Html>` components anchored to each orbiting satellite. They fade in as the scroll passes 3.2 and stay visible through 3.9.

**Audio:**
- Ambient bed warms — the dissonance from Scene 2 resolves into a gentle major harmony.
- Soft "reveal" stinger when the planet seam opens (scroll ~3.0).

**Acceptance criteria:**
- [ ] Embedded editor is legible and recognizable as ThumbFrame
- [ ] Seam opening feels organic, not mechanical
- [ ] Orbiting satellites don't collide visually with overlay text
- [ ] Scene holds 45fps minimum on mid-tier hardware (this is the heaviest scene)
- [ ] Demo loop inside editor does NOT make network requests or affect performance

---

### Scene 4 — Docking Station (scroll 4.0 – 5.2)

**Setting:**
Camera arrives at a floating space station — larger than the Scene 1 station, this is the "commerce hub." Multi-module structure: one module is the pricing dock, another is the FAQ dock. Gentle internal lighting, warm. Ringed by slow-orbiting debris that catches light.

**Camera choreography:**
- Scroll 4.0: camera approaches station in wide shot.
- Scroll 4.3: camera docks — comes to a soft stop about 20 units out. Faint drift only.
- Scroll 4.3 – 5.2: camera remains mostly stationary, with subtle micro-motion. This is the reading scene — users need stability to read pricing.

**Geometry:**
- Station: three modular cylinders connected by tubes. Custom hand-built.
- One module glows amber (pricing), one glows teal (FAQ), one is neutral violet (future/roadmap teaser).

**Overlay copy and positioning:**

This is the one scene where the overlay dominates. The scene background is calmer so the content can breathe.

**Pricing panel** (appears first, scroll 4.2 – 4.8):

```
[Eyebrow]
Chapter 3 — Mission control

[H2, Fraunces 44px]
Simple pricing. Upgrade when you're ready.

[Monthly / Annual toggle, pill switch]

[Two cards side by side — see full pricing copy in §5 below]
```

**FAQ panel** (appears after, scroll 4.7 – 5.2):

```
[H2, Fraunces 44px]
Questions.

[Accordion with 5 items — see FAQ copy in §5]
```

The pricing and FAQ panels are layered as floating HTML panels over the 3D scene, inside glowing bordered containers that echo the docking station's module shapes.

**Audio:**
- Ambient bed shifts to a steadier mid-tone — less movement, more hold.
- Soft docking-clunk on arrival.

**Acceptance criteria:**
- [ ] Pricing card layout works at all breakpoints
- [ ] FAQ accordion is keyboard-accessible
- [ ] Background 3D scene is quiet enough to not fight text

---

### Scene 5 — Score Planet (scroll 5.2 – 6.2)

**Setting:**
A small, intense planet. Orange-hot core visible through a translucent outer shell. Numbers orbit it — CTR scores of successful thumbnails (87, 92, 78, 84 — painterly numerals in JetBrains Mono). A large central "87" counts up as the user scrolls past.

**Camera choreography:**
- Scroll 5.2: approach from docking station.
- Scroll 5.5: close orbital view, planet fills 40% of frame.
- Scroll 5.8: camera holds position, focus on the "87" counter.
- Scroll 6.2: depart toward final scene.

**Geometry:**
- Planet: small icosphere, radius 2. Translucent shell + inner glowing core.
- Orbiting numbers: 12-15 JetBrains Mono number labels, each on its own orbital plane.

**Shader notes:**
- Shell uses a Fresnel-based transparency shader — opaque at edges, transparent at center, revealing the hot core.
- Core is an emissive sphere with animated noise.

**Overlay copy:**
```
[Eyebrow, amber]
Chapter 4 — The science

[H2, Fraunces 44px]
Know the score before you upload.

[Subhead, Inter 18px, teal-mist]
ThumbFrame's CTR model scores every thumbnail against
millions of YouTube analytics data points. Ship the
winner, not the guess.

[Centered large number counting 0 → 87, JetBrains Mono 120px, orange-core]
87

[Caption below, teal-mist]
A real score from a real thumbnail. Get yours.

[ Start free → ]
```

**Audio:**
- Ambient bed rises in intensity.
- Soft "tick" sounds as the number counts up (one per increment of 10).

**Acceptance criteria:**
- [ ] Score counter animation feels intentional, not linear
- [ ] Translucent shell renders without z-fighting
- [ ] Number label orbits don't collide visually

---

### Scene 6 — Departure (scroll 6.2 – 7.0)

**Setting:**
Camera pulls back dramatically. All the planets from the journey are now visible in a single painted composition, like a renaissance map of the solar system. The rocket — a small painterly ship — sits center frame, pointing toward open space. The final CTA lives on the rocket itself.

**Camera choreography:**
- Scroll 6.2: camera pulls back from Score Planet.
- Scroll 6.5: all planets visible in a spread composition.
- Scroll 7.0: camera settles on wide shot, rocket centered, CTA visible.

**Geometry:**
- Each previous planet is reused at small scale, positioned in the composition.
- Rocket: custom hand-modeled painterly ship, pointed forward, exhaust trailing.

**Overlay copy:**
```
[Eyebrow, amber]
Your turn.

[H1, Fraunces 56px]
Stop second-guessing thumbnails.

[Subhead, Inter 18px]
Start free. Go Pro when you're ready for the science.

[ Start free — no credit card → ]
(large orange-core button with glow)

[Small caption]
Cancel anytime. Free tier forever. Built in California.
```

**Audio:**
- Ambient bed swells to full resolution — a warm major chord.
- Engine-rumble undertone on the rocket.

**Acceptance criteria:**
- [ ] All planet thumbnails render distinguishable from each other
- [ ] Final CTA button is impossible to miss

---

## 5. Overlay Content Reference

### 5.1 Pricing (from Scene 4)

**Free card:**
```
Free
$0 / month

For creators just getting started.

✓ 5 thumbnails per month
✓ Free background remover
✓ 10 starter templates
✓ 1280×720 export
✓ Community support

[ Start free → ]
```

**Pro card (elevated, orange border, soft glow):**
```
Pro
$15 / month   (or $12/mo billed annually — save 20%)

For creators who ship.

Everything in Free, plus:
✓ Unlimited thumbnails
✓ CTR scoring on every export
✓ A/B variant generator
✓ AI thumbnail generation
✓ All templates + niche packs
✓ Face cutout + auto-outline
✓ Priority AI processing
✓ No watermark
✓ Priority support

[ Go Pro → ]
```

Below cards: *Cancel anytime from your dashboard. Keep Pro access through your billing period.*

### 5.2 FAQ (from Scene 4)

1. **Can I cancel anytime?**
   Yes. One click in your dashboard. You keep Pro access through the end of your billing period.

2. **Does ThumbFrame work on mobile?**
   The editor is desktop-first. Mobile app is in beta for Pro users. Dashboard works on any device.

3. **Do I own my thumbnails and designs?**
   100%. Your designs are yours. We don't train on your private work without opt-in, and you can export and delete everything at any time.

4. **Is there a free trial of Pro?**
   The free tier is free forever. Upgrade when you want CTR scoring and A/B variants.

5. **Does it integrate with YouTube?**
   Export is optimized for YouTube (1280×720 JPEG under 2MB). Direct upload-to-YouTube arrives Q3 2026.

---

## 6. Audio Specification

### 6.1 Files needed

| File | Description | Length | Format |
|---|---|---|---|
| `ambient-bed.mp3/webm` | Looping drone with subtle harmonic shifts | 90s loop | ~200KB |
| `transition-whoosh.mp3` | Soft whoosh for scene transitions | 1.5s | ~15KB |
| `planet-arrival.mp3` | Soft chime on scene arrival | 1.0s | ~10KB |
| `seam-open.mp3` | Mechanical organic sound for editor planet seam | 2.0s | ~20KB |
| `ui-click.mp3` | Soft UI click | 0.2s | ~5KB |
| `score-tick.mp3` | Soft tick for score counter | 0.1s | ~3KB |
| `engine-rumble.mp3` | Low rumble loop for rocket scene | 4s loop | ~40KB |

**Kaden action:** source or commission these. Recommended sources:
- **Commission:** hire a sound designer on Fiverr/Upwork ($200-500 for the full set)
- **License:** Epidemic Sound, Artlist, or Soundly for ambient + stingers
- **Free tier:** freesound.org with CC0 licenses (lowest quality option, adequate fallback)

Do NOT ship with placeholder audio — an empty audio folder is better than bad audio.

### 6.2 Playback architecture

```js
// AudioManager.js
import { Howl, Howler } from 'howler';

class AudioManager {
  constructor() {
    this.muted = true; // Default muted per autoplay policy
    this.ambient = null;
    this.sfx = {};
  }

  init() {
    this.ambient = new Howl({
      src: ['/audio/ambient-bed.webm', '/audio/ambient-bed.mp3'],
      loop: true,
      volume: 0.0, // Fade in after unmute
    });
    // Preload sfx
    ['transition-whoosh', 'planet-arrival', 'seam-open', 'ui-click', 'score-tick']
      .forEach(name => {
        this.sfx[name] = new Howl({
          src: [`/audio/${name}.webm`, `/audio/${name}.mp3`],
          volume: 0.3,
        });
      });
  }

  unmute() {
    this.muted = false;
    this.ambient.play();
    this.ambient.fade(0.0, 0.4, 1500);
  }

  mute() {
    this.muted = true;
    this.ambient.fade(this.ambient.volume(), 0.0, 500);
    setTimeout(() => this.ambient.pause(), 600);
  }

  play(name) {
    if (!this.muted && this.sfx[name]) this.sfx[name].play();
  }
}

export const audioManager = new AudioManager();
```

### 6.3 Playback rules

- Default state: muted.
- On first click of audio toggle: init + unmute + fade in.
- Scene transitions trigger `transition-whoosh` only if not muted.
- Planet arrivals trigger `planet-arrival` at 40% of scene start (subtle).
- Seam open on Editor Planet triggers `seam-open`.
- Score Planet's counter triggers `score-tick` every 10-point increment.
- User toggling mute again fades ambient out, pauses.
- Visibility change (tab backgrounded): fade ambient to 0 but don't pause.

### 6.4 Audio toggle UI

Top-right corner, fixed. `position: fixed; top: 20px; right: 20px; z-index: 100`.

Small circular button, 40px diameter. Icon is a stylized speaker (lucide `Volume2` / `VolumeX`). Tooltip on first visit: "Sound off. Click for ambient experience."

```jsx
<button
  type="button"
  role="switch"
  aria-checked={!muted}
  aria-label={muted ? "Enable sound" : "Disable sound"}
  onClick={toggleMute}
>
  {muted ? <VolumeX /> : <Volume2 />}
</button>
```

---

## 7. Accessibility and Fallback

### 7.1 Reduced motion

If `prefers-reduced-motion: reduce`:
- Camera does not animate. It sits at a single keyframe per scene.
- Scroll still advances scenes, but with hard cuts instead of camera flights.
- Planet rotations continue (gentle) but at half speed.
- Particle systems reduce to 30% density.
- No audio stingers on scene transitions. Ambient bed remains opt-in.

### 7.2 Low-end device detection

```js
const isLowEnd =
  navigator.deviceMemory && navigator.deviceMemory < 4 ||
  navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4 ||
  /Android [4-8]/i.test(navigator.userAgent);
```

If low-end: route to static fallback.

### 7.3 Static fallback page

Separate component at `src/landing/static/StaticFallback.jsx`. Renders:
- Full SEO content (all H1/H2/copy present in HTML)
- Static painted illustrations of each planet (export stills from the 3D scenes as PNG/WebP)
- Standard landing page structure: hero, features, pricing, FAQ, CTA
- Observatory palette applied
- No 3D, no WebGL, no Theatre.js

This page is also linked from the main experience as "Having trouble? View the simpler version →" in the footer.

**Critical:** this static page is what Google indexes. The crawler sees all content here. The main experience is progressive enhancement on top.

### 7.4 Keyboard navigation

Even in the 3D experience:
- Tab/Shift-Tab cycles through: audio toggle → static fallback link → CTAs in scene order → footer links
- Enter/Space activates focused element
- Escape at any time: jump to static fallback
- Focus indicators: 2px orange-core outline with 4px offset, visible against any background

### 7.5 Screen readers

- The `<Canvas>` is `aria-hidden="true"`.
- All meaningful content is in HTML overlays with proper heading hierarchy.
- Each scene's overlay has `<section aria-labelledby="scene-N-heading">`.
- The experience is fully consumable via screen reader by sequentially reading overlays.

---

## 8. Performance

### 8.1 Targets (relaxed from v1)

Given the art direction, performance targets are adjusted:

| Metric | Target | Notes |
|---|---|---|
| Desktop FPS | 60 | On 2020+ hardware |
| Mobile FPS | 30 | iPhone 13 / mid-tier Android |
| LCP (main experience) | <3s | H1 is HTML overlay, renders fast |
| LCP (static fallback) | <1.8s | Traditional page |
| Initial JS (gzipped) | <500KB | 3D stack is large |
| Total asset weight | <3MB | Textures + audio + 3D |

### 8.2 Optimizations

- All planet textures at 1024×1024 max, compressed as KTX2/Basis.
- Shadow maps disabled globally — we fake shadows in shader.
- Antialiasing: MSAA 2x on desktop, FXAA on mobile.
- `frameloop="demand"` when user is idle for >5s — pauses rendering.
- Audio files loaded lazily after user unmutes.
- Theatre.js studio loaded only in dev.

### 8.3 Budget monitoring

Add `drei`'s `<Stats>` component in dev mode. Profile every scene with Chrome DevTools Performance panel before shipping.

---

## 9. SEO

Full SEO content lives on the static fallback page and is also output to the main page's HTML via pre-rendered meta.

### 9.1 Meta tags

```html
<title>ThumbFrame — Score every thumbnail before you upload</title>
<meta name="description" content="A painterly AI thumbnail editor built for YouTubers. Free background remover, CTR scoring, A/B variants. Start free.">
<meta property="og:title" content="ThumbFrame — An out-of-this-world thumbnail editor">
<meta property="og:description" content="Score every thumbnail before you upload. AI generation, CTR scoring, A/B variants. Free to start.">
<meta property="og:image" content="https://thumbframe.com/og-image.png">
<meta property="og:url" content="https://thumbframe.com">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://thumbframe.com">
```

### 9.2 OG image

The OG image should be a painterly still from Scene 3 (Editor Planet reveal). 1200×630, ~100KB WebP with PNG fallback.

### 9.3 Structured data

`SoftwareApplication` + `FAQPage` JSON-LD. Same as v1 spec.

### 9.4 Sitemap

`/` and `/landing-static` both listed.

---

## 10. Build Order

Execute phases strictly in order. Do not parallelize. Do not skip iteration.

### Phase A — Foundation (2-4 days)

1. Install new dependencies (three, R3F, drei, maath, theatre, howler).
2. Create `src/landing/Experience.jsx` with a minimal `<Canvas>` + `<ScrollControls pages={7}>` + Theatre.js `SheetProvider`.
3. Add one test sphere, a directional light, a perspective camera keyframed via Theatre.js.
4. Verify scroll drives camera movement.
5. Load `@theatre/studio` in dev, confirm timeline editor works.

Acceptance: scroll moves a camera around a sphere. No painterly effect yet. No scenes yet.

### Phase B — Painterly shader (3-5 days)

1. Implement Anisotropic Kuwahara post-processing pass following Maxime Heckel's writeup.
2. Add paper grain multiply pass.
3. Add warm color LUT.
4. Tune on the Phase A test scene until it looks genuinely painted.
5. Create a side-by-side comparison: raw render vs painterly. Show Kaden.

Acceptance: Kaden approves the painterly look. No further scene work until he signs off.

### Phase C — Scene 1, Arrival (4-6 days)

1. Model/assemble the space station.
2. Build the nebula backdrop (large sphere with procedural painterly shader).
3. Add stardust particles.
4. Keyframe camera in Theatre.js.
5. Layer HeroCopy overlay.
6. Iterate until scene looks like a painting come to life.

Acceptance: scroll from top down to 1.0 feels like the opening of a film.

### Phase D — Scene 3, Editor Planet (7-10 days) — SIGNATURE

Done out of order because this is the longest, hardest, most important scene.

1. Planet geometry + surface shader.
2. Seam opening animation (shader-level mask).
3. Embedded editor UI via drei `<Html>`.
4. Canned demo loop inside editor.
5. Orbiting satellite models + trajectories.
6. Feature-tag overlays anchored to satellites.
7. Extensive polish iteration.

Acceptance: the moment the seam opens and reveals the editor is genuinely breathtaking. Show Kaden. If he doesn't audibly react, it's not done.

### Phase E — Scene 2, Problem Planet (3-4 days)

1. Planet + crack displacement.
2. Broken tool artifacts.
3. Camera choreography.
4. Overlay copy.

### Phase F — Scene 4, Docking Station (3-5 days)

1. Station geometry.
2. Pricing panel as floating HTML layer.
3. FAQ accordion.
4. Monthly/annual toggle logic.

### Phase G — Scene 5, Score Planet (3-4 days)

1. Planet shell + core shaders.
2. Orbiting number labels.
3. Counter animation.
4. Overlay copy.

### Phase H — Scene 6, Departure (2-3 days)

1. Wide composition with all planets at scale.
2. Rocket model.
3. Final CTA.

### Phase I — Audio pass (2-3 days)

1. Source or commission audio files (Kaden owns this; Claude Code builds the playback).
2. Integrate `AudioManager`.
3. Wire stingers to scene transitions.
4. Test autoplay policy compliance.

### Phase J — Static fallback (2-3 days)

1. Export painterly still frames from each scene.
2. Build `StaticFallback.jsx` as a traditional landing page.
3. Route low-end devices and no-WebGL to fallback.
4. Ensure SEO content is identical.

### Phase K — Polish and performance (ongoing, 3-5 days)

1. Profile every scene.
2. Reduce texture sizes, optimize shaders.
3. Smooth over any scene boundary jank.
4. Accessibility audit.

### Phase L — Deploy (1 day)

1. Stage at `thumbframe.com/v2`.
2. 5-day soak period on real devices.
3. Swap to root.

**Total estimate:** 6-10 weeks of focused work. This is not a 2-week build. Kaden accepted this in the briefing.

---

## 11. Per-Scene Iteration Protocol

For every scene, iteration loop:

1. Build the geometric structure.
2. Add lighting.
3. Apply painterly post-process.
4. Review with Kaden. Screenshot + video walkthrough.
5. Kaden provides feedback in plain language ("too dim," "planet looks generic," "camera moves too fast").
6. Iterate.
7. Repeat until Kaden explicitly signs off on the scene.

**No scene progresses until the previous scene is signed off.** Parallel scene work creates integration nightmares and dilutes focus.

---

## 12. What Claude Code Must Ask Before Starting

Do not start Phase A until these are answered:

1. **Station model source:** will Kaden hand-model the station in Blender, or should Claude Code procedurally assemble from primitives? (Procedural is acceptable for v1.)
2. **Continent mask for Editor Planet:** Kaden generates a hand-painted heightmap/continent mask using ThumbFrame's own AI tools (meta, fitting), or procedural fBm only?
3. **Audio sourcing:** will Kaden commission, license, or source free? Claude Code needs to know if audio is expected day 1 or deferred.
4. **Embedded editor UI:** port the real editor into the scene (complex, heavy), or build a faithful static mockup that plays a canned loop (faster, safer)?
5. **Display font confirmation:** Fraunces, Tusker Grotesk, Migra, or something else?

---

## 13. What NOT to Do

- **Do not use drei's `<Stars>` component.** Build custom painted stardust.
- **Do not ship with photorealistic lighting.** Painterly means non-photoreal. If a render looks like Blender, it's wrong.
- **Do not add DOF, bloom, or chromatic aberration.** These scream "generic 3D website." The Kuwahara filter is the look.
- **Do not reuse the v1 flat sections.** The docking station replaces them. The landing page IS the experience.
- **Do not skip the static fallback.** It's how Google indexes the site. It's not optional.
- **Do not add cookie banners or third-party trackers.** Vercel Web Analytics only.
- **Do not autoplay audio.** Muted by default, one-click unmute, respect the user.
- **Do not inject ThumbFriend, Claude, or any AI chat onto the landing page.** Zero AI gimmicks in the experience itself.
- **Do not skip iteration.** If a scene is built fast, it was built wrong.

---

## 14. Final Word

This landing page is being built at a standard that most SaaS companies don't attempt. It will take 6-10 weeks and require obsessive iteration per scene. The quality bar is "someone screenshots and shares this because they've never seen a SaaS site do this before." Everything in this spec exists to serve that bar.

When in doubt: slow down, ask Kaden, iterate.
