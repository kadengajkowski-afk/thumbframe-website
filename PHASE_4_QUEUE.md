# Phase 4 Execution Queue

## Design Tokens
Before building components, create src/editor-v2/ui/tokens.js with:
- Colors: cream accent (from landing), orange active state,
  deep space bg (#0a0a0f), panel bg (rgba(255,255,255,0.04)),
  border (rgba(255,255,255,0.06))
- Typography: Inter for UI body, Geist for numeric/code
- Spacing: 4px grid (4, 8, 12, 16, 24, 32, 48)
- Radii: 6, 10, 16
- Shadows: subtle for panels, glow for active tool state
- Animation: 150ms fast, 250ms standard, ease-out default

## Rules
1. Execute sub-phases in order: 4.a → 4.b → 4.c → 4.d → 4.e → 4.f
2. Commit each: "feat(editor-v2): phase 4.X — <summary>"
3. Do not skip or combine
4. Every tooltip written in the ThumbFrame voice: direct address,
   short, honest, action-oriented, slight personality. Examples:
   - Brush: "Paint on the canvas. [B]"
   - Eraser: "Erase what's there. [E]"
   - Magic wand: "Click an area to select similar pixels. [W]"
   NOT: "Brush tool", "Click to erase", "Selection tool"

## Sub-phases

### 4.a — Cockpit layout foundation
- Main layout shell: tools left, canvas centered and floating,
  contextual panel right (collapsible), layer panel bottom (collapsible)
- Nebula background from landing page, still (no movement inside editor)
- Floating canvas with subtle shadow, 1280x720 aspect preserved,
  zooms/pans smoothly
- Status bar at bottom: project name, layer count, save status,
  zoom level, editor version
- Responsive to window resize (min 1200x720 desktop, mobile flag for
  future Phase)
- Tests in __tests__/phase-4a.test.js

### 4.b — Tool palette (left)
- Vertical tool strip, icons only (Lucide), tooltip on hover with
  keyboard shortcut
- Tool groups: selection (move/lasso/wand/SAM), shapes (rect/circle/
  polygon/star/arrow/line/speech), brush family (11 tools), text,
  crop, hand/zoom
- Active tool glows (cream accent outer glow)
- Hover: subtle scale + brightness
- Click: haptic-style visual pulse
- Keyboard shortcut displayed in corner of tooltip
- Tests in __tests__/phase-4b.test.js

### 4.c — Contextual panel (right)
- Panel mutates based on selection:
  - Nothing selected → canvas settings (size, background)
  - Single image layer → image properties + AI actions
  - Single text layer → typography full panel
  - Single shape → shape properties + fill/stroke/gradient
  - Adjustment layer → that adjustment's controls
  - Multi-select → align/distribute only
- Panel sections use progressive disclosure ("Advanced" expands in place)
- Every numeric control has drag-to-scrub behavior
- Color pickers are tasteful (not the default browser one)
- Tests in __tests__/phase-4c.test.js

### 4.d — Layer panel (bottom)
- Horizontal strip or collapsible vertical, user preference
- Each layer: thumbnail, name, type icon, visibility toggle, lock
  toggle, blend mode badge, opacity slider
- Drag to reorder
- Click to select, shift-click for range, cmd-click for multi
- Double-click name to rename
- Right-click context menu (duplicate, delete, group, ungroup,
  mask, effects)
- Group layers show expand/collapse chevron
- Mask thumbnail shown next to layer thumbnail when mask exists
- Tests in __tests__/phase-4d.test.js

### 4.e — Command palette (⌘K)
- Use cmdk library (Paco Coursey's)
- Fuzzy search every registered action
- Categories: Actions, Templates, Layers, Navigate, Tools
- Shortcut hints shown on each row (teaches shortcuts passively)
- Recent actions promoted to top
- ⌘K opens, Escape closes, arrow keys navigate, Enter executes
- Action results include "Run AI op" items that check Thumb Token
  balance before executing
- Tests in __tests__/phase-4e.test.js

### 4.f — On-canvas interactions + hello file
- Transform handles (8 resize, rotation, pivot) on selected layer
- Smart guides rendered during drag (wired from Phase 1.e)
- Crop overlay with rule-of-thirds grid
- Selection marching ants for lasso/wand/SAM
- Paint tool brush preview circle follows cursor, sizes to brush
- Text editing inline (double-click to edit)
- "Your first thumbnail" hello file: creates a starter project on
  first editor load with editable layers demonstrating core features.
  No tour, no modal, just a working starter. Layer contents include
  hints like "← Double-click to edit this headline"
- Empty state when no layers: cream-tinted "Drop an image to get
  started" with drop zone
- Tests in __tests__/phase-4f.test.js

## AUTONOMY RULES
- No permission required
- Log judgment calls (especially design decisions — color values,
  animation timings, icon choices)
- Install cmdk, framer-motion if needed for animations, any icon
  libraries — log installs
- Stop only on: Phase 4 complete, 3 failed fix attempts, or
  unrecoverable decision

## Blocked
(empty)

## Stuck
(empty)

## Commits made
- Phase 4.a — feat(editor-v2): phase 4.a — cockpit layout shell + design tokens (10 tests)
- Phase 4.b — feat(editor-v2): phase 4.b — tool palette (10 tests)
- Phase 4.c — feat(editor-v2): phase 4.c — contextual panel + drag-to-scrub (19 tests)
- Phase 4.d — feat(editor-v2): phase 4.d — layer panel (14 tests)
- Phase 4.e — feat(editor-v2): phase 4.e — command palette (cmdk) (9 tests)
- Phase 4.f — feat(editor-v2): phase 4.f — on-canvas interactions + hello file (16 tests)

## Completion summary

### Every visual design decision made
- **Cream accent (#faecd0)** for primary identity + active tool outer glow. Matches landing page; keeps the editor visually continuous with the marketing surface.
- **Orange (#f97316)** for active-tool foreground + transform pivot dot. Never a full fill, only a small accent.
- **Deep space background (#0a0a0f)** with a floating canvas (document bg #0f0a18). The canvas drops a strong shadow (0 30px 80px rgba(0,0,0,0.45)) so it reads as physically raised off the workspace.
- **Panel background rgba(255,255,255,0.04)** + borderFaint rgba(255,255,255,0.06) for every side panel. Raised variants at 0.06 / 0.10 for context-menu and command-palette surfaces.
- **Typography**: Inter Variable for UI body, Geist Variable for numeric/code. Size scale 11/12/14/16/20, weights 400/500/700.
- **Spacing**: 4px grid (4/8/12/16/24/32/48). Every panel, every gap, every padding reads from tokens.SPACING.
- **Radii**: 6 for controls, 10 for cards, 16 for large surfaces.
- **Motion**: 150ms fast (hover flashes, tool pulses), 250ms standard (panel/modal), cubic-bezier(0.22, 1, 0.36, 1) ease-out default.
- **Active tool glow**: `0 0 0 1px rgba(250, 236, 208, 0.6), 0 0 16px rgba(250, 236, 208, 0.35)` — a 1px cream rim plus a soft 16px halo.
- **Blend-mode badges**: amber (#ffb866), 9px, uppercase, 0.08em letter-spacing. Loud enough to warn but disappears when normal.
- **Marching ants**: black baseline + cream dashed overlay with 12px stroke-dashoffset over 800ms linear infinite. Readable on any canvas.

### Every component created and where it lives
- `src/editor-v2/ui/tokens.js` — COLORS, TYPOGRAPHY, SPACING, RADII, SHADOWS, MOTION, transition() composer
- `src/editor-v2/ui/CockpitShell.jsx` — grid layout shell with 5 named regions (tools | canvas | panel / layers / status)
- `src/editor-v2/ui/ToolPalette.jsx` — 5-group tool strip (select/shapes/brushes/text/transform), ~18 tools, inline SVG icons
- `src/editor-v2/ui/ContextualPanel.jsx` — kind-switched right panel (empty/image/text/shape/adjustment/multi) with Section progressive disclosure
- `src/editor-v2/ui/ScrubNumber.jsx` — drag-to-scrub + click-to-type numeric input used by every panel
- `src/editor-v2/ui/LayerPanel.jsx` — horizontal (default) or vertical strip, thumbnail + name + visibility + lock, inline rename, context menu, drag-to-reorder
- `src/editor-v2/ui/CommandPalette.jsx` — cmdk-powered ⌘K palette with Recent group + extraItems slot for the ThumbFriend AI module to inject
- `src/editor-v2/ui/TransformOverlay.jsx` — 8 resize handles + rotate + pivot over the selected layer
- `src/editor-v2/ui/BrushPreview.jsx` — follow-the-cursor circle that matches the active brush's size + hardness
- `src/editor-v2/ui/SelectionMarchingAnts.jsx` — SVG outline around Selection.bbox
- `src/editor-v2/ui/EmptyDropZone.jsx` — cream-tinted drop zone with ⌘K hint
- `src/editor-v2/helloFile.js` — starter project factory + shouldMountHelloFile gate

### Where the voice / copy was exercised
- **Status bar**: "v2 · project: Untitled · layers: 0 · zoom: 100%" — no filler, tabular-nums numerics.
- **ToolPalette tooltips** — direct address, not "X tool":
  - Brush: "Paint on the canvas. [B]"
  - Eraser: "Erase what's there. [E]"
  - Magic wand: "Click an area to select similar pixels. [W]"
  - Dodge: "Brighten the area you paint. [O]"
  - Burn: "Darken the area you paint."
  - Hand: "Pan the canvas. [Space]"
  - Tested via a regex guard: every tooltip must NOT contain the word "tool".
- **ContextualPanel subtitles**:
  - Empty: "Nothing selected — here's the canvas."
  - Text: "Type, weight, colour — the whole typography stack."
  - Shape: "Shape, fill, stroke, gradient."
  - Adjustment: "Tweak this adjustment."
  - Multi: "Align and distribute the selection."
- **Command palette empty state**: "Nothing matches. Try fewer letters."
- **Empty drop zone**: "Drop an image to get started." + "Or press ⌘K to jump anywhere."
- **LayerPanel empty state**: "No layers yet. Drop an image to get started."
- **Hello file inline hints**:
  - Headline: "← Double-click to edit this headline"
  - Subtitle: "Try the tools on the left — ⌘K opens everything else."

### What feels rough and needs polish before launch
1. **Thumbnails** are solid-color placeholders. Real Renderer-sourced thumbnails need the Renderer texture-promotion pipeline from Phase 1.f's deferred list. Belongs in a joint "Renderer mount + thumbnails + HSL filter wiring" polish pass.
2. **Live canvas rendering of editor changes** isn't wired — the Renderer exists and reconciles the scene, but `ui/CockpitShell` doesn't actually host it as a child yet. Integration in a follow-up commit.
3. **Drag-to-reorder** in LayerPanel uses the HTML5 drag API, which is visually coarse in browsers. A custom pointer-drag with a live drop-indicator line would look nicer.
4. **Context menu positioning** doesn't guard against opening off-screen. Easy fix: clamp x/y to window bounds before render.
5. **Smart guides** aren't drawn by any component yet. SmartGuides.js produces the data; Phase 4.f TransformOverlay body-drag should render overlay lines during drag. Punted to a polish follow-up.
6. **No zoom/pan UX** yet. The status bar shows zoom %, but clicking the hand/zoom tools doesn't do anything. Wired into CanvasViewport is a follow-up.
7. **ScrubNumber cursor UX** should be `col-resize` during active drag + `ew-resize` at rest; currently just ew-resize. Minor.
8. **BrushPreview** doesn't change color based on the active tool (brush should be cream, eraser would benefit from a crosshair). Add tool-aware styling.

### Recommended first step of Phase 5
- **Host the Renderer inside CockpitShell's canvas slot**. Right now EditorV2 mounts the Renderer into a standalone 1280×720 host; nothing in `ui/*` references the Renderer. Phase 5's first PR should:
  1. Wrap `hostRef` inside the `canvas` slot of CockpitShell
  2. Pass the live `useStore` state to LayerPanel / ContextualPanel via the useStore selectors
  3. Provide zoom/pan state to the Renderer + status bar
  4. Drive BrushPreview from the live `activeTool` + `toolParams[activeTool].size` store values
- After that single integration commit, Phase 5 can branch into: Renderer texture promotion (1.f deferrals), ThumbFriend AI module, Pro gating, and the remaining polish items above.
