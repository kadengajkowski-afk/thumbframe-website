// src/editor-v2/selection/SAMClient.js
// -----------------------------------------------------------------------------
// Purpose:  Thin client for SAM 2 click-to-select, routed through the
//           Railway backend which holds the REPLICATE_API_TOKEN. The
//           frontend sends a screenshot (base64, no prefix) and a click
//           point; the backend calls Replicate and returns a mask.
// Exports:  SAMClient class
// Depends:  nothing (uses fetch)
//
// Contract:
//   • The server endpoint is POST <apiUrl>/sam2/click with a JSON body
//     { image, x, y, width, height }. Response: { mask: base64 PNG }.
//   • The client returns a decoded Uint8ClampedArray mask the caller
//     can feed into Selection.apply().
//   • On network error or missing backend URL, the client resolves
//     with null so the registry action can no-op instead of throwing.
//
// NOTE — REPLICATE_API_TOKEN must be set in the Railway backend env.
// The frontend never sees it. Document required env in Phase 2.d queue
// notes so the first real call doesn't fail silently.
// -----------------------------------------------------------------------------

export class SAMClient {
  /** @param {{ apiUrl: string, fetchImpl?: typeof fetch }} opts */
  constructor(opts) {
    this._apiUrl = String(opts.apiUrl || '').replace(/\/$/, '');
    this._fetch  = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  }

  /**
   * Send a click-to-segment request. `image` is a base64 PNG string
   * (no 'data:image/png;base64,' prefix per Anthropic convention in
   * CLAUDE.md); `click` is { x, y } in image pixel coords.
   *
   * @param {{ image:string, width:number, height:number, click:{x:number,y:number} }} args
   * @returns {Promise<Uint8ClampedArray|null>}
   */
  async segment(args) {
    if (!this._apiUrl || !this._fetch) return null;
    try {
      const res = await this._fetch(`${this._apiUrl}/sam2/click`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          image:  args.image,
          width:  args.width,
          height: args.height,
          x:      args.click?.x ?? 0,
          y:      args.click?.y ?? 0,
        }),
      });
      if (!res.ok) return null;
      const payload = await res.json();
      if (!payload?.mask) return null;
      return _decodePngMask(payload.mask, args.width, args.height);
    } catch (err) {
      console.warn('[SAMClient] segment failed:', err?.message || err);
      return null;
    }
  }
}

/**
 * Decode a base64-PNG mask into a Uint8ClampedArray. The PNG is
 * assumed greyscale — any channel suffices. Returns a zeroed mask if
 * decoding fails (e.g. jsdom without the canvas binding).
 *
 * @param {string} base64
 * @param {number} width
 * @param {number} height
 */
async function _decodePngMask(base64, width, height) {
  const mask = new Uint8ClampedArray(width * height);
  if (typeof document === 'undefined' || typeof Image === 'undefined') return mask;
  const img = new Image();
  const src = /^data:/.test(base64) ? base64 : `data:image/png;base64,${base64}`;
  // Bound the load wait so a bad payload can't hang callers. Browsers
  // typically resolve within the current microtask for data URLs.
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    img.onload  = finish;
    img.onerror = finish;
    setTimeout(finish, 200);
    img.src = src;
  });
  try {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return mask;
    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4];
  } catch { /* tolerate test envs */ }
  return mask;
}
