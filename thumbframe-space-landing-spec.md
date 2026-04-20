# ThumbFrame Landing — Multi-Page Space Theme

> **Status:** This is the final direction. All prior landing specs (v1, v2, v3 galaxy hub, Thumbtown) are retired. Kaden has committed — no more pivots.
>
> **Core idea:** Every page is a different painterly space scene — same universe, different nebula pocket, same art language. Conventional website navigation. No scroll cinematics, no click-to-travel, no galaxy hubs, no painted illustration. Procedural 3D + painterly shader does what it's good at: generates beautiful cosmic backdrops. Above those backdrops sits normal web UI.
>
> **Repo:** `C:/Users/marel/snapframe-website`
> **For Claude Code.** Read this end-to-end before any refactor. Salvage aggressively — the painterly shader, ship, nebula, planet textures, and pre-built 2D components are all already working. Don't rebuild anything that exists.

---

## 1. The Principle

Every page is a **painterly space scene as hero backdrop** with **conventional web UI** on top. That's it.

Pages share:
- Same painterly post-process pipeline (Kuwahara + outline + paper grain + color grade)
- Same procedural starfield / cosmic dust
- Same typography (Fraunces display, Inter body, JetBrains Mono numerals)
- Same warm-vs-cool palette family with per-page variation
- Same top nav + footer

Pages differ by:
- Nebula color palette
- Focal 3D element (ship, Saturn, wormhole, etc.)
- Ambient scene motion
- Below-fold content specific to that page

---

## 2. Pages

### `/` — Landing / Home (purple nebula + ship)

The face of ThumbFrame.

**Hero scene:**
- Purple nebula backdrop (warm violet / rose / amber palette)
- Space station ship (existing detailed model) centered or slightly off-center
- Ship swimming motion: gentle ±15° Y-axis rock + ±0.3 vertical bob + ±3° pitch, independent sine waves with different periods
- Engine flame (existing rework — tapered cone with white-hot core, noise-displaced, spark particles)
- Ambient nebula motion: slow drift of internal brush patterns, gentle pulsing
- **Shooting stars** streak across nebula on random intervals (every 6-18 seconds)
- Occasional **meteor shower moments** — burst of 5-8 shooting stars at once, rare (every 60-120 seconds)
- Subtle stardust / particles
- Painterly post-process applied to everything

**Hero overlay (top-left, ~30% viewport width):**
```
THUMBFRAME (eyebrow, amber, small caps)

An out-of-this-world
thumbnail editor.  (H1, Fraunces, large)

AI generation, CTR scoring, A/B variants —
built for YouTubers.  (subhead, Inter)

[ Start free — no credit card ]   [ Open Editor → ]
```

Buttons behave per §3 rules.

**Below fold** (conventional sections per Option B — each section has its own subtle space backdrop for continuity):
- Features teaser (3-4 highlights with icons + short descriptions, on faint nebula texture)
- Testimonials placeholder (when available, stub for now)
- Pricing preview (Free vs Pro card summary, with `See full pricing →` link)
- Final CTA section
- Footer

Each below-fold section has a subtle dark nebula texture as background (not the full painted hero nebula — a desaturated, simpler version). Maintains visual continuity without competing with the hero.

---

### `/pricing` — Pricing (teal nebula + Saturn)

**Hero scene:**
- Teal/green nebula palette (swap from violet/rose to teal/cyan/amber)
- Saturn planet as background element (upper-right area, about 25-30% of viewport)
- Saturn has **two visible rings**:
  - Inner ring represents Free tier — slower rotation, subtle amber glow, modest ornamentation
  - Outer ring represents Pro tier — slightly faster rotation, brighter glow, richer painterly detail
- Both rings rotate continuously with slow periods (45-60s full rotation)
- Each ring has painterly text/symbols orbiting on it — the inner ring shows "FREE $0" and a few feature words ("5 thumbnails/mo", "BG remover", "10 templates"), rotating along with it. The outer ring shows "PRO $15/mo" and Pro features ("Unlimited", "CTR scoring", "A/B variants", "AI gen", "Face cutout", "No watermark"), rotating slower to stagger.
- Painterly texture applied
- Subtle ambient motion on the nebula

**Pricing cards (foreground, main content):**
Centered on page, Saturn sits behind them as atmospheric backdrop. Cards are the hero of the page visually.

- **Free card** (left, muted amber accent):
  - $0/month
  - "For creators just getting started"
  - Feature list (5 thumbnails/mo, BG remover, 10 templates, 1280×720 export, community support)
  - `Start free →` button

- **Pro card** (right, orange accent with "Most popular" badge):
  - $15/month or $12/mo billed annually (save 20%)
  - Monthly/Annual toggle at top of card
  - "For creators who ship"
  - "Everything in Free, plus:" then full Pro feature list
  - `Go Pro →` button

Below cards: small text — "Cancel anytime from your dashboard. Keep Pro access through your billing period."

**Below fold:**
- FAQ accordion
- Footer

---

### `/features` — Features (fire nebula + purple wormhole)

**Hero scene:**
- **Fire nebula palette** — orange, yellow, black, dramatic and volcanic
- **Purple wormhole** as focal element (center-right, about 35% of viewport)
- Wormhole uses existing shader — spiral amber/violet swirl, hot white-amber core, Einstein ring silhouette, BUT core color shifts to cosmic purple to contrast against the fire backdrop
- Wormhole rotates slowly, draws the eye
- Feature icons orbit around the wormhole like caught in its gravity:
  - Scissors (Cut & Edit)
  - Target (CTR Score)
  - Dice (A/B Variants)
  - Sparkles (AI Generate)
  - Face (Face Cutout)
  - Grid (Templates)
- Each icon is a small painterly 3D shape with label
- Icons slowly spiral inward and outward on a loop — subtle suction feel
- Painterly post-process
- Rare ember particles drift upward through the scene (like fire sparks) — ambient

**Hero overlay (top-left):**
```
FEATURES (eyebrow, in hot amber/yellow)

Every tool a YouTuber
actually uses.  (H1)

All the features that make ThumbFrame
the editor built for one thing.  (subhead)
```

**Below fold:**
- Each feature expanded with screenshot or illustration
- How it works section
- Tie-in CTAs to open editor or sign up
- Footer

---

### `/login` & `/signup` — Authentication (minimal nebula)

**Hero scene (background only):**
- Muted violet/rose nebula, calmer than landing
- Simple starfield with occasional shooting star
- No focal planet or ship — empty space
- Painterly post-process

**Foreground:**
- Centered card with form (email, password, social logins)
- Minimal, clean, fast
- Brand wordmark at top
- Link between `/login` and `/signup`

---

### `/editor` — Editor (actual product)

Fully separate from marketing pages. No cosmic backdrop. Normal app shell.

---

### Future pages (stubs now, built later)

- `/blog` — stub page, "Coming soon" with space backdrop
- `/support` — support / help center
- `/thumbfriend` — dedicated AI page (teal/amber nebula + AI-themed focal element TBD)
- `/about` — about page
- `/privacy` — privacy policy (conventional, no heavy scene)
- `/terms` — terms of service (conventional, no heavy scene)

---

## 3. Navigation

**Top nav (on all pages except `/editor` and auth pages):**

Left: `THUMBFRAME` wordmark (Fraunces, amber accent color)

Center/Right links:
- Features
- Pricing
- Blog (stub)
- Support (stub)

Far right: **Primary CTA button**
- **If logged out:** `Start free` — goes to `/signup`
- **If logged in:** `Open Editor →` — goes to `/editor`
- Always visible, always prominent (amber background)

**Nav is translucent over space scenes.** Slightly darker background on scroll so nav stays readable over below-fold content.

**Mobile:** Hamburger menu reveals same link list. CTA button stays visible even with hamburger collapsed.

---

## 4. Button Behavior

- **Start free** (logged-out state) → `/signup`
- **Open Editor →** (logged-in state) → `/editor` with a ~1 second space transition animation (see §5)
- **Go Pro →** → Stripe checkout for Pro tier
- **Sign in** / **Sign up** → auth flows

---

## 5. Editor Entry Transition

When a logged-in user clicks `Open Editor →`:

**~1 second cinematic animation:**
- Current page dims slightly
- A small painterly "warp" effect plays — brief starfield streak outward (classic hyperspace-jump vibe but painterly)
- Fade to brief bright flash (warm amber)
- Editor fades in

Reuses the painterly shader tech. Small, fast, satisfying. Not a scene change — just a transition.

For logged-out users clicking `Start free`, simple fade transition to `/signup`.

---

## 6. Ambient Motion Across All Pages

Every page has these background ambients (shared behavior, scaled per scene):

- **Starfield:** subtle procedural stars, minimal motion
- **Shooting stars:** random intervals, 6-18s on landing (more frequent), rarer on pricing/features
- **Cosmic dust / stardust:** floating particles, varied depths for parallax
- **Nebula brush drift:** slow internal pattern movement
- **Meteor shower moments (landing only):** rare burst of 5-8 shooting stars at once, every 60-120s
- **Ember particles (features only):** drift upward through the scene like fire sparks, rare
- **Shooting stars and ambient motion respect `prefers-reduced-motion`:** if user has reduced motion enabled, cut ambient motion in half or disable entirely

---

## 7. Scroll Behavior

**Landing page (`/`):**
- Hero fills viewport on load (100vh)
- On scroll, hero stays in viewport briefly via CSS `position: sticky` then gives way smoothly (light pin, 100-200px pin distance)
- Below-fold sections flow normally

**Other pages (`/pricing`, `/features`):**
- Hero takes ~60-70vh (not full screen — leaves room for content peeking below to invite scroll)
- Normal scroll down to content

---

## 8. Mobile

All pages work on mobile with simplified scenes:
- 3D scene remains but simpler (fewer particles, no meteor showers, shooting stars less frequent)
- Ship on landing page still animates gently
- Saturn on pricing still rotates but simpler ring detail
- Wormhole on features still rotates but simplified
- Nav becomes hamburger
- CTAs stay prominent
- Below-fold content reflows to single column
- Load target: <3s on 4G

---

## 9. Tech Stack

### Keep
- React 19 + Vite (CRA setup)
- Tailwind v4
- Framer Motion (overlay animations, button interactions)
- Zustand (auth state, theme, etc.)
- Three.js + @react-three/fiber + @react-three/drei (3D scenes)
- @react-three/postprocessing + postprocessing (painterly pipeline)
- maath (math utilities for shaders)
- Existing painterly shaders: KuwaharaEffect, OutlineEffect, PaperGrainEffect, ColorGradeEffect, StructureTensorPass
- Existing scene components: SpaceStation, EnginePlume, Nebula, Stardust
- Existing Problem Planet shader (adapt for Saturn)
- Existing Wormhole shader (adapt for features page)
- Pre-built 2D components: Navbar, Footer, Pricing, FAQ, Features, Hero, Problem, Comparison, Demo, FinalCTA, ui/*
- lib/motion.js presets

### Remove (from active build path — archive in repo)
- Galaxy overview layout (`Galaxy.jsx`, `GalaxyLayout`)
- Click-to-travel system (CameraController 3D, raycasting on planets, Rocket.jsx)
- Scroll-cinematic tour mode (ScrollTour.jsx)
- Thumbtown scene + layers + all related files (`src/landing/thumbtown/*`)
- `ScrollDebug.jsx`, `PlanetHoverLabel.jsx`, `GalaxyHero.jsx`, `PlanetContent.jsx`
- Any scroll-offset-driven scene choreography

### Archive (not deleted — keep in repo under `_archive/`)
- All Thumbtown 2D painted assets under `public/assets/thumbtown/` (may inspire future features, but unused for now)
- Thumbtown spec markdown
- V3 galaxy hub code already archived under `_legacy_galaxy/` stays

---

## 10. Directory Structure

```
src/landing/
├── LandingPageV2.jsx              (mount point — routes to page-level components)
├── landing.css / .built.css       (Tailwind base, unchanged)
├── lib/
│   └── motion.js                  (unchanged)
├── components/                    (unchanged — pre-built 2D UI, fully reused)
│   ├── layout/{Navbar,Footer}.jsx
│   ├── sections/*.jsx
│   └── ui/*.jsx
├── pages/                         (NEW — page-level components)
│   ├── LandingPage.jsx            (/ — purple nebula + ship)
│   ├── PricingPage.jsx            (/pricing — teal nebula + Saturn)
│   ├── FeaturesPage.jsx           (/features — fire nebula + purple wormhole)
│   ├── LoginPage.jsx              (/login)
│   ├── SignupPage.jsx             (/signup)
│   └── stubs/                     (blog, support, about — simple stub pages)
├── scenes/                        (3D scene containers for each page)
│   ├── LandingScene.jsx           (ship + purple nebula)
│   ├── PricingScene.jsx           (Saturn + teal nebula)
│   ├── FeaturesScene.jsx          (wormhole + fire nebula)
│   ├── AuthScene.jsx              (minimal nebula)
│   └── shared/                    (shared 3D primitives)
│       ├── Nebula.jsx             (palette-configurable)
│       ├── SpaceStation.jsx       (unchanged — existing ship)
│       ├── EnginePlume.jsx        (unchanged)
│       ├── Stardust.jsx           (unchanged)
│       ├── ShootingStars.jsx      (NEW — random-interval streaks + meteor burst)
│       ├── SaturnPlanet.jsx       (NEW — planet + 2 rotating rings with text)
│       └── WormholeOrbit.jsx      (adapted from existing Wormhole)
├── shaders/painterly/             (unchanged)
│   └── ... (Kuwahara, Outline, etc.)
├── system/
│   ├── EditorTransition.jsx       (NEW — handles "Open Editor" warp transition)
│   └── ReducedMotion.jsx          (NEW — detects prefers-reduced-motion)
└── _archive/                      (old Thumbtown + legacy_galaxy preserved)
```

---

## 11. Build Order

Stop and show after each phase.

### Phase 1 — Archive & Cleanup
- Tag current state as `thumbtown-final`
- Archive current Thumbtown work to `_archive/thumbtown/`
- Remove Thumbtown-specific code from active build path
- Remove galaxy hub leftover code still in active path
- Render a placeholder on `/` so dev server stays clean
- Verify dev server runs clean

### Phase 2 — Restore & Refine Landing Scene
- Restore the landing hero to its strongest past state: ship + purple nebula + detailed engine flame + painterly post-process
- Apply ship motion (swimming — Y-axis rock, vertical bob, pitch)
- Add shooting stars with random intervals
- Add rare meteor shower moments
- Apply subtle nebula drift + brush pattern pulsing
- Hero overlay with updated H1/subhead/CTAs
- Run on `/` route
- Ship clean, review

### Phase 3 — Below-Fold Landing Content
- Features teaser section (reuse pre-built Features.jsx with subtle space texture behind)
- Testimonials stub
- Pricing preview section
- Final CTA + footer
- Nav bar finalized with logged-in/logged-out state logic

### Phase 4 — Pricing Page
- Build `PricingPage.jsx` and `PricingScene.jsx`
- Teal nebula backdrop
- Saturn planet with 2 rotating rings (text orbiting each)
- Pricing cards as foreground (reuse Pricing.jsx)
- Monthly/annual toggle with correct $15 / $12 copy
- FAQ section below
- Route setup at `/pricing`

### Phase 5 — Features Page
- Build `FeaturesPage.jsx` and `FeaturesScene.jsx`
- Fire nebula backdrop (orange/yellow/black)
- Purple wormhole focal element
- 6 feature icons orbiting
- Rare ember particles drifting upward
- Hero overlay
- Below-fold per-feature expanded sections
- Route setup at `/features`

### Phase 6 — Auth Pages
- `LoginPage.jsx` + `SignupPage.jsx`
- Minimal nebula backdrop + centered auth card
- Routes at `/login` and `/signup`

### Phase 7 — Editor Transition Animation
- Build `EditorTransition.jsx`
- 1-second painterly warp effect for logged-in → editor jumps
- Wire into `Open Editor →` button on all marketing pages

### Phase 8 — Stub Pages
- `/blog`, `/support`, `/about` stubs with space backdrop and "Coming soon" messaging
- `/privacy` and `/terms` — conventional text pages, no space backdrop (readable, standard)

### Phase 9 — Mobile Polish
- Simplified scenes on mobile for each page
- Hamburger menu, responsive layouts
- Test on real device sizes

### Phase 10 — Performance + SEO
- Image optimization, code-splitting
- Lighthouse audit — target 85+ desktop, 70+ mobile
- Meta tags, structured data, OG cards
- Static fallback pages for SEO (optional, discuss if needed)

### Phase 11 — Deploy
- Vercel preview
- Final review
- Production

---

## 12. Asset Pipeline

Almost no new assets needed. Everything is procedural or reused.

**Reused:**
- Existing Problem Planet Midjourney texture (`public/assets/textures/problem-planet.png`) — optional, could become Saturn's surface texture
- Ship model (procedural)
- Nebula shader (procedural, palette-configurable)
- Wormhole shader (procedural)

**New Midjourney assets (only if needed):**
- Saturn surface texture (warm amber/cream with ring hint) — optional, could be procedural
- Abstract painterly background texture for below-fold sections (subtle nebula-ish)

Minimal asset generation. Save you time.

---

## 13. Palette Reference

Per-page nebula palettes. Painterly shader uses these for Kuwahara color clusters and outline tints.

**Landing (`/`) — Purple nebula:**
- Core: #2a1850 (deep violet)
- Mid: #6a3880 (rose violet)
- Highlight: #e8a8c0 (dusty rose)
- Accent: #c86020 (warm amber for ship / engine)

**Pricing (`/pricing`) — Teal nebula:**
- Core: #0f2a2e (deep teal)
- Mid: #2a6670 (muted cyan)
- Highlight: #9ad0c0 (pale mint)
- Accent: #e8c050 (warm amber for Saturn / ring glow)

**Features (`/features`) — Fire nebula:**
- Core: #0a0502 (near-black, deep space)
- Deep: #2a1408 (burnt umber)
- Mid: #c85020 (molten orange)
- Highlight: #ffc850 (hot amber yellow)
- Accent: #a850c8 (cosmic purple for wormhole core contrast)

**Auth (`/login`, `/signup`) — Muted rose:**
- Desaturated version of landing palette, -30% saturation, +10% brightness
- Calmer, more neutral

Typography stays consistent across all: Fraunces display, Inter body, JetBrains Mono numerals. Accent colors match per-page palette.

---

## 14. Success Criteria

The landing ships when:
- `/` loads in under 3 seconds with the hero scene rendered cleanly
- All 3 main pages (`/`, `/pricing`, `/features`) exist and are visually distinct yet cohesive
- Nav works on all pages, including mobile hamburger
- Pricing is accurate ($15/mo or $12/mo annual Pro)
- `Open Editor →` / `Start free` logic works per logged-in state
- Lighthouse 85+ desktop, 70+ mobile
- Painterly aesthetic is consistent across all scenes

---

## 15. What This Is Not

- Not a scroll cinematic
- Not a galaxy hub with clickable planets
- Not a 2D illustrated world
- Not a multi-element world with oceans, mountains, forests
- Not an AI-first product — ThumbFrame is a thumbnail editor with AI features
- Not a complex choreographed experience
- Not a pivot. This is the final direction.

---

## 16. One-Line Pitch

ThumbFrame's landing is a painterly cosmic universe — purple nebula home, teal Saturn pricing, fire nebula features — each page a distinct painting, all woven by the same aesthetic hand. Conventional web UI. Beautiful backdrops. No more complexity.
