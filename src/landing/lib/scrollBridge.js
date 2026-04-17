// Bridge between the drei <ScrollControls> inside the R3F Canvas and HTML
// overlays that live outside it. The Canvas writes the current scroll offset
// (0..1) and container element via setters; overlays read imperatively from
// requestAnimationFrame loops (avoids re-rendering React every frame).

let currentOffset = 0;
let scrollEl = null;

export function setScrollOffset(v) {
  currentOffset = v;
}

export function getScrollOffset() {
  return currentOffset;
}

export function setScrollEl(el) {
  scrollEl = el;
}

export function getScrollEl() {
  return scrollEl;
}

// Scroll the drei container (not the window) forward by one viewport height.
// Used by "See the galaxy ↓" to advance one scene.
export function scrollByViewport() {
  if (scrollEl && typeof scrollEl.scrollBy === 'function') {
    scrollEl.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
  } else {
    // Fallback for environments without the drei container wired yet.
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
  }
}
