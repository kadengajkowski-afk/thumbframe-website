// src/editor-v2/engine/imageImport.js
// -----------------------------------------------------------------------------
// Purpose:  Safe image-import pipeline. Every user-supplied image
//           (drag-drop, paste, file picker) flows through here. Per
//           TECHNICAL_RESEARCH.md § "iOS Safari memory discipline":
//
//             downsample user uploads to a 4096px cap via
//             createImageBitmap(blob, {resizeWidth, resizeHeight,
//             resizeQuality: 'high'}) which runs off-thread
//
//           Without this gate, 10–20 large thumbnails blow through
//           iOS Safari's ~2GB unified CPU+GPU tab limit and the
//           editor silently corrupts or white-screens.
//
// Exports:  importImage(file), MAX_IMPORT_DIMENSION
// Depends:  nothing — browser globals only
// -----------------------------------------------------------------------------

/** Hard cap on any ingested image dimension (Safari memory ceiling). */
export const MAX_IMPORT_DIMENSION = 4096;

/**
 * Ingest a File or Blob into a resized ImageBitmap + dataURL. Returns
 * null on decode failure — caller should surface a friendly error.
 *
 * @param {File|Blob} blob
 * @param {{ maxDim?: number }} [opts]
 * @returns {Promise<{
 *   bitmap: ImageBitmap|HTMLImageElement,
 *   dataUrl: string,
 *   originalWidth: number,
 *   originalHeight: number,
 *   width: number,
 *   height: number,
 *   wasResized: boolean,
 * } | null>}
 */
export async function importImage(blob, opts = {}) {
  if (!blob) return null;
  const maxDim = Math.max(256, Math.min(8192, opts.maxDim || MAX_IMPORT_DIMENSION));

  // Probe dimensions WITHOUT allocating a full-size bitmap. If the
  // native image is already within the cap, skip the resize path.
  const probe = await _probeDimensions(blob);
  if (!probe) return null;
  const { naturalWidth, naturalHeight } = probe;

  const longest = Math.max(naturalWidth, naturalHeight);
  const scale   = longest > maxDim ? maxDim / longest : 1;
  const targetW = Math.max(1, Math.round(naturalWidth  * scale));
  const targetH = Math.max(1, Math.round(naturalHeight * scale));
  const wasResized = scale !== 1;

  // Fast path: createImageBitmap with resize options runs off-thread
  // and uses the browser's Lanczos sampler. All evergreen browsers
  // support the resize options as of Safari 18 (2024).
  let bitmap = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(blob, {
        resizeWidth:  targetW,
        resizeHeight: targetH,
        resizeQuality: 'high',
      });
    }
  } catch { /* fall through to the dataURL path */ }

  // Always build a dataURL — the Renderer + history snapshots rely on
  // a serialisable payload for save/restore. Resizing is done via a
  // canvas when necessary so we don't store full-res pixels in IDB.
  const dataUrl = await _toDataUrl(blob, wasResized ? { w: targetW, h: targetH } : null);

  // Fallback when createImageBitmap unavailable (ancient Safari).
  if (!bitmap) bitmap = await _decodeToImageElement(dataUrl);

  return {
    bitmap,
    dataUrl,
    originalWidth:  naturalWidth,
    originalHeight: naturalHeight,
    width:  targetW,
    height: targetH,
    wasResized,
  };
}

// ── internals ─────────────────────────────────────────────────────────────
async function _probeDimensions(blob) {
  // Cheap: createImageBitmap at native resolution is still lazy wrt GPU
  // upload — it just decodes metadata. When unavailable, fall back to
  // an <img> element with an object URL.
  try {
    if (typeof createImageBitmap === 'function') {
      const probe = await createImageBitmap(blob);
      const out = { naturalWidth: probe.width, naturalHeight: probe.height };
      try { probe.close?.(); } catch { /* noop */ }
      return out;
    }
  } catch { /* fall through */ }

  try {
    const url = URL.createObjectURL(blob);
    try {
      const img = await _decodeToImageElement(url);
      return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

function _decodeToImageElement(src) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') { reject(new Error('no Image ctor')); return; }
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = src;
  });
}

async function _toDataUrl(blob, resize) {
  // No resize → direct FileReader roundtrip (fastest).
  if (!resize) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('FileReader error'));
      r.readAsDataURL(blob);
    });
  }

  // Resize → off-thread bitmap → canvas → toDataURL. JPEG keeps the
  // size down; PNG would triple bytes for no visual gain.
  if (typeof document === 'undefined') return '';
  let bitmap = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(blob, {
        resizeWidth:  resize.w,
        resizeHeight: resize.h,
        resizeQuality: 'high',
      });
    }
  } catch { /* fall through */ }

  const canvas = document.createElement('canvas');
  canvas.width  = resize.w;
  canvas.height = resize.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  if (bitmap) ctx.drawImage(bitmap, 0, 0, resize.w, resize.h);
  else {
    const url = URL.createObjectURL(blob);
    try {
      const img = await _decodeToImageElement(url);
      ctx.drawImage(img, 0, 0, resize.w, resize.h);
    } finally { URL.revokeObjectURL(url); }
  }
  try { bitmap?.close?.(); } catch { /* noop */ }
  return canvas.toDataURL('image/jpeg', 0.92);
}
