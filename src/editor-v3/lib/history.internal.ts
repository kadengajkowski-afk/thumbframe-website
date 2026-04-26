import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch,
} from "immer";
import { useDocStore } from "@/state/docStore";
import type { Layer } from "@/state/types";

/** Day 15 split — shared internals for the history machinery. Both
 * lib/history.ts (the public API) and lib/history.text.ts (the text/
 * effect setters) import from here so neither has to import the
 * other (the original split created a circular import that Vite's
 * strict ESM resolution couldn't unwrap — consumers got "does not
 * provide an export named 'history'" until module evaluation
 * completed). One module owns the stacks + commit/mutate; the two
 * surface modules just call in. */

enablePatches();

const MAX_HISTORY = 100;

type Entry = {
  patches: Patch[];
  inverse: Patch[];
  label: string;
};

// Stacks live at module scope: one editor instance per tab, and
// Zustand is the only source of document truth — the stacks just
// replay patches against docStore. No parallel state, no globals.
let undoStack: Entry[] = [];
let redoStack: Entry[] = [];

// Stroke coalescing: `beginStroke` captures the layer-list snapshot;
// any history setters called while a stroke is open mutate docStore
// directly (no undo entry per tick). `endStroke` pushes ONE entry
// covering the full delta.
let openStroke: { label: string; startLayers: Layer[] } | null = null;

function setLayers(next: Layer[]) {
  useDocStore.setState({ layers: next });
}

export function commit(label: string, mutator: (draft: Layer[]) => void) {
  const current = useDocStore.getState().layers;
  const [next, patches, inverse] = produceWithPatches(current, mutator);
  if (patches.length === 0) return;
  setLayers(next);
  undoStack.push({ patches, inverse, label });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

/** Used during an open stroke — applies the change to docStore
 * without pushing anything onto the history stacks. */
export function mutate(mutator: (draft: Layer[]) => void) {
  const current = useDocStore.getState().layers;
  const [next] = produceWithPatches(current, mutator);
  setLayers(next);
}

export function isStrokeOpen(): boolean {
  return openStroke !== null;
}

export function beginStroke(label: string) {
  if (openStroke) return;
  openStroke = { label, startLayers: useDocStore.getState().layers };
}

export function endStroke() {
  if (!openStroke) return;
  const { label, startLayers } = openStroke;
  const endLayers = useDocStore.getState().layers;
  openStroke = null;
  if (startLayers === endLayers) return;
  // Coarse patch: replace the full layer list. Fine for now; per-
  // field patches can come later if perf matters.
  const patches: Patch[] = [{ op: "replace", path: [], value: endLayers }];
  const inverse: Patch[] = [{ op: "replace", path: [], value: startLayers }];
  undoStack.push({ patches, inverse, label });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

export function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  setLayers(applyPatches(useDocStore.getState().layers, entry.inverse));
  redoStack.push(entry);
}

export function redo() {
  const entry = redoStack.pop();
  if (!entry) return;
  setLayers(applyPatches(useDocStore.getState().layers, entry.patches));
  undoStack.push(entry);
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}
export function canRedo(): boolean {
  return redoStack.length > 0;
}

/** Test hook: wipe stacks + reset docStore. Do not call in prod. */
export function _resetInternals() {
  undoStack = [];
  redoStack = [];
  openStroke = null;
  setLayers([]);
}
