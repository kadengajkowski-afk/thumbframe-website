# History System — Design

## The model

**Post-mutation timeline.** The stack is a linear sequence of document
states. The *current* document always equals `_stack[_index]`. Every
action mutates the store first, then appends a snapshot capturing the
new state. Undo/redo just move the cursor through the stack and replay
whatever state lives at the new index.

This is the same model Photoshop, Figma, and every other mature editor
uses. The previous design snapshotted *before* the mutation, which made
redo structurally impossible because post-mutation states were never
captured anywhere.

## Data shape

```
SnapshotRecord = {
  id:        string              // UUID
  projectId: string              // stable project key (IDB foreign key)
  timestamp: number              // Unix ms, for display
  label:     string              // past-tense, user-readable
  state: {
    projectId:   string | null
    projectName: string
    layers:      Layer[]          // full array, JSON-serialisable
  }
}
```

Layers are serialised as plain JSON. Non-serialisable fields (PixiJS
textures, transient `_preEditContent` edit markers) are never stored in
`state.layers` — they live on the live store objects and are rebuilt
from the layer's `imageData.src` / `textData` / `shapeData` on restore.

## Invariants

These MUST all hold at rest. If any one is broken, undo/redo misbehaves.

**I-1. Stack index points at the live state.**
`_stack[_index]` is always equal to the current store document
(projectId, projectName, layers). The store and the stack must not
diverge.

**I-2. Every mutation appends a post-mutation snapshot.**
The ordering in every registered action handler is: call store action
first, then `await history.snapshot(label)`. The stack captures what
the store looks like *after* the action ran.

**I-3. Non-mutating actions do NOT snapshot.**
Transient changes (opacity slider drags, selection, visibility toggles,
lock toggles, live text input) go through the store but don't push
history. Snapshotting every slider tick would flood the stack and the
IDB.

**I-4. A seed snapshot exists before any user action.**
On mount, if `_stack` is empty (no prior persisted history), the editor
seeds the stack with one snapshot of the starting state. Without this,
the first undo after a single action would have nowhere to land.

**I-5. Applying a snapshot does not itself push a new snapshot.**
`_apply(snap)` calls `store.replaceAll(snap.state)`. That triggers
subscribers (save engine, renderer) but it does not call
`history.snapshot()`. The index already points at this state.

**I-6. New action after undo truncates the redo future.**
When the user undoes and then performs a new action, the old forward
branch is discarded before the new snapshot is appended. Classic
"branch after undo discards the tail". Already handled by the slice in
`snapshot()`.

## The three flows

### Action

```
user intent → action handler
  1. store.actionX(args)             // mutates; fires subscribers
  2. await history.snapshot(label)   // pushes post-state; fires subscribers again
                                     //   (renderer already handled step 1;
                                     //    save engine sees two changes
                                     //    collapsed by its 3s debounce)
```

### Undo

```
user intent → history.undo()
  1. if _index <= 0 return false     // already at seed, no-op
  2. _index -= 1
  3. _apply(_stack[_index])
     → store.replaceAll(snap.state)
     → subscribers fire exactly once
     → renderer reconciles store.layers, disposing/rebuilding as needed
     → save engine schedules a debounced save of the restored state
```

### Redo

```
user intent → history.redo()
  1. if _index >= _stack.length - 1 return false   // nothing newer
  2. _index += 1
  3. _apply(_stack[_index])
     → identical path to undo
```

## Group topology × history interaction

This is the area where bugs kept landing. The interaction has three
actors: **store.layers** (flat array with parent/child refs),
**history stack** (JSON snapshots of the array), and **renderer
`_layerStates`** (Map of id → live PixiJS display object).

### The topology rule

A layer whose id appears in some group's `groupData.childIds` is a
*child layer*. It still lives in the flat `store.layers` array — but
its display object is parented to the group's Container in the scene
graph, not to the top-level `_layerContainer`.

### What changes on undo of `group.create`

Before undo:
- `store.layers = [s1, s2, ..., group]` with `group.groupData.childIds = [s1.id, s2.id]`
- `_layerStates` has entries for every layer, including `group`.
- PixiJS parenting: `_layerContainer > [s3, s4, ..., group > [s1, s2]]`

After `history.undo()`:
- `store.replaceAll(prevSnap.state)` sets `store.layers = [s1, s2, ...]`, group gone.
- Renderer subscribes to store and marks dirty → `_sync()` runs.
- Step 2 of sync sees `group` is not in the new `layers` array → calls `_disposeLayer(group.id)`.
- **Danger point:** PixiJS `Container.destroy({ children: true })` cascade-destroys every descendant. Those descendants (s1, s2's sprites) are referenced by `_layerStates[s1.id].obj` and `_layerStates[s2.id].obj`. If we cascade, those refs become pointers to destroyed PixiJS objects whose `position` / `scale` / etc. are null'd. Next reconciliation crashes.

### Renderer invariant for disposal

**I-7. Before destroying a Container, detach any of its children that
are themselves tracked in `_layerStates`.**

Implementation: `_disposeLayer(id)` builds a `Set` of tracked objects
(excluding the one being disposed), filters the container's children
for membership, and `removeChild`-es them *before* calling
`destroy({ children: true })`. The inner Graphics that a shape wrapper
owns is *not* tracked (we never stored it in `_layerStates`), so it
correctly dies with the wrapper. Group children survive.

After detach + destroy, the surviving children are parentless for one
frame. Step 3 of `_sync` sees them in the top-level list (now that
their parent group is gone from `store.layers`) and re-parents them
into `_layerContainer` via the existing `state.obj.parent !== parent`
check.

### What changes on redo of `group.create`

- `store.replaceAll` adds `group` back to `store.layers`.
- `_sync` runs. Step 3 sees `group` in the top-level list → calls
  `_ensureDisplayObject(group)` → `prev` is undefined because the
  previous dispose removed the `_layerStates` entry → builds a fresh
  empty Container.
- Inside the group-recurse path, each child's state is looked up in
  `_layerStates`. Those survived the prior dispose (I-7), so the refs
  are valid. They get re-parented from `_layerContainer` into the new
  group Container.

### The renderer has NO undo/redo awareness

The renderer doesn't know about history. It only sees store changes
and reconciles. History is just "here's a different set of layers
now" — from the renderer's point of view that's no different from a
user deleting a bunch of layers and adding some new ones. The only
thing that makes the group-undo/redo cycle subtle is the
destroy-cascade invariant I-7.

## Known failure modes (for future reference)

**F-1. Pre-mutation snapshot model.** If an action snapshots before
mutating, the stack holds pre-states and redo can't work. Do not revert
to this model under any circumstance. (Bug repeatedly encountered and
now eliminated.)

**F-2. Destroy cascades into tracked children.** If `_disposeLayer`
skips the detach step and uses `{ children: true }` naively, undoing
any group operation crashes on the next reconciliation. Keep I-7
enforced.

**F-3. Missing seed.** If the stack starts empty and the user performs
one action, the first undo will either be a no-op (good) or — if the
canUndo bounds are off — produce an invalid `_index` (bad). Always
seed on mount.

**F-4. Replay order.** If `_apply` somehow triggered a new snapshot
(e.g., replaceAll was instrumented to auto-snapshot), undo would push
spurious entries and the stack would grow indefinitely. Keep `_apply`
as a pure state-replacement; snapshotting is the action handlers'
responsibility.

**F-5. Partial state in snapshot.** If the snapshot only contained
layers but not `projectName`, an undo after a rename would leave the
name at its post-rename value and the layers at their pre-rename
value — visibly inconsistent. `state` must be a complete document
snapshot.

## Boundaries — what history does NOT cover

- **Selection.** `selectedLayerIds` is transient UI state. Snapshots
  zero it on restore. If a user wants "undo selection" that's a
  separate stack and is out of scope for Phase 1.
- **Viewport / zoom / pan.** Same reasoning — UI state, not document state.
- **Save status.** Status transitions are reactions to snapshots, not
  snapshots themselves.
- **Paint strokes in progress.** Only the end-of-stroke state gets
  snapshotted. Per-stamp snapshots would flood the stack and make
  undo granularity unusable.
- **Texture content.** Image textures aren't in snapshots. On restore,
  the renderer rebuilds sprites from `layer.imageData.src` using the
  texture pool. A future phase (1.b) will handle paint-data restoration
  differently because paint strokes mutate the texture itself.
