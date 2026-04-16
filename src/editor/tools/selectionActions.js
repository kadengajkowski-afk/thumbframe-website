// src/editor/tools/selectionActions.js
import { selectionManager } from './SelectionState';
import { loadLayerPixels }   from '../engine/layerPixels';
import useEditorStore        from '../engine/Store';

/**
 * deleteSelection — erase selected pixels to transparent.
 *
 * Loads pixels at display size, erases the selection mask, then passes the
 * result canvas DIRECTLY to __uploadPaintTexture — no intermediate copy.
 */
export async function deleteSelection(layer, updateLayer) {
  if (!selectionManager.hasSelection()) return;
  if (!layer) return;

  try {
    const pixels = await loadLayerPixels(layer);
    if (!pixels) { console.warn('[deleteSelection] no pixels loaded'); return; }
    const { canvas, ctx, width, height } = pixels;
    console.log('[deleteSelection] loaded pixels:', width, 'x', height);

    // ── Save pre-erase state for undo ────────────────────────────────────────
    // We store paint state per historyIndex so multiple erases + undos work.
    // window.__paintHistory: Map<layerId → Map<historyIndex → HTMLCanvasElement>>
    window.__paintHistory = window.__paintHistory || new Map();
    if (!window.__paintHistory.has(layer.id)) window.__paintHistory.set(layer.id, new Map());
    const curHistIdx = useEditorStore.getState().historyIndex;
    const preCanvas  = document.createElement('canvas');
    preCanvas.width  = width; preCanvas.height = height;
    preCanvas.getContext('2d').drawImage(canvas, 0, 0);
    window.__paintHistory.get(layer.id).set(curHistIdx, preCanvas);

    // ── Erase selected pixels ────────────────────────────────────────────────
    const imageData = ctx.getImageData(0, 0, width, height);
    const data      = imageData.data;
    const mask      = selectionManager.mask;
    const mw        = selectionManager.width;
    const mh        = selectionManager.height;

    let erased = 0;
    if (mw === width && mh === height) {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 0) { data[i * 4 + 3] = 0; erased++; }
      }
    } else {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          const mx = Math.round(px / width  * mw);
          const my = Math.round(py / height * mh);
          if (mask[my * mw + mx] > 0) { data[(py * width + px) * 4 + 3] = 0; erased++; }
        }
      }
    }
    console.log('[deleteSelection] erased pixels:', erased);

    ctx.putImageData(imageData, 0, 0);

    const center = ctx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data;
    console.log('[deleteSelection] center pixel after erase:', ...center);

    // Upload the source canvas — do NOT pre-set __paintCanvases (self-copy bug)
    window.__paintCanvases = window.__paintCanvases || new Map();
    if (window.__uploadPaintTexture) {
      window.__uploadPaintTexture(layer.id, canvas);
    }

    // Flag the layer so loadLayerPixels uses the paint canvas as base
    useEditorStore.getState().updateLayer(layer.id, { _hasPaintData: true });

    // commitChange after updateLayer so the snapshot includes _hasPaintData
    useEditorStore.getState().commitChange('Delete Selection');

    // ── Record post-erase state at the new historyIndex ──────────────────────
    const newHistIdx   = useEditorStore.getState().historyIndex;
    const postCanvas   = document.createElement('canvas');
    postCanvas.width   = width; postCanvas.height = height;
    postCanvas.getContext('2d').drawImage(canvas, 0, 0);
    window.__paintHistory.get(layer.id).set(newHistIdx, postCanvas);

    console.log('[deleteSelection] DONE — historyIndex:', newHistIdx);
  } catch (err) {
    console.error('[deleteSelection] error:', err);
  }
}

/**
 * fillSelection — fill selected pixels with a solid color.
 */
export async function fillSelection(layer, color, updateLayer) {
  if (!selectionManager.hasSelection()) return;

  const pixels = await loadLayerPixels(layer);
  if (!pixels) return;
  const { canvas, ctx, width, height } = pixels;
  const { mask } = selectionManager;

  // Parse color via a 1×1 canvas
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 1;
  const tCtx = tmp.getContext('2d');
  tCtx.fillStyle = color;
  tCtx.fillRect(0, 0, 1, 1);
  const [cr, cg, cb, ca] = tCtx.getImageData(0, 0, 1, 1).data;

  const imageData = ctx.getImageData(0, 0, width, height);
  const imgData   = imageData.data;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    imgData[i * 4]     = cr;
    imgData[i * 4 + 1] = cg;
    imgData[i * 4 + 2] = cb;
    imgData[i * 4 + 3] = ca;
  }
  ctx.putImageData(imageData, 0, 0);

  window.__paintCanvases = window.__paintCanvases || new Map();
  let paintCanvas = window.__paintCanvases.get(layer.id);
  if (!paintCanvas) {
    paintCanvas = document.createElement('canvas');
    paintCanvas.width  = width;
    paintCanvas.height = height;
    window.__paintCanvases.set(layer.id, paintCanvas);
  }
  const pCtx = paintCanvas.getContext('2d');
  pCtx.clearRect(0, 0, width, height);
  pCtx.drawImage(canvas, 0, 0);

  if (window.__uploadPaintTexture) window.__uploadPaintTexture(layer.id, paintCanvas);
  if (window.__commitPaintToLayer) window.__commitPaintToLayer(layer.id);
  if (updateLayer) updateLayer(layer.id, { _hasPaintData: true });
}
