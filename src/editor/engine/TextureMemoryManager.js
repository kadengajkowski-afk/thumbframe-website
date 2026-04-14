// src/editor/engine/TextureMemoryManager.js
// Tracks GPU texture memory usage across all image layers.
// Fires 'tf-memory-warning' CustomEvent when usage is high.
// Auto-evicts hidden (off-screen) textures when CRITICAL threshold is reached.
// Registered as window.__textureMemoryManager for use by Renderer.

const WARNING_THRESHOLD  = 200 * 1024 * 1024; // 200 MB
const CRITICAL_THRESHOLD = 350 * 1024 * 1024; // 350 MB

class TextureMemoryManager {
  constructor() {
    // layerId → { texture, width, height, bytes, visible, lastViewed }
    this.textures = new Map();
    this._warningDispatched = false;
  }

  // ── Register a newly created texture ────────────────────────────────────────
  register(layerId, texture, width, height) {
    const bytes = (width || 1) * (height || 1) * 4; // RGBA
    this.textures.set(layerId, {
      texture,
      width,
      height,
      bytes,
      visible: true,
      lastViewed: Date.now(),
    });
    this._checkThresholds();
  }

  // ── Unregister when layer is deleted ────────────────────────────────────────
  unregister(layerId) {
    this.textures.delete(layerId);
  }

  // ── Notify manager of visibility changes ────────────────────────────────────
  setVisibility(layerId, visible) {
    const entry = this.textures.get(layerId);
    if (!entry) return;
    entry.visible = visible;
    if (visible) {
      entry.lastViewed = Date.now();
      this._checkThresholds();
    }
  }

  // ── Get current memory statistics ───────────────────────────────────────────
  getUsage() {
    let totalBytes = 0;
    let hiddenCount = 0;
    for (const entry of this.textures.values()) {
      totalBytes += entry.bytes;
      if (!entry.visible) hiddenCount++;
    }
    return {
      totalMB:      totalBytes / 1024 / 1024,
      textureCount: this.textures.size,
      hiddenCount,
      isWarning:    totalBytes >= WARNING_THRESHOLD,
      isCritical:   totalBytes >= CRITICAL_THRESHOLD,
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────────
  _checkThresholds() {
    const { isWarning, isCritical } = this.getUsage();

    if (isCritical) {
      this._evictHiddenTextures();
    }

    // Dispatch warning once per crossing (re-arms when usage drops below threshold)
    if (isWarning && !this._warningDispatched) {
      this._warningDispatched = true;
      const { totalMB } = this.getUsage();
      window.dispatchEvent(new CustomEvent('tf-memory-warning', { detail: { totalMB } }));
    } else if (!isWarning) {
      this._warningDispatched = false;
    }
  }

  // Evict hidden textures from GPU, oldest-viewed first, until below CRITICAL
  _evictHiddenTextures() {
    const hidden = [...this.textures.entries()]
      .filter(([, e]) => !e.visible)
      .sort(([, a], [, b]) => a.lastViewed - b.lastViewed);

    for (const [layerId, entry] of hidden) {
      try {
        // Destroy texture from GPU — keepBitmap=false
        entry.texture.destroy(true);
      } catch (_) {
        // Texture may already be destroyed
      }
      this.textures.delete(layerId);

      const { isCritical } = this.getUsage();
      if (!isCritical) break;
    }
  }
}

// ── Singleton — registered on window for Renderer access ─────────────────────
const textureMemoryManager = new TextureMemoryManager();
window.__textureMemoryManager = textureMemoryManager;

export default textureMemoryManager;
