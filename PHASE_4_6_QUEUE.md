# Phase 4.6 Execution Queue — UI Rebuild

## The One Rule
Drama on transitions. Calm during work. Every decision gets judged
against this.

## The Core Principle
Opening ThumbFrame should feel like looking at the horizon, not getting
a door slammed in your face. The editor is the bridge of a sailship.
Dark mode is space. Light mode is ocean. The user is the captain. The
canvas is what they're sailing toward.

## Design Tokens (build first, sub-phase 4.6.a)

Create src/editor-v2/ui/tokens.js with:

### Colors
- `--bg-space-1`: #0a0a0f (dark mode bg gradient top)
- `--bg-space-2`: #15151e (dark mode bg gradient bottom)
- `--bg-ocean-1`: #F4F1EA (light mode bg gradient top, cream)
- `--bg-ocean-2`: #D8E3EC (light mode bg gradient bottom, pale blue)
- `--accent-cream`: #F9F0E1 (dark mode accent)
- `--accent-navy`: #1B2430 (light mode accent)
- `--canvas-surface-dark`: #1a1a22 (canvas area in dark mode)
- `--canvas-surface-light`: #EDE7DA (canvas area in light mode)
- `--panel-dark`: rgba(255,255,255,0.04) with backdrop blur 12px
- `--panel-light`: rgba(255,255,255,0.6) with backdrop blur 12px
- `--border-subtle-dark`: rgba(255,255,255,0.08)
- `--border-subtle-light`: rgba(27,36,48,0.08)

### Typography
- UI body: Inter (already bundled)
- Project name / numeric: Geist (already bundled)
- Headline / display: Fraunces (from landing page, already bundled)

### Spacing
4px grid: 4, 8, 12, 16, 24, 32, 48

### Radii
6, 10, 16

### Motion tokens
- `--motion-fast`: 150ms
- `--motion-standard`: 250ms
- `--motion-theme`: 300ms
- `--motion-ship-alive`: 1200ms

### Easing
- default: cubic-bezier(0.2, 0.8, 0.2, 1) (ease-out)
- theme: cubic-bezier(0.4, 0, 0.2, 1) (ease-in-out)

## Rules
1. Execute sub-phases in strict order: 4.6.a → 4.6.h
2. Commit each: "feat(editor-v2): phase 4.6.X — <summary>"
3. Do not skip or combine
4. Every tooltip in the ThumbFrame voice. Examples are mandatory, not
   suggestions.
5. Every visible text string goes through a central copy file so voice
   can be audited and revised without hunting through components.

## Sub-phases

### 4.6.a — Design tokens + theme system
- Create tokens.js (see above)
- Theme context provider (dark default, light toggle)
- Theme persists in localStorage keyed by user id
- 300ms crossfade on theme change via CSS custom property transition
- Both themes pass WCAG AA contrast on all text/background combos
- Tests in __tests__/phase-4-6-a.test.js

### 4.6.b — Cockpit layout shell
- CockpitShell component at src/editor-v2/ui/CockpitShell.jsx
- Layout: top bar (thin), left tool palette, center canvas area, right
  contextual panel, bottom layer panel
- Background: nebula (dark) or water ripple (light) behind canvas
- Canvas area: 1280x720 frame with subtle drop shadow and thin
  cream-accent border, floats in the background
- Canvas surface (inside the frame): --canvas-surface-dark/light with
  very subtle dot pattern texture to indicate canvas boundaries when
  image is smaller than canvas or transparent
- Window resize handling: panels shrink gracefully, never break
- Below 1024px viewport: show banner "ThumbFrame works best at 1280px
  and up. It'll work here but some panels are tight." Continue rendering.
- Tests in __tests__/phase-4-6-b.test.js

### 4.6.c — Empty state + "Ship coming alive" transition
- EmptyState component renders when no project loaded or project is
  blank with no layers AND no action taken
- Empty state shows:
  - Canvas placeholder (ghostly 1280x720 frame with subtle border)
  - Centered text: "Upload to set sail"
  - Below in smaller text: "or start blank →"
  - Sailship logo top-left, watermark opacity (15%)
  - Faint starfield (dark) or water ripple (light)
  - NO tool palette, NO contextual panel, NO layer panel, NO ship it
    button, NO save indicator
- Upload triggers: file input, drag-and-drop anywhere in editor area,
  paste from clipboard
- "Start blank" creates empty canvas — zero default layers
- On upload OR start blank: trigger ship-coming-alive sequence ONCE per
  session. Session = per tab. Same tab reopening same project = no
  replay. New tab = replay.
- Sequence timing (1200ms total):
  - 0ms: uploaded image lands on canvas with 150ms fade + scale from
    0.96 to 1.0 (or canvas just appears blank if start-blank)
  - 200ms: tool palette tools unfurl from left edge. Each tool fades in
    + slides 20px right over 200ms. 40ms stagger between tools.
  - 600ms: right contextual panel slides in from right edge over 300ms
  - 700ms: bottom layer panel rises from below over 300ms
  - 800ms: background brightens subtly (opacity tween)
  - 900ms: "Ship it" button fades in over 200ms
  - 1000ms: pen save indicator appears in top bar
  - 1100ms: settle. Session flag sets.
- Session flag stored in sessionStorage, not localStorage
- Soft whoosh sound: optional, off by default. Setting toggle in
  settings dropdown.
- Tests in __tests__/phase-4-6-c.test.js

### 4.6.d — Tool palette (left)
- Vertical strip, 48px wide
- Lucide icons only, 20-24px
- Always visible, collapsible via chevron at top (collapsed = 12px wide
  with just chevron)
- Hover state: 102% scale + brightness(1.15)
- Active state: cream-accent glow (box-shadow), icon tinted cream
- Tooltip on hover: small popover with label + keyboard shortcut
- Tool groups with subtle dividers:
  1. Selection: move, lasso, wand, SAM click-to-select
  2. Shapes: rectangle, circle, polygon, star, arrow, line, speech
     bubble
  3. Paint: brush, eraser, dodge, burn, sponge, blur, sharpen, smudge,
     clone, spot heal, light painting
  4. Text
  5. Crop
  6. Hand, zoom

Mandatory tooltip strings (in copy file):
- Brush: "Brush [B]"
- Erase: "Erase the deck [E]"
- Text: "Text [T]"
- Magic wand: "Magic wand [W]"
- Crop: "Crop [C]"
- Hand: "Hand [H]"
- Zoom: "Zoom [Z]"
- SAM select: "Click to select [S]"
- All other tools: plain label + shortcut. No forced metaphor.

Tests in __tests__/phase-4-6-d.test.js

### 4.6.e — Contextual panel (right) + Layer panel (bottom)

Contextual panel, 320px wide (240px at tablet breakpoint):
- Mutates based on selection
- Empty selection: canvas settings (dimensions, background color,
  guides toggle, theme toggle shortcut)
- Image layer: properties + AI actions
- Text layer: full typography
- Shape layer: fill, stroke, gradient, corner radius
- Adjustment layer: adjustment controls
- Multi-select: alignment + group
- Group: group properties + nested list
- All numeric fields drag-to-scrub
- Custom color picker (react-colorful + recent swatches + eyedropper)
- Advanced sections collapsed by default

Layer panel, horizontal strip at bottom, 120px tall default,
collapsible:
- Each layer: thumbnail, name, type icon, visibility eye, lock, blend
  mode badge (when not Normal), opacity slider
- Click select, shift+click range, cmd+click multi
- Double-click name to rename inline
- Drag to reorder
- Right-click menu: duplicate, delete, group, ungroup, add mask, add
  effects, convert to smart object
- Groups show expand/collapse chevron
- Mask thumbnail beside layer thumbnail when mask exists
- Empty state (zero layers, post-transition only): centered small text
  "Drop something here, or add from the toolbar." Disappears when any
  layer exists.

Tests in __tests__/phase-4-6-e.test.js

### 4.6.f — Top bar + "Ship it" button + save indicator + settings

Top bar layout (left to right):
- Sailship logo (static, 24px tall, always visible after ship-alive
  transition)
- Project name (click to rename inline, Geist font, 16px)
- Save indicator: pen writing icon. Pen icon tilts and moves ~3px side
  to side during save, rests flat when saved. Loop 400ms. Text beside
  it in Geist 12px: "Logging..." while saving, "Logged" when saved.
- Settings icon (gear)
- Theme toggle (moon in dark mode, sun in light mode)
- "Ship it" button

"Ship it" button spec (non-negotiable):
- Background: --accent-cream in dark mode, --accent-navy in light mode
- Text color: deep navy in dark mode, cream in light mode
- Slightly larger than neighboring icon buttons (padding: 10px 18px)
- Small sail icon on the left of the text
- Hover animation: scale 1.0 → 1.03 → 1.0 over 800ms ease-in-out,
  looping infinitely while hovered. Brightness subtly shifts with scale.
- Click opens dropdown:
  - Ship it as PNG
  - Ship it as JPEG
  - Ship it for YouTube (1280×720 JPEG, sRGB, under 2MB, optimized for
    upload)
  - Ship it in 4K (Pro only — shows lock icon for free users, clicking
    opens upgrade modal)
- Keyboard shortcut: Cmd/Ctrl+E opens dropdown, Enter defaults to "Ship
  it as PNG"

Settings dropdown (anchored to gear icon):
- Theme toggle (matches theme icon in top bar)
- Sound effects on/off
- Keyboard shortcuts reference (opens modal)
- Account settings (links to /settings)
- Sign out

Sailship logo appears ONLY in the top-left of the editor. Do not use
sailship visuals anywhere else in the UI. The brand mark is singular
inside the editor.

Tests in __tests__/phase-4-6-f.test.js

### 4.6.g — Command palette + keyboard shortcuts

Command palette (⌘K):
- cmdk library
- Centered modal, 600px wide, 400px max height
- 150ms scale-in animation (scale 0.96 → 1.0, opacity 0 → 1)
- Fuzzy search across: actions, tools, templates, layers, settings,
  recent files
- Keyboard shortcuts shown on every row (teach shortcuts passively)
- Recent actions promoted to top
- Categories: Actions, Templates, Layers, Navigate, Tools, Settings
- ⌘K opens, Esc closes, arrows navigate, Enter executes

Keyboard shortcuts (register via tinykeys):
- V: Move tool
- B: Brush
- E: Eraser
- T: Text
- W: Magic wand
- L: Lasso
- S: SAM select
- C: Crop
- H: Hand
- Z: Zoom
- R: Rectangle
- O: Ellipse (circle)
- ⌘Z: Undo
- ⌘Shift+Z: Redo
- ⌘S: Manual save (force flush)
- ⌘E: Open Ship it dropdown
- ⌘D: Deselect
- ⌘A: Select all
- ⌘G: Group selected
- ⌘Shift+G: Ungroup
- Delete/Backspace: Delete selected layer
- Esc: Deselect / close panels / cancel operations

Tests in __tests__/phase-4-6-g.test.js

### 4.6.h — Polish pass

- Central copy file at src/editor-v2/ui/copy.js with every visible
  string, organized by component
- Audit every string for voice compliance (see Voice Rules below)
- Motion audit: every animation matches the motion tokens, no ad-hoc
  durations
- Accessibility pass: keyboard nav works end to end, focus rings visible
  but subtle (cream accent outline, 2px)
- Screen reader labels on every icon-only button
- No layout shift on theme switch
- Performance check: cockpit loads in under 500ms after Phase 4.5
  foundation
- Window resize stress test: panels gracefully adapt at every breakpoint
  from 1024px to 2560px
- Tablet behavior: touch events on tool palette still register (basic
  click works, no custom touch optimization)

Final commit: "feat(editor-v2): phase 4.6 complete — UI rebuild"

## Voice Rules (apply to every string in copy.js)

- Direct address: "you" — never "we"
- Technical but warm
- Short, action-oriented
- Playful only where it fits naturally (Erase the deck, Ship it)
- Never lies (CTR score, feedback all honest)
- Never apologizes, never infantilizes

Banned words:
- "Oops!"
- "Sorry!"
- "Welcome back, user"
- "AI-powered" (outside marketing)
- Generic marketer-speak

"Export" is replaced with "Ship it" everywhere in UI copy.

## What this rebuild must NOT be

- Canva clone with panels everywhere
- Photoshop with a dark skin
- AI-chatbot-forward (ThumbFriend is a side piece, not hero of UI)
- Corporate or bland
- Overwhelming (calm is default)
- Themed-childish (hint the sailboat, don't paint rope on things)
- Forced metaphor (use plain tool names when sailor names don't fit)

## Success criteria

1. First-time user uploads an image, sees ship come alive, doesn't
   reflexively skip the animation on second visit
2. Returning user drops image and is editing within 5 seconds
3. A 30-minute editing session doesn't feel overwhelming
4. "Ship it" is the first button users reach for when done (no hunting)

## AUTONOMY RULES

- Do not ask permission during Phase 4.6
- Make judgment calls on animation curves, icon choices, micro-spacing
  — log them in this file
- Install cmdk, tinykeys, react-colorful, @dnd-kit/core, @dnd-kit/
  sortable if not already installed (research-approved)
- Do not install animation libraries beyond what's already in project
  (use CSS transitions + requestAnimationFrame for the 1.2s transition)
- Stop only on: Phase 4.6 complete, 3 failed fix attempts (log in Stuck),
  or destructive unrecoverable decision (log in Blocked)

## Blocked
(empty)

## Stuck
(empty)

## Commits made
(populate as you go)
