/** Cycle 6 — module-singleton holding the AbortController for the
 * in-flight Remove.bg request. The BgRemoveSection owns the lifecycle
 * (creates on click, clears on resolve / reject), but the overlay's
 * Cancel button needs access too. One concurrent removal at a time
 * matches the uiStore.bgRemoveInProgress single-flight design. */

let current: AbortController | null = null;

export function setBgRemoveController(c: AbortController | null) {
  current = c;
}

export function cancelBgRemove() {
  current?.abort();
  current = null;
}
