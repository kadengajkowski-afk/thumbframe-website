# editor-v2 — Phase 0 Foundation

This directory holds the rebuild-from-scratch editor. It runs alongside
`src/editor/` (v1) and is never imported by v1 code. Gated behind the
`editor_version` field on `profiles` (values `v1` | `v2`). Dev override
via `?editor=v2` query param.

**Status:** Phase 0 — foundation. No tools, no UI. A blank canvas, a
working store, a working save engine, a working undo/redo.

## Directory layout

```
editor-v2/
  EditorV2.jsx          entry component, mounts renderer + wires subsystems
  flag.js               useEditorVersion() hook
  engine/
    Renderer.js         PixiJS v8 app, dirty-driven render, context-loss recovery
    TexturePool.js      LRU texture pool with byte budget
    Layer.js            JSDoc typedefs for the layer schema (no runtime)
    layerFactory.js     createLayer() — the single source of layer shape
  store/
    Store.js            Zustand v5 + immer, all mutations via actions
  save/
    idb.js              IndexedDB wrapper (projects, snapshots, queue)
    SaveEngine.js       3s debounce, IDB-first, Railway sync, offline queue
  history/
    History.js          snapshot-based undo/redo + version history
  actions/
    registry.js         action registry + foundation action set
```

## Dev surface

One intentional global: `window.__v2 = { store, renderer, save, history, actions }`. Only populated when EditorV2 is mounted, deleted on unmount. Use from DevTools during development. No production code reads from it.

### Cheat sheet

```js
// Inspect current state
window.__v2.store.getState()

// Add a test layer (uses the action registry → history snapshots → save)
window.__v2.actions.executeAction('layer.add', { name: 'Test' })

// Undo / redo
window.__v2.actions.executeAction('history.undo')
window.__v2.actions.executeAction('history.redo')

// Force a save
window.__v2.save.saveImmediate()

// See every registered action
window.__v2.actions.listActions()
```

## Architecture rules (non-negotiable)

1. **No `window.__*` globals** beyond the single `__v2` dev surface.
2. **All mutations go through actions** on the store (or through the
   action registry, which calls the store). No `useStore.setState()`
   from outside the store file.
3. **Layer shape is owned by `layerFactory.js`**. If a new field is
   needed, it goes in the factory first. Consumer code never stamps
   partial layers with fields not in the factory.
4. **Renderer has no knowledge of the network.** It only reads the
   store and renders. Save/load is SaveEngine's job.
5. **SaveEngine has no knowledge of PixiJS.** It only knows about the
   store and IDB and the Railway API.
6. **History is independent of save.** History snapshots are the undo
   stack; they happen to persist in IDB but they're not the same thing
   as the save system.
