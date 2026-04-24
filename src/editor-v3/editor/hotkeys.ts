import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";

// Per CLAUDE.md: exactly ONE global keydown listener for the whole editor.
// v1 had four overlapping listeners; that was a steady source of bugs.

let installed = false;

export function installHotkeys() {
  if (installed) return () => {};
  installed = true;
  window.addEventListener("keydown", handleKeydown);
  return () => {
    window.removeEventListener("keydown", handleKeydown);
    installed = false;
  };
}

function handleKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return;

  const meta = e.metaKey || e.ctrlKey;

  // Undo / redo — Cmd+Z, Cmd+Shift+Z. Cmd+Y also redoes on Windows habit.
  if (meta && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) history.redo();
    else history.undo();
    return;
  }
  if (meta && e.key.toLowerCase() === "y") {
    e.preventDefault();
    history.redo();
    return;
  }

  // Delete / Backspace — drop the selected layer.
  if (e.key === "Delete" || e.key === "Backspace") {
    const id = useUiStore.getState().selectedLayerId;
    if (!id) return;
    e.preventDefault();
    history.deleteLayer(id);
    useUiStore.getState().setSelectedLayerId(null);
    return;
  }

  // Escape clears selection.
  if (e.key === "Escape") {
    if (useUiStore.getState().selectedLayerId) {
      e.preventDefault();
      useUiStore.getState().setSelectedLayerId(null);
    }
    return;
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
