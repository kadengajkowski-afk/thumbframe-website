// src/editor-v2/history/CommandHistory.js
// -----------------------------------------------------------------------------
// Purpose:  Patch-based undo/redo for the DocumentStore. Replaces the
//           snapshot-based History.js for the document layer; History.js
//           stays behind the backwards-compat proxy on the Zustand
//           store during the 4.5.b transition commit.
//
// Exports:  CommandHistory class
// Depends:  ../store/DocumentStore
//
// Model (per TECHNICAL_RESEARCH.md):
//   • Each command is { patches, inversePatches, label, ts }.
//   • `mark(label, fn)` produces patches via documentStore.produce(fn)
//     and pushes one command.
//   • `batch(label, fn)` opens a batch — multiple produce() calls
//     accumulate into a single command on commit. Used for gesture
//     windows: one drag = one undo step.
//   • `ignore(fn)` runs mutations without recording them (e.g.
//     fingerprint-only updates).
//   • Linear stack — branching-after-undo discards the tail.
//
// Invariants carried over from history/DESIGN.md:
//   I-1 stack[index] matches the current document state after any
//       seeded or pushed command.
//   I-2 produce() captures POST-mutation state; patches go forward,
//       inversePatches unwind.
//   I-3 undo moves index − 1 and applies inversePatches;
//       redo moves index + 1 and applies patches.
//   I-4 seed() runs once on mount, capturing the initial state as an
//       empty command so undo from the first action has somewhere
//       to land.
//   I-5 applyPatches via applyPatches() does NOT re-record.
//   I-6 No-op produces (zero patches) do NOT push.
//   I-7 Max depth — trim the oldest command when size > max.
// -----------------------------------------------------------------------------

export class CommandHistory {
  /** @param {{ document: import('../store/DocumentStore.js').DocumentStore, max?: number }} opts */
  constructor(opts) {
    this._document = opts.document;
    this._max      = opts.max || 50;
    /** @type {Array<{patches:any[], inversePatches:any[], label:string, ts:number}>} */
    this._stack = [];
    this._index = -1;
    /** Active batch collection. */
    this._batch = null;
  }

  size()         { return this._stack.length; }
  currentIndex() { return this._index; }
  canUndo()      { return this._index > 0; }
  canRedo()      { return this._index >= 0 && this._index < this._stack.length - 1; }

  /** Drop a seed entry so the first real command has an undo target. */
  seed(label = 'Initial state') {
    if (this._stack.length > 0) return;
    this._stack.push({ patches: [], inversePatches: [], label, ts: Date.now() });
    this._index = 0;
  }

  /**
   * Wrap a single mutation producer. Runs it, captures patches,
   * pushes one command. Returns the patch pair.
   *
   * @param {string} label
   * @param {(draft: any) => void} recipe
   */
  mark(label, recipe) {
    if (this._batch) {
      // Inside a batch — delegate to batch accumulator.
      const { patches, inversePatches } = this._document.produce(recipe, { label });
      if (patches.length === 0) return { patches, inversePatches };
      this._batch.patches.push(...patches);
      this._batch.inversePatches.unshift(...inversePatches);   // inverse stacks in reverse
      if (!this._batch.label) this._batch.label = label;
      return { patches, inversePatches };
    }
    const { patches, inversePatches } = this._document.produce(recipe, { label });
    if (patches.length === 0) return { patches, inversePatches };
    this._push({ patches, inversePatches, label, ts: Date.now() });
    return { patches, inversePatches };
  }

  /**
   * Batch many produce() calls into a single undoable command. Call
   * sites:
   *   • beginBatch('Paint stroke')
   *   • addPoint() → documentStore.produce(...)  // via mark
   *   • addPoint() → ...
   *   • endBatch() — pushes one command
   * A gesture window typically wraps this.
   *
   * @param {string} label
   */
  beginBatch(label) {
    if (this._batch) return;
    this._batch = { patches: [], inversePatches: [], label: label || '', ts: Date.now() };
  }

  endBatch() {
    if (!this._batch) return;
    const b = this._batch;
    this._batch = null;
    if (b.patches.length === 0) return;
    this._push(b);
  }

  /**
   * Run a recipe without recording it — for cosmetic / fingerprint-
   * only updates. Still goes through produce so subscribers see it.
   */
  ignore(recipe) {
    this._document.produce(recipe, { label: '__ignore__' });
  }

  async undo() {
    if (!this.canUndo()) return false;
    const entry = this._stack[this._index];
    this._document.applyPatches(entry.inversePatches, { label: `undo:${entry.label}` });
    this._index -= 1;
    return true;
  }

  async redo() {
    if (!this.canRedo()) return false;
    this._index += 1;
    const entry = this._stack[this._index];
    this._document.applyPatches(entry.patches, { label: `redo:${entry.label}` });
    return true;
  }

  /** @private */
  _push(entry) {
    if (this._index < this._stack.length - 1) {
      // Branch after undo — truncate the redo-future.
      this._stack = this._stack.slice(0, this._index + 1);
    }
    this._stack.push(entry);
    this._index = this._stack.length - 1;
    if (this._stack.length > this._max) {
      const drop = this._stack.length - this._max;
      this._stack = this._stack.slice(drop);
      this._index = Math.max(0, this._index - drop);
    }
  }
}
