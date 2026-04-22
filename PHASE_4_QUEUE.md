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
(populate as you go)

## Completion summary (fill in after 4.f ships)
- Every visual design decision made
- Every component created and where it lives
- Where the voice/copy was exercised (and examples)
- What feels rough and needs polish before launch
- Recommended first step of Phase 5
