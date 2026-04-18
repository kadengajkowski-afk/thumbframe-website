# ThumbFrame Landing Page v3 — Clickable Galaxy Hub

> **Status:** Supersedes v2. v2 scroll-cinematic model is dead. Primary interaction is now **click-to-travel** between planets. Scroll is a secondary "tour" mode.
>
> Most of what's already built stays — the painterly shader, the nebula backdrop, the ship, the wormhole, the planet textures. What changes is the **navigation model** and the **scene structure** (6 → 5 planets).
>
> **For Claude Code.** Repo: `C:/Users/marel/snapframe-website`. Read this end-to-end before refactoring. Ask before destructive changes — a lot of working code exists and must be reused.

---

## 1. The New Model

User lands on `thumbframe.com` and sees the full painterly galaxy immediately. Five planets visible, arranged in space, nebula backdrop, hero text overlay.

Three ways to navigate:

1. **Click a planet** → rocket flies to it (~2s) → planet fills viewport, content reveals as HTML overlay → "Return to galaxy" closes it.
2. **Scroll** → automatic tour mode. Camera flies through planets 1→5 in sequence. Each planet's content reveals as camera arrives.
3. **Keyboard arrows** → same as scroll but discrete. Left/right flies to previous/next planet. Esc returns to galaxy overview.

Default state is galaxy overview. User can stay there forever looking at the painted scene. Or click. Or scroll.

---

## 2. Scene Structure — 5 Planets

Changed from v2's 6 scenes. "Departure" is gone — final CTA lives on Planet 5.

### Planet 1 — Signal (was "Arrival")

The home base planet. Space station + ship visible. Hero text and primary CTA live here.

- **Default view on galaxy overview:** center-foreground
- **On click:** camera pushes in close to the station, hero overlay takes full attention
- **Content:** H1, subhead, "Start free" CTA, "Explore the galaxy" CTA that triggers tour mode
- **Asset:** existing Scene 1 space station + nebula

### Planet 2 — The Dead World (was "Problem Planet")

Why other tools fail.

- **Default view:** upper-left of galaxy
- **On click:** camera arcs to planet, pans around once, broken tool artifacts drift in view
- **Content:** "Chapter 1 — The dead planet" eyebrow, H2 "Every thumbnail tool was built for something else", 3-line Canva/Photoshop/Photopea callout, orange tagline
- **Asset:** existing Problem Planet Midjourney texture + artifacts

### Planet 3 — The Singularity (was "Editor Planet")

The wormhole is the entry animation for this planet.

- **Default view:** swirling event horizon disc floating in galaxy, right of center
- **On click:** rocket flies toward event horizon → plunge through wormhole tunnel (3-4s) → editor plane reveals at the core with 6 feature satellites
- **Content:** 6 feature tags anchored around editor plane (BG Remover, CTR Score, A/B Variants, AI Generate, Face Cutout, Templates), CTA "Try ThumbFrame free"
- **Asset:** existing wormhole shader + editor plane + feature icons

### Planet 4 — The Docking Station (pricing + FAQ)

Warm station for commerce.

- **Default view:** lower-center of galaxy, recognizable station silhouette
- **On click:** camera docks with the station, static framing for reading
- **Content:** pricing cards (Free vs Pro), monthly/annual toggle, FAQ accordion
- **Asset:** needs pricing station geometry (not yet built) + pirate planet texture we generated as optional secondary scenery

### Planet 5 — The Science (was "Score Planet") + Final CTA

The close-the-deal planet.

- **Default view:** lower-right of galaxy, small planet with hot orange core
- **On click:** camera approaches, animated CTR score ticker counts 0→87
- **Content:** "Score every thumbnail before you upload," explanation of CTR model, final "Start free" CTA
- **Asset:** needs small planet geometry (not yet built)

---

## 3. Galaxy Overview (Default View)

The page's home state. What every user sees on load.

**Composition:**
- Camera at (0, 2, 22) looking at (0, 0, 0)
- All 5 planets visible, arranged in a loose arc
- Nebula backdrop behind
- Hero overlay text pinned to upper-left quadrant
- Planet labels visible (small floating names in painterly type) — fade in on hover

**Planet arrangement (world space):**
```
Planet 1 (Signal/home):    (0, 0, -6)        center-foreground
Planet 2 (Dead):           (-8, 3, -14)      upper-left
Planet 3 (Singularity):    (10, 1, -12)      right, wormhole visible as the swirl
Planet 4 (Docking):        (-3, -4, -10)     lower-center-left
Planet 5 (Science):        (8, -3, -8)       lower-right
```

Adjust for visual balance during iteration.

**Camera behavior on overview:**
- Very slow orbital drift (~0.02 rad/s around Y axis) — 5-minute full rotation
- Subtle breathing zoom (±0.5 units on Z over 8s cycle) — makes galaxy feel alive, never static
- OrbitControls disabled by default — no free-look. We want composed framing.

**Hero overlay (always visible on overview):**

```
[Eyebrow — amber, small]
THUMBFRAME

[H1 — Fraunces 56px, paper-highlight]
An out-of-this-world
thumbnail editor.

[Subhead — Inter 18px, teal-mist]
Click any planet to explore. Or scroll to take the tour.
AI generation, CTR scoring, A/B variants — built for YouTubers.

[CTAs]
[ Start free — no credit card ]   [ Take the tour ↓ ]
```

The secondary CTA triggers scroll-tour mode (auto-animates the user through all 5 planets). Primary CTA links to signup.

---

## 4. Click-to-Travel Animation

When user clicks a planet:

1. **Overlay fades** — hero text opacity 1 → 0 over 300ms
2. **Rocket spawns** — small painterly ship appears near camera position
3. **Camera follows rocket** along a Catmull-Rom curve from current position to final planet-orbit position, over ~1.8 seconds. Ease-in-out-cubic. Rocket leads camera by 0.3 units.
4. **Arrival** — rocket decelerates, camera settles on planet orbit position. Planet's specific camera choreography plays (see per-planet specs).
5. **Content overlay fades in** — planet's HTML content appears with opacity + subtle translateY, 600ms
6. **"Return to galaxy" button appears** in top-left corner — always accessible

When user clicks "Return to galaxy" or presses Esc:

1. Content overlay fades out (300ms)
2. Camera flies back to galaxy overview position (1.2s)
3. Hero overlay fades back in
4. State returns to default

**For the Singularity planet (wormhole):** the click animation takes longer (~3.5s) because it includes the full wormhole plunge. Same pattern, just extended duration.

---

## 5. Scroll Tour Mode

When user scrolls (or clicks "Take the tour"):

Scroll maps to planet index:
- 0.00 – 0.15: galaxy overview (idle)
- 0.15 – 0.30: traveling to + on Planet 1
- 0.30 – 0.45: traveling to + on Planet 2
- 0.45 – 0.65: traveling to + through Planet 3 (longer for wormhole + editor)
- 0.65 – 0.80: traveling to + on Planet 4
- 0.80 – 0.95: traveling to + on Planet 5
- 0.95 – 1.00: return to galaxy overview

Each transition is the same click-to-travel animation, just triggered by scroll position instead of click. Content overlays appear and disappear at the right scroll ranges.

User can interrupt the tour anytime by clicking a different planet.

---

## 6. Scene Preservation — What We Keep

Don't rebuild from scratch. Repurpose existing work:

**Keep as-is:**
- Painterly post-processing pipeline (Kuwahara + paper grain)
- Nebula shader backdrop
- Space station ship + engine flame + hull detail
- Wormhole event horizon shader
- Wormhole tunnel shader with spiral motion
- Editor plane + 6 feature tag icons
- Problem Planet Midjourney texture + 3 broken artifacts
- All Theatre.js keyframe data (will be repurposed as animation clip library, not scroll-driven)

**Refactor:**
- Scroll-driven sequence becomes click-handler-driven animation. Each planet has its own `enter()` and `exit()` animation functions.
- Camera is now driven by state machine (current planet, transition progress) not scroll offset.
- Content overlays are now conditional on active planet state.

**Build new:**
- Galaxy overview layout (planet positions, overview camera)
- Planet click handlers + raycasting
- Planet hover labels
- Planet 4 docking station geometry
- Planet 5 Science planet geometry
- Return-to-galaxy button + Esc handler
- Scroll-to-planet-index bridge

---

## 7. Interaction Details

### Planet hover
- Raycast from mouse to planet meshes
- On hover: planet gets subtle emissive glow boost (+0.2), cursor changes to pointer, label fades in above planet
- On mouse leave: reverts over 200ms

### Planet click
- Triggers travel animation described in §4
- Previous planet's exit animation plays if user was on one already
- URL updates to hash — `/#/signal`, `/#/dead`, `/#/singularity`, `/#/docking`, `/#/science` — deep-linkable

### Keyboard
- Left arrow / Right arrow: previous / next planet
- Esc: return to galaxy overview
- 1-5: jump directly to that planet
- Space: pause/resume ambient audio (if enabled)

### Touch (mobile — hold for later)
- Tap planet to travel
- Swipe horizontally to next/previous
- Pull down from planet content to return to galaxy

---

## 8. State Management

Use Zustand (already in stack). Store:

```js
useGalaxyStore = {
  activePlanet: null | 'signal' | 'dead' | 'singularity' | 'docking' | 'science',
  transitionState: 'idle' | 'entering' | 'on-planet' | 'exiting',
  transitionProgress: 0..1,
  tourMode: boolean,
  audioEnabled: boolean,
  
  actions: {
    goToPlanet(id),
    returnToGalaxy(),
    toggleTour(),
    toggleAudio(),
  }
}
```

Theatre.js keyframes still drive individual planet choreography (camera movements, content reveals) but are triggered by state changes, not scroll.

---

## 9. Migration Plan — What Claude Code Does

Execute in this order. Do not parallelize.

**Step 1 — Audit & snapshot.** Document current Theatre.js keyframes, scene positions, shader configs. Save a snapshot commit tagged `v2-scroll-final` before touching anything.

**Step 2 — Galaxy overview.** Build the 5-planet wide shot. Reposition existing planet meshes to new coordinates. Add galaxy-overview camera, slow drift, breathing zoom. Hero overlay positioned. No click handlers yet.

**Step 3 — Click-to-travel engine.** Implement state machine + Zustand store + camera curve animation + raycasting for planet clicks. Test with simple placeholder animations on each planet — just camera push-in, no content reveals yet.

**Step 4 — Content overlays.** Port each planet's content from current scenes into HTML overlays that show on active state. Hero/CTAs on Planet 1, problem copy on Planet 2, pricing/FAQ on Planet 4, etc.

**Step 5 — Per-planet animations.** Wire Theatre.js sheets to each planet's enter/exit. Camera positions, planet-specific motion (wormhole plunge, station docking, score ticker).

**Step 6 — Scroll tour binding.** Add secondary scroll-to-planet mapping. Scrolling plays through planets in order.

**Step 7 — Keyboard + URL hash.** Arrow keys, Esc, 1-5 number keys, URL hash deep links.

**Step 8 — Polish.** Hover states, labels, transition timings, any jank.

Stop after each step for review.

---

## 10. Open Questions for Kaden

Ask before Step 1:

1. **Planet 4 Docking Station asset:** procedural station geometry (like the ship), or use the pirate-planet Midjourney texture we already generated? The pirate-planet makes more sense as scenery if we rename it from "Docking Station" to something like "Treasure Dock" — but that may not match "pricing" intuitively. Quick gut check: is pricing a station (procedural) or a treasure planet (Midjourney)?

2. **Planet 5 Science:** need a new Midjourney asset. Spec suggests small intense planet with hot orange core visible through translucent shell. Kaden generates before Step 5 of migration.

3. **"Take the tour" CTA behavior:** does clicking it scroll the page programmatically (smooth-scroll through tour) or does it trigger an auto-play sequence that doesn't require scrolling (user just watches)? Auto-play is more controllable but feels more passive.

4. **Deep linking:** when a user visits `thumbframe.com/#/docking` directly, do they see the galaxy overview first and then animate into Docking Station, or do they land directly on Docking Station with no intro? Direct land is faster for returning users.

---

## 11. What Doesn't Change from v2

- Painterly aesthetic, Fraunces/Inter/JetBrains Mono typography, warm amber / deep violet / teal mist palette
- All existing copy (hero, problem, pricing, FAQ, score)
- Performance targets — 60fps desktop, 30fps mobile, <3s LCP, <3MB total weight
- Audio model — Howler, muted by default, toggle in corner
- Accessibility — keyboard nav, screen reader overlays, reduced-motion fallback
- Static fallback for SEO — still required, separate page at `/landing-static`

---

## 12. The Pitch in One Line

This is `thumbframe.com` as a painterly video game's main menu. Click planets to explore. Scroll to watch the guided tour. Every interaction is cinematic. Nothing is scroll-locked.
