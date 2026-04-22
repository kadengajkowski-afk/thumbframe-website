// src/editor-v2/engine/TexturePool.js
// -----------------------------------------------------------------------------
// Purpose:  Track GPU textures by a stable key (layer id) and evict the least-
//           recently-used entries when the pool exceeds its byte budget. Also
//           acts as the re-upload cache after a WebGL context loss — the
//           Renderer asks the pool for a source canvas/bitmap to rehydrate
//           the texture.
// Exports:  TexturePool class
// Depends:  pixi.js (Texture.destroy)
//
// v1 had a separate TextureMemoryManager singleton bound to window. This
// one is a plain class owned by the Renderer. No globals, no singletons,
// no side effects at import time.
// -----------------------------------------------------------------------------

const DEFAULT_BUDGET_BYTES = 300 * 1024 * 1024; // 300 MB

/**
 * Entry stored per key.
 * @typedef {Object} PoolEntry
 * @property {import('pixi.js').Texture} texture
 * @property {number} bytes          - Estimated RGBA8 bytes (w*h*4)
 * @property {number} lastUsed       - performance.now() timestamp
 * @property {HTMLCanvasElement|OffscreenCanvas|ImageBitmap|null} source
 *                                   - Original pixel source, retained for
 *                                     texture rehydration after context loss
 */

export class TexturePool {
  /**
   * @param {{ budgetBytes?: number, onWarn?: (usage: { bytesInUse: number }) => void }} [opts]
   */
  constructor({ budgetBytes = DEFAULT_BUDGET_BYTES, onWarn = null } = {}) {
    /** @type {Map<string, PoolEntry>} */
    this._entries = new Map();
    this._bytesInUse = 0;
    this._budgetBytes = budgetBytes;
    this._onWarn = onWarn;
  }

  /**
   * Register a texture under a stable key. Replaces any existing entry for
   * that key (destroying the old texture).
   *
   * @param {string} key
   * @param {import('pixi.js').Texture} texture
   * @param {number} width
   * @param {number} height
   * @param {HTMLCanvasElement|OffscreenCanvas|ImageBitmap|null} [source]
   */
  register(key, texture, width, height, source = null) {
    const existing = this._entries.get(key);
    if (existing) {
      this._bytesInUse -= existing.bytes;
      try { existing.texture.destroy(true); } catch { /* already gone */ }
    }
    const bytes = Math.max(1, (width | 0) * (height | 0) * 4);
    this._entries.set(key, {
      texture,
      bytes,
      lastUsed: performance.now(),
      source,
    });
    this._bytesInUse += bytes;
    this._maybeEvict();
  }

  /** @param {string} key */
  touch(key) {
    const e = this._entries.get(key);
    if (e) e.lastUsed = performance.now();
  }

  /** @param {string} key @returns {import('pixi.js').Texture | null} */
  get(key) {
    const e = this._entries.get(key);
    if (!e) return null;
    e.lastUsed = performance.now();
    return e.texture;
  }

  /** @param {string} key @returns {PoolEntry['source']} */
  getSource(key) {
    return this._entries.get(key)?.source ?? null;
  }

  /** @param {string} key */
  release(key) {
    const e = this._entries.get(key);
    if (!e) return;
    this._bytesInUse -= e.bytes;
    try { e.texture.destroy(true); } catch { /* noop */ }
    this._entries.delete(key);
  }

  /** Forget all GPU resources (typically after context loss before rehydration). */
  clearGPU() {
    for (const entry of this._entries.values()) {
      try { entry.texture.destroy(true); } catch { /* noop */ }
    }
  }

  /** Wipe the pool entirely. */
  clear() {
    this.clearGPU();
    this._entries.clear();
    this._bytesInUse = 0;
  }

  /** @returns {{ bytesInUse: number, budgetBytes: number, entryCount: number }} */
  stats() {
    return {
      bytesInUse: this._bytesInUse,
      budgetBytes: this._budgetBytes,
      entryCount: this._entries.size,
    };
  }

  /** Iterate sources in LRU order (oldest first) — used for context-loss rehydration. */
  *sourcesLRU() {
    const sorted = [...this._entries.entries()]
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, entry] of sorted) {
      if (entry.source) yield { key, source: entry.source };
    }
  }

  /** @private */
  _maybeEvict() {
    if (this._bytesInUse <= this._budgetBytes) return;
    if (this._onWarn) {
      try { this._onWarn({ bytesInUse: this._bytesInUse }); } catch { /* noop */ }
    }
    // Evict LRU until under budget.
    const sorted = [...this._entries.entries()]
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, entry] of sorted) {
      if (this._bytesInUse <= this._budgetBytes) break;
      this._bytesInUse -= entry.bytes;
      try { entry.texture.destroy(true); } catch { /* noop */ }
      this._entries.delete(key);
    }
  }
}
