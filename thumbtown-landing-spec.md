# Thumbtown — ThumbFrame Landing Page

> **Status:** Supersedes all prior landing page specs (v1, v2, v3 galaxy hub). The space cinematic direction is retired. Existing code stays in the repo under tag `v2-scroll-final` for salvage value but is not the build target.
>
> **Codename:** Thumbtown — the painted world that lives at `thumbframe.com`. Not a product rename. ThumbFrame is still the product; ThumbFriend is still the AI; Thumbtown is the landing page's world.
>
> **For Claude Code.** Repo: `C:/Users/marel/snapframe-website`. Read this end-to-end before touching anything. Audit first, refactor second. Most of the prior space cinematic code will be removed or mothballed — ask before deleting.

---

## 1. The One-Line Pitch

A living painterly landscape — mountain, coast, river, village, forest, floating islands — that the user can click around and eventually step through a Frame embedded in the mountain to enter the editor.

ThumbFrame's name finally has meaning: **every thumbnail starts with a frame.** The landing page is the frame.

---

## 2. Aesthetic Direction

**Reference:** *The Legend of Korra* — "Beginnings" episode (Wan's origin). Flat color shapes, ink brush outlines, decorative swirl patterns for clouds/water/wind, ukiyo-e composition, limited palette per scene, golden-hour warmth.

**NOT a copy of Avatar.** Thumbtown is its own world with its own geography, inhabitants, and palette. Inspired by that level of craft, not the specific aesthetic.

**Core visual rules:**
- Flat color shapes bounded by ink outlines (no rendered gradients on objects — lighting baked into the illustration)
- Decorative swirl patterns for all motion elements (clouds, waves, smoke)
- Warm golden-hour palette (amber, warm gray, soft pink, muted teal, deep forest green, ink black)
- Every element has a painterly brushstroke texture — it's a painted world
- Characters are tiny — scale emphasizes the vastness of the world
- No pure white or pure black

---

## 3. The Scene

One wide cinematic composition viewed all at once. Like a classical landscape painting or a game's title screen. No scroll required to see it. Roughly 16:9 or wider aspect on desktop, smart cropping on mobile.

### Layout (left to right)

**Left third — Enchanted Forest**
- Tall ancient twisted trees, dappled golden light through canopy
- Glowing moss on stones
- Small fungi, ferns, undergrowth
- 1-2 tiny gnome figures puttering around
- Dragonflies zigzagging between trunks
- Fireflies visible despite daylight (magical realism)
- Cool-shifted palette here (more teals/greens) — forest feels slightly separate from the warm center

**Center — River Valley + Painters' Village**
- River runs from forest toward the coast, meandering through center
- Village along the riverbanks: wooden houses, thatched roofs, colored cloth flags, lanterns
- 3-5 painters visible at work:
  - One on a cliff's edge at easel
  - One in a second-story window
  - One on a bridge sketching the river
  - One tending to drying canvases outside their house
  - One selling supplies at a small stand
- A shopkeeper, a cat on a rooftop, a townsperson crossing the bridge
- Warm village palette — amber lanterns, wood browns, cloth reds/blues

**Right third — Coast + Mountain + THE FRAME**
- Coastline with painterly waves meeting rocks
- Sand beach with small details — turtles, tide pools, seashells
- A fisherman on a rocky outcrop with a rod
- Massive mountain rising behind the coast, dominating the skyline
- Mountain has snow at peak, rocky face below
- Embedded in the mountain's center-face: **THE FRAME**
  - Ornate painted frame, clearly visible from anywhere in the scene
  - Glows softly with amber/orange light
  - Contents inside the frame: hint of editor UI "leaking out" — soft amber glow, faint suggestion of panels/buttons/canvas, like you can almost see through to the tool
  - Label below or above it reading `EDITOR` in painterly type
  - Always the visual focal point

**Sky (upper band of the scene)**
- Avatar-style swirling clouds — amber warm tones, pink tints, some violet shadow
- 3-4 floating islands at different heights and depths
  - Each island is a small patch of grass/rock with tiny waterfalls falling off edges into the void
  - Varying sizes
  - One of them is the **Pricing Island** — has a small sign or banner, painters' market stall, or similar "commercial" look that suggests you can buy something there
- Birds wheeling in formation across the sky (flocks of 5-7 small silhouettes)
- Distant birds further away as specks
- Sun warm, low in sky, casting golden light (not visible as disc — implied by color temperature)

**Foreground**
- Grassland, flowers, small path leading toward the village
- Detail elements that ground the view: a fence post, a sign, a rock, a butterfly
- Keeps the eye from falling off the bottom of the painting

### Composition rules
- The Frame in the mountain must be recognizable as the focal point on load — user's eye goes there first
- Nothing else in the scene competes with the Frame's visual weight
- Village and forest are active but subordinate to the main composition
- Floating islands add vertical interest but don't distract from center/right

---

## 4. Ambient Life

The world must feel alive on load. Continuous ambient motion happens without user input. Nothing scripted or repetitive-looking — staggered timings, random seeds.

**Always-on ambient animation:**
- **Clouds drift** slowly left-to-right across the sky, different speeds per layer
- **Floating islands bob gently** up-and-down with slight rotation, each with its own period
- **Birds fly** in small flocks across the sky on varied paths, occasionally land on rooftops
- **Waves on the coast** — painterly animation, subtle frame-by-frame loop
- **River flow** — subtle directional shimmer from forest toward ocean
- **Smoke rises** from village chimneys in slow swirls
- **Cloth flags flutter** on village buildings
- **Dragonflies** zip through the forest
- **Leaves fall** occasionally from forest trees
- **Light shafts** subtle golden rays coming down through forest canopy
- **Dust motes / fireflies** drift in forest light
- **Painters move** — tiny animation loops where painters gently brush at canvases
- **The Frame pulses** softly with its amber glow, contents shimmer faintly

**Rare ambient events (randomized timing, 30-90 second intervals):**
- A shooting star streaks across the sky (dawn-style, even in golden hour — looks magical)
- A larger flock of birds passes through on migration
- A distant mountain cloud releases painterly rain on one patch (subtle)
- A fish jumps in the river briefly

---

## 5. Clickable Easter Eggs

5 interactions. Not required for navigation — bonus delight.

### 1. Click a painter
- They look up from their canvas
- Wave at the camera
- Return to painting
- (~1.5s animation)

### 2. Click the fisherman's rod
- Line goes taut, rod bends
- Fisherman pulls back
- A painterly fish flops up on the end of the line
- Fish sparkles briefly
- Flops twice, then fisherman casts it back into water
- (~2.5s animation)

### 3. Click a forest gnome
- Gnome ducks behind a mushroom
- Peeks out after a beat
- Tips their hat/waves
- (~2s animation)

### 4. Click the Pricing Island (floating island above scene)
- Camera pans and rises toward the island
- Island grows as camera approaches
- Pricing cards materialize as painterly signs/scrolls on the island's surface
- User can read pricing, toggle monthly/annual, click CTAs
- "Return to world" button returns camera to main view

### 5. Click THE FRAME in the mountain (primary CTA)
- Full editor entry sequence
- Camera pushes forward toward mountain
- Frame grows to fill screen
- Painted world around frame begins warping/rippling
- Camera passes through the Frame
- Brilliant warm flash
- Screen fades into the editor interface
- (~3s total)

---

## 6. The Frame

The defining element of the page. Treat with care.

**Appearance (static):**
- Ornate painted frame, embedded into the mountain's face like an artifact
- Warm wooden or stone frame material with brass/gold accents
- Dimensions: feels monumental — roughly 1/4 the mountain's height
- Visible from anywhere in the scene at a glance

**The glow:**
- Soft amber/orange emanation from within the frame
- Slowly pulses in intensity (±15% brightness over 3-second cycle)
- Edges of the frame have a faint glow "bleed" onto the surrounding mountain rock

**Contents (what's visible inside the frame when static):**
- Hint of editor UI leaking out — abstract painterly shapes suggesting panels, canvas, tool palette
- Not a literal editor screenshot — more like a dream-glimpse of the editor
- Colors warm amber and paper-highlight cream
- Faint motion inside — shimmering, drawing the eye inward
- Feels like it's alive with the editor's essence

**Label:**
- Text reading `EDITOR` clearly visible on or near the frame
- Painterly type, not generic UI font
- Optional small sub-label: "Click to begin"

**Hover state:**
- Glow intensifies
- Cursor changes to pointer
- Frame gets a subtle scale-up (~1.03x)
- Optional: tiny particles drift out of the frame as if attracted to cursor

**Click sequence (~3 seconds):**
- Frame's glow intensifies rapidly
- Camera starts pushing forward
- Painted world around Frame begins to distort — brushstrokes bend toward Frame, parallax layers pull inward
- Frame grows until it fills ~80% of viewport
- Contents inside frame brighten to near-white
- Warm flash to full white (~0.3s)
- Editor interface fades in

**Technical note:** This is the only real 3D element in the scene. Everything else is 2D layered illustration. The Frame needs to be a 3D mesh so the warp/push-through effect has actual depth. Rest of the scene is parallax 2D.

---

## 7. Navigation

Standard web navigation overlaid on the scene. Users never feel lost.

### Top navigation bar
- Fixed at top of viewport, translucent (not fully opaque)
- Left: `THUMBFRAME` wordmark in painterly type
- Center or right: links — `Features` / `Pricing` / `Blog` (when ready) / `Login`
- Far right: primary CTA button `Open Editor →` (amber background)
- All links are normal web links — no puzzle UI
- On scroll (if there's scroll content below), nav background becomes more opaque

### Hero overlay (center-top or left-top)
- Small, unobtrusive
- Wordmark + tagline
- Primary CTA below
- Fades or gets out of the way once user scrolls or clicks anywhere in the scene
- **Example copy:**
  ```
  THUMBFRAME
  
  Every thumbnail
  starts with a frame.
  
  [ Start free → ]
  ```

### Mobile navigation
- Hamburger menu in top-left or top-right
- Menu opens to a painterly-styled list: Features, Pricing, Login, Open Editor
- No scene interactivity in mobile version — scene is static painted illustration
- All major entry points accessible from the menu

---

## 8. Below the Fold (Scroll Content)

The painted world is the hero. Below it, standard landing page content lives on normal scroll.

- **Features section** — 3-6 product features with illustrations and descriptions (can reuse painterly style, not 3D)
- **Pricing section** — Free and Pro cards (alternative to the floating island, for users who scroll instead of clicking island)
- **FAQ** — accordion-style common questions
- **Testimonials** — once available (not at launch)
- **Footer** — standard links, privacy, terms, contact, social

Scroll content is conventional — fast, readable, accessible. The painted world is the emotional hook; the scroll content is the decision support.

---

## 9. Mobile Version

Simplified but same aesthetic.

- **Scene is static painted illustration** — no easter eggs, minimal animation (just subtle cloud drift + Frame pulse)
- **Hamburger menu** for navigation
- **Clear CTAs** — `Open Editor` button prominent, `Start free` button also visible
- **Pricing in scroll** below, not on floating island
- **Frame still clickable** to enter editor but with simpler transition (fade vs. warp)
- **Page loads fast** — no heavy 3D, no big animation budget
- **Illustration still painterly** — it's a JPG/PNG with crisp edges at mobile scale

---

## 10. Tech Stack

### Keep from prior build
- React 19 + Vite 5
- Tailwind v4
- Framer Motion (animations, overlay transitions, easter egg micro-animations)
- Zustand (state — active modal, active island, etc.)
- Howler (audio — optional)
- Fraunces + Inter + JetBrains Mono typography

### Remove
- Three.js ecosystem (@react-three/fiber, @react-three/drei, maath)
  - **Exception:** keep a minimal Three.js setup ONLY for the Frame's 3D warp effect. Everything else is 2D.
- @theatre/* packages (unused anyway)
- Existing shader pipeline (Kuwahara, PaperGrain, Outline, ColorGrade, StructureTensor) — 2D assets already have painterly texture baked in, no post-process needed
- Existing scene components (Arrival, Wormhole, ProblemPlanet, etc.) — salvage content where useful, remove from build

### Add
- Layered parallax system using CSS transforms or `framer-motion` parallax
- Scene compositing — multiple PNG/SVG layers at different depths
- Mouse-driven parallax (subtle, ±1 unit max on overview)
- Click handlers with raycasting on SVG elements or hitboxes on PNG layers
- Simple physics for easter egg animations (Framer Motion can handle this)
- Fog-of-war state for progressive easter egg discovery (optional)

### New minimal 3D module
- A single `<FrameWarp />` React component containing:
  - A Three.js canvas sized to the Frame's position in the scene
  - The 3D Frame mesh
  - Click handler that triggers the warp transition
  - Shader or mesh distortion for the push-through effect
- Everything else avoids Three.js

---

## 11. Asset Pipeline

### Required painted assets (Kaden generates via Midjourney)

Consistent style across all. Use a master Midjourney "style reference" or Sref code to lock the aesthetic. Rough list (plan for ~20-30 individual PNGs):

**Background layers (back to front):**
1. Sky (gradient base — golden hour amber/pink/violet)
2. Sky detail (cloud layer 1 — distant, soft)
3. Sky detail (cloud layer 2 — closer, more defined swirls)
4. Mountain range (distant)
5. Main mountain with carved Frame niche (Frame rendered separately as 3D)
6. Floating islands layer 1 (distant)
7. Floating islands layer 2 (closer)
8. Coast with waves
9. Beach / sand / tide pools
10. River valley landscape
11. Village buildings (can be one composite PNG or broken into pieces)
12. Forest (left-side — trees, moss, undergrowth)
13. Foreground grass / flowers / path

**Character / creature assets:**
14. Painter 1 (at easel)
15. Painter 2 (in window)
16. Painter 3 (on bridge)
17. Fisherman with rod
18. Forest gnome(s)
19. Dragonflies / butterflies (sprite sheet)
20. Birds (sprite sheet — flying animation frames)
21. Turtles / beach creatures
22. Fish (for the rod easter egg — multiple poses)
23. Townspeople (a few background figures)

**UI elements in painterly style:**
24. The Frame (3D model — modeled in Blender or constructed from primitives, textured painterly)
25. Floating pricing island with banner/sign
26. Pricing scrolls / cards (painterly)
27. "Return to world" button asset
28. Nav bar background texture

**Ambient effect assets:**
29. Smoke puff sprites (for chimneys)
30. Light shafts (forest dappled light)
31. Shooting star trail
32. Warp distortion texture (for Frame click transition)

### Midjourney approach
- Use consistent style reference / Sref code for every generation
- Generate at 1024×1024 minimum (2048 preferred for key assets)
- Background-remove as needed (Photopea, remove.bg, or built-in tools)
- Name files clearly: `thumbtown-mountain.png`, `thumbtown-painter-1.png`, etc.
- Store under `public/assets/thumbtown/` with subfolders for backgrounds, characters, etc.

### Style prompt template
```
painterly landscape illustration, Legend of Korra "Wan" episode style, 
flat color ink outlined shapes, golden hour warm palette, ukiyo-e 
influence, traditional Chinese brush painting, decorative swirl clouds, 
hand-painted feel, muted warm tones, [SPECIFIC SUBJECT], no text, no 
characters unless specified, clean silhouette on transparent background,
--ar 16:9 --s 400
```

Adjust aspect ratio and subject per asset.

---

## 12. Build Order

Ship in phases. Stop and show after each phase. Don't batch.

### Phase 1 — Foundation & Cleanup
- Audit existing codebase
- Remove unused Three.js scene components (archive to `legacy/` folder, don't delete repo files)
- Keep painterly shader code for reference, move out of build path
- Set up new directory structure for Thumbtown scene
- Install missing deps, remove unused deps
- Verify dev server still runs clean

### Phase 2 — Static Composition
- User generates first batch of Midjourney assets (backgrounds, mountain, Frame placeholder)
- Claude Code builds scene compositor — layered PNGs at correct positions
- Scene renders as static painting on the page
- Nav bar + hero overlay on top
- Mobile version renders correctly (simplified)
- No interactions yet, no animation

### Phase 3 — Ambient Motion
- Add cloud drift, island bob, bird flocks, wave animation
- Add parallax on mouse movement
- Painterly swirl animations on ambient elements
- No interactions yet

### Phase 4 — Easter Eggs
- Add click handlers for each of the 5 interactions
- Build micro-animations for each
- Test on desktop

### Phase 5 — Pricing Island
- Build camera/view transition to the island
- Build pricing card overlay
- Monthly/annual toggle, accurate prices (Free $0/mo, Pro $15/mo or $12/mo annual)
- "Return to world" button

### Phase 6 — The Frame + Warp Transition
- Build 3D Frame component
- Glow + pulse animation
- Click → warp push-through transition
- Editor fade-in on arrival
- Ensure reverse transition works (back button or editor's logout)

### Phase 7 — Below-the-Fold Content
- Features section with painterly illustrations
- Pricing section (duplicate to island)
- FAQ
- Footer

### Phase 8 — Mobile Polish
- Simplified static scene
- Hamburger menu
- All entry points accessible
- Fast load

### Phase 9 — Performance + SEO
- Image optimization, lazy loading, proper caching
- Static HTML fallback for SEO (`/landing-static`)
- OG tags, structured data
- Lighthouse audit — target 90+ performance on desktop

### Phase 10 — Audio (optional)
- Ambient painterly soundtrack — wind, distant birds, river flow
- Howler, muted by default, sound toggle in nav
- Optional click sounds on easter eggs

### Phase 11 — Deploy
- Vercel preview
- Final review
- Production deploy

---

## 13. What's Preserved from v2 Work

Saved for possible future use, not in the current build path:

- **Problem Planet Midjourney texture** — beautiful, unused in landing. Save for potential /galaxy hub reference.
- **Pirate planet Midjourney texture** — same.
- **Painterly post-process pipeline** (Kuwahara, outline, grain, grade) — may be useful if we ever want a 3D section elsewhere.
- **Wormhole shader code** — could be repurposed if the Frame's warp effect wants something more dramatic.
- **Space station procedural geometry** — could be a detail in the /galaxy hub post-signup.
- **All v2 scene work** tagged at `v2-scroll-final` for safe salvage.

---

## 14. Success Criteria

The landing page ships when:
- First-time visitor understands this is ThumbFrame, a thumbnail editor, within 5 seconds
- The Frame is clickable, labeled, and the primary path to the editor
- All 5 easter eggs work on desktop
- Mobile version is clean, clear, and CTAs work
- Pricing is accurate and reachable (via island or scroll)
- Top nav works throughout
- Scene loads in under 3 seconds on average connection
- Lighthouse score 85+ on desktop, 70+ on mobile
- Painterly aesthetic is cohesive — no jarring mismatches between assets

---

## 15. Open Decisions

To resolve before or during Phase 2:

1. **Hero overlay placement** — top-center, top-left, or painted on a canvas in the scene itself (via a painter's easel)?
2. **Does the Frame show a live ThumbFrame UI preview or an abstract painterly hint of it?** Confirmed: abstract painterly hint that glows/leaks. Keep.
3. **Audio at launch or later?** Probably later — don't block launch on finding the right ambient track.
4. **Below-fold content — scroll-parallax or static?** Probably static, readable, no effects-heavy.
5. **Blog section or no?** Not at launch. Stub.

---

## 16. What This Is Not

Just to be explicit:

- Not a scroll cinematic
- Not a 3D galaxy with planets
- Not a space theme
- Not a clickable planet hub
- Not a wormhole-to-editor transition
- Not a complex shader-driven experience
- Not an AI-first product (ThumbFrame is a thumbnail editor with AI features, not the other way around)
- Not a rename — ThumbFrame is still the product, Thumbtown is this landing page's world

---

## 17. The Pitch in One Paragraph

Thumbtown is a living painted world where creators step through a frame to enter ThumbFrame. The landing page is a quiet painting you can click around — a village of painters working along a river, forest gnomes in golden light, a fisherman on the coast, floating islands in amber clouds, and a massive mountain with an ornate Frame carved into its face. Click the Frame, step through, and you're in the editor. Every thumbnail starts with a frame.
