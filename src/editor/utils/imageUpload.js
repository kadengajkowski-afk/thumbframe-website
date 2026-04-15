// src/editor/utils/imageUpload.js
// Full image upload pipeline — non-blocking by design.
//
// Flow:
//   validate → add placeholder layer → createImageBitmap (off-thread) →
//   downscale if needed → draw into OffscreenCanvas → ImageSource → Texture →
//   update layer → store in IndexedDB → commitChange
//
// OffscreenCanvas is used exclusively for texture creation — it is never a DOM
// element and cannot appear in the page outside the PixiJS canvas.
//
// The placeholder layer (loading: true) appears instantly so the user
// sees something happen before the potentially-slow decode completes.

import { Texture, ImageSource } from 'pixi.js';
import useEditorStore from '../engine/Store';

// ── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W         = 1280;
const CANVAS_H         = 720;
const MAX_FILE_SIZE    = 50  * 1024 * 1024;  // 50 MB
const MAX_DIMENSION    = 4096;               // downscale above this
const ABSOLUTE_MAX     = 16384;              // hard reject above this
const MAX_PIXELS       = 100 * 1024 * 1024;  // 100 MP

const SUPPORTED_TYPES  = new Set([
  'image/png', 'image/jpeg', 'image/webp',
  'image/gif', 'image/svg+xml', 'image/heic',
  'image/avif', 'image/bmp',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────
function dispatchToast(message) {
  window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message } }));
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function generateId() {
  return crypto.randomUUID?.() ||
    (Date.now().toString(36) + Math.random().toString(36).slice(2));
}



// ── IndexedDB helpers ─────────────────────────────────────────────────────────
let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('thumbframe-originals', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images');
      }
    };
    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = (e) => reject(e.target.error);
  });
}

export async function storeOriginalInDB(layerId, file) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('images', 'readwrite');
      tx.objectStore('images').put(file, layerId);
      tx.oncomplete = resolve;
      tx.onerror    = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn('[imageUpload] IndexedDB store failed:', err);
  }
}

export async function getOriginalFromDB(layerId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction('images', 'readonly');
      const req = tx.objectStore('images').get(layerId);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn('[imageUpload] IndexedDB get failed:', err);
    return null;
  }
}

// ── Main upload pipeline ──────────────────────────────────────────────────────
export async function processImageFile(file) {
  if (!file) return;

  // ── Step 1: Validate before reading ────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    const mb = Math.round(file.size / 1024 / 1024);
    dispatchToast(`Image is too large (${mb}MB). Maximum file size is 50MB.`);
    return;
  }

  if (!SUPPORTED_TYPES.has(file.type)) {
    const ext = (file.name.split('.').pop() || 'unknown').toLowerCase();
    dispatchToast(
      `Unsupported file format (.${ext}). ThumbFrame supports PNG, JPEG, WebP, GIF, SVG, HEIC, and AVIF.`
    );
    return;
  }

  if (file.type === 'image/heic' && !isSafari()) {
    dispatchToast('HEIC images are only supported in Safari. Please convert to PNG or JPEG first.');
    return;
  }

  // ── Step 2: Add placeholder layer immediately ───────────────────────────────
  const layerId  = generateId();
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'Image';

  useEditorStore.getState().addLayerSilent({
    id:        layerId,
    name:      baseName,
    type:      'image',
    loading:   true,
    x:         CANVAS_W / 2,
    y:         CANVAS_H / 2,
    width:     320,
    height:    180,
    imageData: null,
  });

  try {
    // ── SVG: load via <img> (never appended to DOM) → OffscreenCanvas → texture ──
    // OffscreenCanvas is never part of the DOM — PixiJS cannot accidentally append it.
    if (file.type === 'image/svg+xml') {
      const src = URL.createObjectURL(file);
      let svgTexture;
      try {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = src;
        });
        const w = img.naturalWidth  || CANVAS_W;
        const h = img.naturalHeight || CANVAS_H;
        const oc = new OffscreenCanvas(w, h);
        oc.getContext('2d').drawImage(img, 0, 0);
        // img goes out of scope here — never appended to DOM, will be GC'd
        const source = new ImageSource({ resource: oc });
        svgTexture = new Texture({ source });
      } catch (err) {
        URL.revokeObjectURL(src);
        useEditorStore.getState().removeLayerSilent(layerId);
        dispatchToast('Could not open this image. The file may be corrupted or in an unrecognized format.');
        return;
      }
      // Pre-register texture in renderer cache BEFORE updateLayer so the first
      // sync() after upload has it available and undo/redo can recover it.
      if (window.__renderer) {
        window.__renderer.textureCache.set(layerId, svgTexture);
      }
      useEditorStore.getState().updateLayer(layerId, {
        loading:   false,
        texture:   svgTexture,
        x:         CANVAS_W / 2,
        y:         CANVAS_H / 2,
        width:     CANVAS_W,
        height:    CANVAS_H,
        imageData: { src, originalWidth: CANVAS_W, originalHeight: CANVAS_H, textureWidth: CANVAS_W, textureHeight: CANVAS_H, mask: null, cropRect: null },
      });
      storeOriginalInDB(layerId, file).catch(() => {});
      useEditorStore.getState().commitChange(`Add Image '${baseName}'`);
      return;
    }

    // ── Step 3: Decode off-thread with createImageBitmap (dimensions only) ──
    let probeBitmap;
    try {
      probeBitmap = await createImageBitmap(file);
    } catch (err) {
      useEditorStore.getState().removeLayerSilent(layerId);
      dispatchToast('Could not open this image. The file may be corrupted or in an unrecognized format.');
      return;
    }

    const origW = probeBitmap.width;
    const origH = probeBitmap.height;
    probeBitmap.close(); // Only needed dimensions — free immediately

    // Validate absolute size limits
    if (origW > ABSOLUTE_MAX || origH > ABSOLUTE_MAX) {
      useEditorStore.getState().removeLayerSilent(layerId);
      dispatchToast(`This image is too large to process (${origW}×${origH}). Maximum is 16384×16384.`);
      return;
    }

    if (origW * origH > MAX_PIXELS) {
      useEditorStore.getState().removeLayerSilent(layerId);
      dispatchToast(`Image has too many pixels (${origW}×${origH}). Maximum is 100 megapixels.`);
      return;
    }

    // ── Step 4: Decode final bitmap (downscaling off-thread if needed) ──────────
    let finalW = origW;
    let finalH = origH;
    let finalBitmap;

    if (origW > MAX_DIMENSION || origH > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / origW, MAX_DIMENSION / origH);
      finalW = Math.round(origW * scale);
      finalH = Math.round(origH * scale);
      finalBitmap = await createImageBitmap(file, {
        resizeWidth:   finalW,
        resizeHeight:  finalH,
        resizeQuality: 'high',
      });
    } else {
      finalBitmap = await createImageBitmap(file);
    }

    // ── Step 5a: Draw bitmap into an OffscreenCanvas → PixiJS texture ───────────
    // OffscreenCanvas is NEVER a DOM element — it cannot be appended to the page
    // and PixiJS cannot accidentally render it outside the canvas element.
    // This also avoids the "texSubImage2D: source data has been detached" error
    // that occurs when an ImageBitmap is closed before the GPU upload.
    // OffscreenCanvas has no .close() method, so it stays valid indefinitely.
    const oc = new OffscreenCanvas(finalW, finalH);
    oc.getContext('2d').drawImage(finalBitmap, 0, 0);
    finalBitmap.close(); // Safe — pixels are now in the OffscreenCanvas

    const source  = new ImageSource({ resource: oc });
    const texture = new Texture({ source });

    // Pre-register texture in renderer cache BEFORE updateLayer so the first
    // sync() after upload has it available and undo/redo can recover it.
    if (window.__renderer) {
      window.__renderer.textureCache.set(layerId, texture);
    }

    // ── Step 5b: ObjectURL for export / IndexedDB only (NOT passed to PixiJS) ────
    const src = URL.createObjectURL(file);

    // ── Step 6: Scale to fit canvas (cover mode) ─────────────────────────────
    const coverScale = Math.max(CANVAS_W / finalW, CANVAS_H / finalH);
    const scaledW    = Math.round(finalW * coverScale);
    const scaledH    = Math.round(finalH * coverScale);

    // ── Step 7: Update placeholder layer — texture is fully ready ────────────
    useEditorStore.getState().updateLayer(layerId, {
      loading:   false,
      texture,              // PixiJS Texture — used directly by Renderer
      x:         CANVAS_W / 2,
      y:         CANVAS_H / 2,
      width:     scaledW,
      height:    scaledH,
      imageData: {
        src,                // ObjectURL — kept for export / IndexedDB round-trip
        originalWidth:  origW,
        originalHeight: origH,
        textureWidth:   finalW,
        textureHeight:  finalH,
        mask:           null,
        cropRect:       null,
      },
    });

    // ── Step 8: Store original in IndexedDB (non-blocking) ───────────────────
    storeOriginalInDB(layerId, file).catch((err) => {
      console.warn('[imageUpload] Failed to persist original:', err);
    });

    // ── Step 9: Commit history ────────────────────────────────────────────────
    useEditorStore.getState().commitChange(`Add Image '${baseName}'`);

  } catch (err) {
    console.error('[imageUpload] Unexpected error:', err);
    useEditorStore.getState().removeLayerSilent(layerId);
    dispatchToast('Could not open this image. The file may be corrupted or in an unrecognized format.');
  }
}
