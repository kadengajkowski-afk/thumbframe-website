// src/editor/engine/FilterScaler.js
// Scales PixiJS filter resolution down during interaction (drag/resize/rotate)
// to maintain 60fps. Restores full resolution on idle.
// Registered on window.__filterScaler so the Zustand store action can call it.

const INTERACTION_RESOLUTION = 0.5;
const FULL_RESOLUTION = 1.0;

class FilterScaler {
  constructor() {
    this.trackedFilters = new Map(); // layerId -> Filter[]
    this.isScaled = false;
  }

  registerLayer(layerId, filters) {
    if (!filters || filters.length === 0) return;
    this.trackedFilters.set(layerId, [...filters]);
  }

  unregisterLayer(layerId) {
    this.trackedFilters.delete(layerId);
  }

  scaleDown() {
    if (this.isScaled) return;
    this.isScaled = true;
    for (const [, filters] of this.trackedFilters) {
      for (const filter of filters) {
        filter._savedResolution = filter.resolution ?? FULL_RESOLUTION;
        filter.resolution = INTERACTION_RESOLUTION;
      }
    }
  }

  restoreFullResolution() {
    if (!this.isScaled) return;
    this.isScaled = false;
    for (const [, filters] of this.trackedFilters) {
      for (const filter of filters) {
        filter.resolution = filter._savedResolution ?? FULL_RESOLUTION;
        delete filter._savedResolution;
      }
    }
  }
}

export const filterScaler = new FilterScaler();
// Expose globally so Store.js setInteractionMode can call it without a circular import
window.__filterScaler = filterScaler;

export default FilterScaler;
