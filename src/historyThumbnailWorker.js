/* eslint-disable no-restricted-globals */
/**
 * History Thumbnail Worker
 * Receives pre-rendered RGBA pixel data from the main thread,
 * composes it onto an OffscreenCanvas, and returns a JPEG blob.
 * This keeps JPEG encoding off the main thread.
 */

self.onmessage = async (e) => {
  const { entryIdx, pixels, srcW, srcH } = e.data;
  const TW = 160, TH = 90;
  try {
    const canvas = new OffscreenCanvas(TW, TH);
    const ctx = canvas.getContext('2d');

    // Build ImageData from transferred pixels, then resize via createImageBitmap
    const idata = new ImageData(new Uint8ClampedArray(pixels), srcW, srcH);
    const bmp = await createImageBitmap(idata, {
      resizeWidth: TW,
      resizeHeight: TH,
      resizeQuality: 'medium',
    });
    ctx.drawImage(bmp, 0, 0);
    bmp.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.65 });
    self.postMessage({ entryIdx, blob });
  } catch (err) {
    // On failure, send null so the main thread can skip gracefully
    self.postMessage({ entryIdx, blob: null, error: err.message });
  }
};
