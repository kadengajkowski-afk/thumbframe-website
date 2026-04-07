import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';

// ─── Brush Overlay ─────────────────────────────────────────────────────────────
// Items 1-8: Stroke buffer architecture, coalesced pointer events, spacing-based
// dab placement, opacity/flow model, radial gradient dabs, EMA smoothing,
// OffscreenCanvas brush cursor, tool-specific pixel manipulation.

export const BrushOverlay = forwardRef(function BrushOverlay(
  {
    layer, onUpdate, brushType, brushSize, brushStrength, brushEdge,
    brushFlow, brushStabilizer, brushSmoothing, brushSpacing,
    active, zoom, paintColor, paintAlpha, isMask,
    pressureEnabled, pressureMapping, pressureCurve, pressureMin, pressureMax,
    onTabletDetected,
    selectionMaskRef, selectionActive, maskW, maskH,
  },
  ref
) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef            = useRef(null);   // main layer canvas (zoom×dpr resolution)
  const brushCursorCanvasRef = useRef(null);   // cursor overlay (pointer-events:none)

  // Item 1: stroke buffer
  const strokeBufferRef  = useRef(null);   // OffscreenCanvas matching layer pixel dimensions
  const preStrokeRef     = useRef(null);   // ImageData snapshot before stroke (unused for undo, kept for possible revert)
  const isPaintingRef    = useRef(false);
  const lastDabPosRef    = useRef(null);   // last dab position for spacing
  const remainderRef     = useRef(0);      // sub-pixel spacing remainder

  // Item 2: coalesced + rAF
  const coalescedQueueRef = useRef([]);
  const rafPendingRef     = useRef(false);

  // Item 6: EMA smoothing
  const smoothedPosRef   = useRef(null);

  // Item 8: smudge carry, clone source
  const smudgeCarryRef   = useRef(null);   // {data:Uint8ClampedArray, w, h}
  const cloneSourceRef   = useRef(null);   // {x,y} source point in image coords
  const altPressedRef    = useRef(false);

  // Internal: per-stroke layer snapshot (pre-stroke image for dodge/burn/smudge direct ops)
  const strokeImageDataRef = useRef(null);   // ImageData for direct-manipulation tools
  const strokeCanvasRef    = useRef(null);   // offscreen canvas backing strokeImageDataRef
  const strokeCtxRef       = useRef(null);

  // Loading / history
  const isReadyRef       = useRef(false);
  const loadedSrcRef     = useRef(null);
  const originalImgRef   = useRef(null);
  const canvasScaleRef   = useRef(1);       // devicePixelRatio at render time
  const historyRef       = useRef([]);
  const hasPaintedRef    = useRef(false);
  const lastZoomRef      = useRef(null);
  const rawPressureRef   = useRef(0.5);

  const lastCursorPos    = useRef({x:0, y:0});

  // Airbrush: continuous spray timer
  const airbrushTimerRef    = useRef(null);
  const airbrushPosRef      = useRef(null);
  const airbrushPressureRef = useRef(0.5);

  // ── Expose undo via ref ───────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    undo() {
      if (historyRef.current.length <= 1) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      historyRef.current.pop();
      canvas.getContext('2d').putImageData(
        historyRef.current[historyRef.current.length - 1], 0, 0
      );
      flush();
    },
  }));

  // ── Load layer image onto the canvas ─────────────────────────────────────
  useEffect(() => {
    if (!layer?.src || !active) return;
    const zoomChanged = lastZoomRef.current !== null && lastZoomRef.current !== zoom;
    if (loadedSrcRef.current === layer.src && !zoomChanged) return;
    hasPaintedRef.current = false;
    isReadyRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loadImg = (img) => {
      const z   = zoom || 1;
      const dpr = window.devicePixelRatio || 1;
      const px  = z * dpr;
      canvas.width  = Math.round(layer.width  * px);
      canvas.height = Math.round(layer.height * px);
      canvasScaleRef.current = dpr;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      originalImgRef.current = img;
      historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
      isReadyRef.current   = true;
      loadedSrcRef.current = layer.src;
      lastZoomRef.current  = zoom;
    };

    if (originalImgRef.current?.complete && loadedSrcRef.current === layer.src) {
      loadImg(originalImgRef.current);
    } else {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => loadImg(img);
      img.src = layer.src;
    }
  }, [layer?.src, layer?.width, layer?.height, active, zoom]);

  // ── Coordinate helpers ────────────────────────────────────────────────────
  // Convert client coordinates → canvas pixel coordinates (layer pixels at zoom×dpr)
  function clientToCanvas(clientX, clientY) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width  / rect.width),
      y: (clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  // ── Pressure helpers ──────────────────────────────────────────────────────
  function applyPressureCurve(raw) {
    if (!pressureEnabled || pressureMapping === 'none') return raw;
    const minN  = (pressureMin  ?? 0)   / 100;
    const maxN  = (pressureMax  ?? 100) / 100;
    const clamp = Math.max(minN, Math.min(maxN, raw));
    const t     = maxN > minN ? (clamp - minN) / (maxN - minN) : 0;
    const curve = pressureCurve || 'linear';
    if (curve === 'exponential') return Math.pow(t, 2);
    if (curve === 'logarithmic') return Math.sqrt(t);
    return t;
  }

  // ── Item 6: EMA stroke smoothing ─────────────────────────────────────────
  function applySmoothing(pt) {
    const factor = ((brushSmoothing ?? 35) / 100) * 0.85;
    if (factor <= 0 || !smoothedPosRef.current) {
      smoothedPosRef.current = { x: pt.x, y: pt.y };
      return pt;
    }
    const s = smoothedPosRef.current;
    s.x = s.x + (pt.x - s.x) * (1 - factor);
    s.y = s.y + (pt.y - s.y) * (1 - factor);
    return { x: s.x, y: s.y };
  }

  // ── Item 5: Radial gradient dab rendering ────────────────────────────────
  function renderDab(ctx, x, y, size, hardness, rgbObj, alpha, isEraser) {
    const radius = size / 2;
    if (radius < 0.5) return;
    const { r, g, b } = rgbObj;
    ctx.save();
    if (isEraser) ctx.globalCompositeOperation = 'destination-out';

    if (hardness >= 0.99) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isEraser ? `rgba(0,0,0,1)` : `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const solidStop = Math.max(0, Math.min(0.98, hardness));
      const col       = isEraser ? `0,0,0` : `${r},${g},${b}`;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grd.addColorStop(0,           `rgba(${col},${alpha})`);
      grd.addColorStop(solidStop,   `rgba(${col},${alpha})`);
      grd.addColorStop(1,           `rgba(${col},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Parse hex paintColor into {r,g,b}
  function parseColor(hex) {
    const h = (hex || '#ff0000').replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16) || 0,
      g: parseInt(h.slice(2, 4), 16) || 0,
      b: parseInt(h.slice(4, 6), 16) || 0,
    };
  }

  // ── Item 4: Place a dab onto the stroke buffer ───────────────────────────
  function placeDab(imgX, imgY, pressure) {
    const isPaintOrEraser = (brushType === 'paint' || brushType === 'eraser' || brushType === 'airbrush');
    if (isPaintOrEraser && !strokeBufferRef.current) return;

    const effPressure = applyPressureCurve(pressure);
    const sizeScale   = (pressureEnabled && (pressureMapping === 'size' || pressureMapping === 'both'))
      ? Math.max(0.1, 0.1 + 0.9 * effPressure) : 1;
    const effSize = brushSize * sizeScale * (zoom || 1) * canvasScaleRef.current;
    const effFlow = (brushFlow ?? 100) / 100;

    if (isPaintOrEraser) {
      const ctx = strokeBufferRef.current.getContext('2d');
      const hardness = brushEdge === 'hard' ? 0.99 : 0.0;
      const rgb      = parseColor(paintColor);
      // Airbrush uses very low flow per tick — continuous spray via interval builds up paint
      const airbrushMul = brushType === 'airbrush' ? 0.1 : 1;
      const alphaVal = ((paintAlpha ?? 100) / 100) * effFlow * airbrushMul;
      renderDab(ctx, imgX, imgY, effSize * 2, hardness, rgb, alphaVal, brushType === 'eraser');
    }
    // For non-paint types (dodge/burn/smudge/blur/sharpen/clone/heal/wetmix/fill), called via placeDabDirect
  }

  // ── Item 8: Direct pixel manipulation dabs ───────────────────────────────
  function placeDabDirect(imgX, imgY, pressure) {
    if (!strokeCtxRef.current || !strokeImageDataRef.current) return;

    const effPressure = applyPressureCurve(pressure);
    const sizeScale   = (pressureEnabled && (pressureMapping === 'size' || pressureMapping === 'both'))
      ? Math.max(0.1, 0.1 + 0.9 * effPressure) : 1;
    const pxScale  = (zoom || 1) * canvasScaleRef.current;
    const radius   = (brushSize * sizeScale * pxScale) / 2;
    const hardness = brushEdge === 'hard' ? 1.0 : 0.5;
    const strength = (brushStrength ?? 50) / 100;
    const flow     = (brushFlow     ?? 100) / 100;
    const exposure = (strength * flow * effPressure * 0.4);

    const imgData = strokeImageDataRef.current;
    const W = imgData.width, H = imgData.height;
    const d = imgData.data;
    const cx = imgX, cy = imgY;

    if (brushType === 'dodge' || brushType === 'burn') {
      // Photoshop midtones transfer functions (ref: Andy Finnell reverse-engineering)
      const isDodge = brushType === 'dodge';
      const exp = Math.min(1, exposure * 1.5); // scale exposure for perceptual feel
      const x0 = Math.max(0, Math.floor(cx - radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const x1 = Math.min(W - 1, Math.ceil(cx + radius));
      const y1 = Math.min(H - 1, Math.ceil(cy + radius));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;
          const fo = hardness >= 1 ? 1 : Math.max(0, 1 - (Math.max(0, dist / radius - hardness) / (1 - hardness + 0.001)));
          const s = exp * fo;
          if (s <= 0) continue;
          const i = (y * W + x) * 4;
          for (let c = 0; c < 3; c++) {
            const v = d[i + c] / 255;
            let nv;
            if (isDodge) {
              // Midtones dodge: bell curve peaks at v=0.5, zero effect at v=0 and v=1
              nv = v + s * 0.3 * Math.sin(v * Math.PI);
            } else {
              // Midtones burn: same bell curve, subtractive
              nv = v - s * 0.3 * Math.sin(v * Math.PI);
            }
            d[i + c] = Math.min(255, Math.max(0, Math.round(nv * 255)));
          }
        }
      }
    } else if (brushType === 'smudge' || brushType === 'smear') {
      _smudgeDab(imgX, imgY, radius, hardness, strength * flow * effPressure * 0.6);
      return;
    } else if (brushType === 'blur-brush' || brushType === 'blur') {
      _blurDab(imgX, imgY, radius, hardness, strength * flow * effPressure);
      return;
    } else if (brushType === 'sharpen-brush' || brushType === 'sharpen') {
      _sharpenDab(imgX, imgY, radius, hardness, strength * flow * effPressure * 0.2);
      return;
    } else if (brushType === 'clone') {
      _cloneDab(imgX, imgY, radius, hardness, strength * flow * effPressure);
      return;
    } else if (brushType === 'heal') {
      _healDab(strokeCtxRef.current, imgX, imgY, radius, hardness);
      _syncDirectToMainCanvas();
      return;
    } else if (brushType === 'wetmix') {
      const rgb = parseColor(paintColor);
      const wetness = (brushStrength ?? 50) / 100;
      _wetmixDab(strokeCtxRef.current, imgX, imgY, radius, hardness, rgb.r, rgb.g, rgb.b, wetness);
      _syncDirectToMainCanvas();
      return;
    } else if (brushType === 'sponge') {
      _spongeDab(imgX, imgY, radius, hardness, strength * flow * effPressure);
      return;
    }

    // Write updated pixels back to canvas
    strokeCtxRef.current.putImageData(imgData, 0, 0);
    // Sync to main canvas
    _syncDirectToMainCanvas();
  }

  function _smudgeDab(cx, cy, radius, hardness, strength) {
    if (!strokeImageDataRef.current || !lastDabPosRef.current) return;
    const imgData = strokeImageDataRef.current;
    const W = imgData.width, H = imgData.height;
    const d = imgData.data;
    const prev = lastDabPosRef.current;

    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(W - 1, Math.ceil(cx + radius));
    const y1 = Math.min(H - 1, Math.ceil(cy + radius));

    // On first smudge dab, sample carry pixels from starting position
    if (!smudgeCarryRef.current) {
      const cw = Math.round(radius * 2), ch = Math.round(radius * 2);
      const carry = new Uint8ClampedArray(cw * ch * 4);
      const ox = Math.max(0, Math.round(cx - radius));
      const oy = Math.max(0, Math.round(cy - radius));
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const sx = ox + i, sy = oy + j;
        if (sx < W && sy < H) {
          const si = (sy * W + sx) * 4, di = (j * cw + i) * 4;
          carry[di] = d[si]; carry[di+1] = d[si+1]; carry[di+2] = d[si+2]; carry[di+3] = d[si+3];
        }
      }
      smudgeCarryRef.current = { data: carry, w: cw, h: ch, ox, oy };
    }

    const carry = smudgeCarryRef.current;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const fo = hardness >= 1 ? 1 : Math.max(0, 1 - (dist / radius));
        const blend = strength * fo;
        if (blend <= 0) continue;
        const di = (y * W + x) * 4;
        // Map to carry coords
        const carryX = x - (Math.round(prev.x - radius));
        const carryY = y - (Math.round(prev.y - radius));
        if (carryX >= 0 && carryX < carry.w && carryY >= 0 && carryY < carry.h) {
          const ci = (carryY * carry.w + carryX) * 4;
          d[di]   = Math.round(d[di]   * (1 - blend) + carry.data[ci]   * blend);
          d[di+1] = Math.round(d[di+1] * (1 - blend) + carry.data[ci+1] * blend);
          d[di+2] = Math.round(d[di+2] * (1 - blend) + carry.data[ci+2] * blend);
        }
      }
    }

    // Update carry with current pixels at new position
    const newCw = Math.round(radius * 2), newCh = Math.round(radius * 2);
    const newCarry = new Uint8ClampedArray(newCw * newCh * 4);
    const nox = Math.max(0, Math.round(cx - radius));
    const noy = Math.max(0, Math.round(cy - radius));
    for (let j = 0; j < newCh; j++) for (let i = 0; i < newCw; i++) {
      const sx = nox + i, sy = noy + j;
      if (sx < W && sy < H) {
        const si = (sy * W + sx) * 4, di2 = (j * newCw + i) * 4;
        newCarry[di2] = d[si]; newCarry[di2+1] = d[si+1]; newCarry[di2+2] = d[si+2]; newCarry[di2+3] = d[si+3];
      }
    }
    smudgeCarryRef.current = { data: newCarry, w: newCw, h: newCh, ox: nox, oy: noy };

    strokeCtxRef.current.putImageData(imgData, 0, 0);
    _syncDirectToMainCanvas();
  }

  function _blurDab(cx, cy, radius, hardness, strength) {
    if (!strokeImageDataRef.current) return;
    const imgData = strokeImageDataRef.current;
    const W = imgData.width, H = imgData.height;
    const d = imgData.data;

    // Dirty-rect: only process the dab bounding box
    const rx0 = Math.max(0, Math.floor(cx - radius));
    const ry0 = Math.max(0, Math.floor(cy - radius));
    const rx1 = Math.min(W - 1, Math.ceil(cx + radius));
    const ry1 = Math.min(H - 1, Math.ceil(cy + radius));
    const rW = rx1 - rx0 + 1, rH = ry1 - ry0 + 1;
    if (rW <= 0 || rH <= 0) return;

    // Box blur radius — scales with brush radius; 3 passes approximate Gaussian
    const blurR = Math.max(1, Math.round(radius * 0.18));
    const winSize = blurR * 2 + 1;

    // Extract dirty rect into a Float32 buffer for 3-pass blur (avoids clamping between passes)
    const buf = new Float32Array(rW * rH * 4);
    for (let y = 0; y < rH; y++) {
      for (let x = 0; x < rW; x++) {
        const si = ((ry0 + y) * W + (rx0 + x)) * 4;
        const bi = (y * rW + x) * 4;
        buf[bi] = d[si]; buf[bi+1] = d[si+1]; buf[bi+2] = d[si+2]; buf[bi+3] = d[si+3];
      }
    }

    // Separable box blur: horizontal pass then vertical pass, repeated 3× (≈ Gaussian)
    const tmp = new Float32Array(buf.length);
    for (let pass = 0; pass < 3; pass++) {
      // Horizontal pass: buf → tmp
      for (let y = 0; y < rH; y++) {
        let sR = 0, sG = 0, sB = 0;
        for (let bx = -blurR; bx <= blurR; bx++) {
          const sx = Math.max(0, Math.min(rW - 1, bx));
          const si = (y * rW + sx) * 4;
          sR += buf[si]; sG += buf[si+1]; sB += buf[si+2];
        }
        for (let x = 0; x < rW; x++) {
          const di = (y * rW + x) * 4;
          tmp[di] = sR / winSize; tmp[di+1] = sG / winSize; tmp[di+2] = sB / winSize; tmp[di+3] = buf[di+3];
          const addX = Math.min(rW - 1, x + blurR + 1);
          const remX = Math.max(0, x - blurR);
          const addSi = (y * rW + addX) * 4, remSi = (y * rW + remX) * 4;
          sR += buf[addSi] - buf[remSi]; sG += buf[addSi+1] - buf[remSi+1]; sB += buf[addSi+2] - buf[remSi+2];
        }
      }
      // Vertical pass: tmp → buf
      for (let x = 0; x < rW; x++) {
        let sR = 0, sG = 0, sB = 0;
        for (let by = -blurR; by <= blurR; by++) {
          const sy = Math.max(0, Math.min(rH - 1, by));
          const si = (sy * rW + x) * 4;
          sR += tmp[si]; sG += tmp[si+1]; sB += tmp[si+2];
        }
        for (let y = 0; y < rH; y++) {
          const di = (y * rW + x) * 4;
          buf[di] = sR / winSize; buf[di+1] = sG / winSize; buf[di+2] = sB / winSize; buf[di+3] = tmp[di+3];
          const addY = Math.min(rH - 1, y + blurR + 1);
          const remY = Math.max(0, y - blurR);
          const addSi = (addY * rW + x) * 4, remSi = (remY * rW + x) * 4;
          sR += tmp[addSi] - tmp[remSi]; sG += tmp[addSi+1] - tmp[remSi+1]; sB += tmp[addSi+2] - tmp[remSi+2];
        }
      }
    }

    // Write blurred result back, blended by brush-tip falloff
    for (let y = 0; y < rH; y++) {
      for (let x = 0; x < rW; x++) {
        const dx = (rx0 + x) - cx, dy = (ry0 + y) - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const fo = hardness >= 1 ? 1 : Math.max(0, 1 - (dist / radius) ** 1.5);
        const blend = Math.min(1, strength * fo);
        if (blend <= 0) continue;
        const di = ((ry0 + y) * W + (rx0 + x)) * 4;
        const bi = (y * rW + x) * 4;
        d[di]   = Math.round(d[di]   * (1 - blend) + buf[bi]   * blend);
        d[di+1] = Math.round(d[di+1] * (1 - blend) + buf[bi+1] * blend);
        d[di+2] = Math.round(d[di+2] * (1 - blend) + buf[bi+2] * blend);
      }
    }
    strokeCtxRef.current.putImageData(imgData, 0, 0);
    _syncDirectToMainCanvas();
  }

  function _sharpenDab(cx, cy, radius, hardness, strength) {
    if (!strokeImageDataRef.current) return;
    const imgData = strokeImageDataRef.current;
    const W = imgData.width, H = imgData.height;
    const d = imgData.data;
    const src = new Uint8ClampedArray(d);

    const x0 = Math.max(1, Math.floor(cx - radius));
    const y0 = Math.max(1, Math.floor(cy - radius));
    const x1 = Math.min(W - 2, Math.ceil(cx + radius));
    const y1 = Math.min(H - 2, Math.ceil(cy + radius));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const fo = hardness >= 1 ? 1 : Math.max(0, 1 - (dist / radius) ** 2);
        const s = strength * fo;
        if (s <= 0) continue;
        const di = (y * W + x) * 4;
        for (let c = 0; c < 3; c++) {
          const n = (src[((y-1)*W+x)*4+c] + src[((y+1)*W+x)*4+c] + src[(y*W+(x-1))*4+c] + src[(y*W+(x+1))*4+c]) / 4;
          d[di+c] = Math.min(255, Math.max(0, Math.round(src[di+c] + (src[di+c] - n) * s * 3)));
        }
      }
    }
    strokeCtxRef.current.putImageData(imgData, 0, 0);
    _syncDirectToMainCanvas();
  }

  function _cloneDab(cx, cy, radius, hardness, strength) {
    if (!strokeImageDataRef.current || !cloneSourceRef.current) return;
    const imgData = strokeImageDataRef.current;
    const W = imgData.width, H = imgData.height;
    const d = imgData.data;
    const src = new Uint8ClampedArray(d);
    const { x: sxBase, y: syBase } = cloneSourceRef.current;

    // Compute offset from stroke start if not set
    const offsetX = lastDabPosRef.current ? sxBase + (cx - lastDabPosRef.current.x) : sxBase;
    const offsetY = lastDabPosRef.current ? syBase + (cy - lastDabPosRef.current.y) : syBase;

    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(W - 1, Math.ceil(cx + radius));
    const y1 = Math.min(H - 1, Math.ceil(cy + radius));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const fo = hardness >= 1 ? 1 : Math.max(0, 1 - dist / radius);
        const blend = strength * fo;
        const srcX = Math.round(offsetX + (x - cx));
        const srcY = Math.round(offsetY + (y - cy));
        if (srcX < 0 || srcX >= W || srcY < 0 || srcY >= H) continue;
        const si = (srcY * W + srcX) * 4, di = (y * W + x) * 4;
        d[di]   = Math.round(d[di]   * (1 - blend) + src[si]   * blend);
        d[di+1] = Math.round(d[di+1] * (1 - blend) + src[si+1] * blend);
        d[di+2] = Math.round(d[di+2] * (1 - blend) + src[si+2] * blend);
        d[di+3] = Math.round(d[di+3] * (1 - blend) + src[si+3] * blend);
      }
    }
    strokeCtxRef.current.putImageData(imgData, 0, 0);
    _syncDirectToMainCanvas();
  }

  // ── Heal dab: texture from boundary ring, color from destination ─────────────
  // Samples the outer boundary ring to compute a color offset, then shifts the
  // interior pixels toward the surrounding background color — "texture stays,
  // color adapts." This is the simplified Poisson approximation from the reference.
  function _healDab(ctx, cx, cy, radius, hardness) {
    const r = Math.ceil(radius);
    // Sample area: 2× radius to include boundary ring
    const x0 = Math.max(0, Math.floor(cx - r * 2));
    const y0 = Math.max(0, Math.floor(cy - r * 2));
    const x1 = Math.min(ctx.canvas.width - 1, Math.ceil(cx + r * 2));
    const y1 = Math.min(ctx.canvas.height - 1, Math.ceil(cy + r * 2));
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;

    const idata = ctx.getImageData(x0, y0, w, h);
    const d = idata.data;

    // Step 1: Sample boundary ring (outermost 20% of radius) for average color
    const innerR = radius * 0.8, outerR = radius * 1.5;
    let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = (x0 + px) - cx, dy = (y0 + py) - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= innerR && dist <= outerR) {
          const i = (py * w + px) * 4;
          sumR += d[i]; sumG += d[i+1]; sumB += d[i+2]; cnt++;
        }
      }
    }
    if (cnt === 0) return;
    const bgR = sumR / cnt, bgG = sumG / cnt, bgB = sumB / cnt;

    // Step 2: Average interior (dab center) color — this is what we're replacing
    let intR = 0, intG = 0, intB = 0, intCnt = 0;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = (x0 + px) - cx, dy = (y0 + py) - cy;
        if (Math.sqrt(dx * dx + dy * dy) <= radius * 0.5) {
          const i = (py * w + px) * 4;
          intR += d[i]; intG += d[i+1]; intB += d[i+2]; intCnt++;
        }
      }
    }
    if (intCnt === 0) return;
    // Color offset: shift interior toward boundary background
    const offR = bgR - intR / intCnt;
    const offG = bgG - intG / intCnt;
    const offB = bgB - intB / intCnt;

    // Step 3: Apply offset to interior pixels, blended by distance from center
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = (x0 + px) - cx, dy = (y0 + py) - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        // Falloff strongest at center, zero at edge (smooth healing boundary)
        const t = 1 - dist / radius;
        const fo = hardness >= 0.99 ? t : t * t;
        const blend = fo * 0.55;
        const i = (py * w + px) * 4;
        d[i]   = Math.min(255, Math.max(0, Math.round(d[i]   + offR * blend)));
        d[i+1] = Math.min(255, Math.max(0, Math.round(d[i+1] + offG * blend)));
        d[i+2] = Math.min(255, Math.max(0, Math.round(d[i+2] + offB * blend)));
      }
    }
    ctx.putImageData(idata, x0, y0);
  }

  // ── Wet mix dab: blends brush color with canvas color (wet paint) ─────────
  function _wetmixDab(ctx, cx, cy, radius, hardness, r, g, b, wetness) {
    const rad = Math.ceil(radius);
    const x0 = Math.max(0, cx - rad), y0 = Math.max(0, cy - rad);
    const x1 = Math.min(ctx.canvas.width - 1, cx + rad);
    const y1 = Math.min(ctx.canvas.height - 1, cy + rad);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (w <= 0 || h <= 0) return;

    const idata = ctx.getImageData(x0, y0, w, h);
    const d = idata.data;
    const wet = Math.min(1, Math.max(0, wetness));

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const dx = (x0 + px) - cx, dy = (y0 + py) - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const falloff = hardness >= 0.99 ? 1 : Math.max(0, 1 - (dist / radius - hardness) / (1 - hardness + 0.001));
        const i = (py * w + px) * 4;
        const canvasR = d[i], canvasG = d[i + 1], canvasB = d[i + 2];
        const mixR = r * (1 - wet) + canvasR * wet;
        const mixG = g * (1 - wet) + canvasG * wet;
        const mixB = b * (1 - wet) + canvasB * wet;
        d[i]     = Math.round(d[i]     + (mixR - d[i])     * falloff * 0.3);
        d[i + 1] = Math.round(d[i + 1] + (mixG - d[i + 1]) * falloff * 0.3);
        d[i + 2] = Math.round(d[i + 2] + (mixB - d[i + 2]) * falloff * 0.3);
      }
    }
    ctx.putImageData(idata, x0, y0);
  }

  // ── Sponge dab: HSL saturation adjustment ────────────────────────────────
  // Mode toggles via brushStrength polarity: >50 = saturate, <=50 = desaturate.
  function _spongeDab(cx, cy, radius, hardness, strength) {
    if (!strokeImageDataRef.current) return;
    const imgData = strokeImageDataRef.current;
    const W = imgData.width, H = imgData.height;
    const d = imgData.data;
    // strength > 0.5 = saturate, <= 0.5 = desaturate
    const saturate = strength > 0.5;
    const s = Math.abs(strength - 0.5) * 2; // remap 0.5-1 → 0-1

    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(W - 1, Math.ceil(cx + radius));
    const y1 = Math.min(H - 1, Math.ceil(cy + radius));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const fo = hardness >= 1 ? 1 : Math.max(0, 1 - dist / radius);
        const blend = s * fo * 0.4;
        if (blend <= 0) continue;

        const i = (y * W + x) * 4;
        const r = d[i] / 255, g = d[i+1] / 255, b = d[i+2] / 255;

        // RGB → HSL
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const delta = max - min;
        let h2 = 0, sl = 0;
        if (delta > 0.0001) {
          sl = delta / (1 - Math.abs(2 * l - 1));
          if      (max === r) h2 = ((g - b) / delta) % 6;
          else if (max === g) h2 = (b - r) / delta + 2;
          else                h2 = (r - g) / delta + 4;
          h2 = ((h2 * 60) + 360) % 360;
        }

        const newSl = saturate
          ? Math.min(1, sl + blend)
          : Math.max(0, sl - blend);

        // HSL → RGB
        const c2 = (1 - Math.abs(2 * l - 1)) * newSl;
        const x2 = c2 * (1 - Math.abs((h2 / 60) % 2 - 1));
        const m  = l - c2 / 2;
        let nr = 0, ng = 0, nb = 0;
        const sect = Math.floor(h2 / 60);
        if      (sect === 0) { nr = c2; ng = x2; nb = 0; }
        else if (sect === 1) { nr = x2; ng = c2; nb = 0; }
        else if (sect === 2) { nr = 0;  ng = c2; nb = x2; }
        else if (sect === 3) { nr = 0;  ng = x2; nb = c2; }
        else if (sect === 4) { nr = x2; ng = 0;  nb = c2; }
        else                 { nr = c2; ng = 0;  nb = x2; }
        d[i]   = Math.round((nr + m) * 255);
        d[i+1] = Math.round((ng + m) * 255);
        d[i+2] = Math.round((nb + m) * 255);
      }
    }
    strokeCtxRef.current.putImageData(imgData, 0, 0);
    _syncDirectToMainCanvas();
  }

  // ── Flood fill: scanline algorithm with Uint32Array (~4× faster than BFS) ──
  function _floodFill(layerCtx, startX, startY, fillR, fillG, fillB, tolerance) {
    const canvas = layerCtx.canvas;
    const W = canvas.width, H = canvas.height;
    const idata = layerCtx.getImageData(0, 0, W, H);
    const d   = idata.data;
    const d32 = new Uint32Array(idata.data.buffer); // 4× faster pixel compare

    const sx = Math.max(0, Math.min(W - 1, Math.floor(startX)));
    const sy = Math.max(0, Math.min(H - 1, Math.floor(startY)));
    const seedIdx = sy * W + sx;

    // Target color components (sampled from seed pixel)
    const tr = d[seedIdx * 4], tg = d[seedIdx * 4 + 1], tb = d[seedIdx * 4 + 2];

    // Fill color as Uint32 in little-endian ABGR layout used by Canvas 2D
    const fillColor32 = (255 << 24) | (fillB << 16) | (fillG << 8) | fillR;

    // Already the fill color — nothing to do
    if (d32[seedIdx] === fillColor32) return;

    const tolSq = tolerance * tolerance * 3; // Euclidean³ threshold

    function matches(idx) {
      const i = idx << 2;
      const dr = d[i] - tr, dg = d[i + 1] - tg, db = d[i + 2] - tb;
      return (dr * dr + dg * dg + db * db) <= tolSq;
    }

    // Scanline stack: each entry is [x, y]
    const stack = [[sx, sy]];
    const visited = new Uint8Array(W * H);

    while (stack.length) {
      let [x, y] = stack.pop();

      // Scan left to find leftmost matching pixel on this row
      while (x > 0 && !visited[y * W + x - 1] && matches(y * W + x - 1)) x--;

      let spanAbove = false, spanBelow = false;

      // Scan right, filling as we go
      while (x < W && !visited[y * W + x] && matches(y * W + x)) {
        const idx = y * W + x;
        d32[idx] = fillColor32;
        visited[idx] = 1;

        // Seed span above
        if (y > 0) {
          const aIdx = (y - 1) * W + x;
          if (!visited[aIdx] && matches(aIdx)) {
            if (!spanAbove) { stack.push([x, y - 1]); spanAbove = true; }
          } else {
            spanAbove = false;
          }
        }
        // Seed span below
        if (y < H - 1) {
          const bIdx = (y + 1) * W + x;
          if (!visited[bIdx] && matches(bIdx)) {
            if (!spanBelow) { stack.push([x, y + 1]); spanBelow = true; }
          } else {
            spanBelow = false;
          }
        }
        x++;
      }
    }
    layerCtx.putImageData(idata, 0, 0);
  }

  // Sync direct-manipulation canvas to the main display canvas
  function _syncDirectToMainCanvas() {
    const canvas = canvasRef.current;
    const sc = strokeCanvasRef.current;
    if (!canvas || !sc) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (originalImgRef.current) {
      ctx.drawImage(originalImgRef.current, 0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(sc, 0, 0);
  }

  // ── Item 1: Stroke lifecycle ──────────────────────────────────────────────
  function startStroke(canvasX, canvasY, pressure) {
    if (!isReadyRef.current || !canvasRef.current) return;
    isPaintingRef.current  = true;
    remainderRef.current   = 0;
    smudgeCarryRef.current = null;
    smoothedPosRef.current = { x: canvasX, y: canvasY };
    lastDabPosRef.current  = { x: canvasX, y: canvasY };

    const canvas = canvasRef.current;
    const W = canvas.width, H = canvas.height;

    const isPaintOrEraser = (brushType === 'paint' || brushType === 'eraser' || brushType === 'airbrush');

    if (isPaintOrEraser) {
      // Create OffscreenCanvas stroke buffer
      const sb = (typeof OffscreenCanvas !== 'undefined')
        ? new OffscreenCanvas(W, H)
        : (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; })();
      strokeBufferRef.current = sb;
      // Save pre-stroke state
      preStrokeRef.current = canvas.getContext('2d').getImageData(0, 0, W, H);
      // Place first dab
      placeDab(canvasX, canvasY, pressure);
      // Airbrush: start continuous spray interval
      if (brushType === 'airbrush') {
        airbrushPosRef.current      = { x: canvasX, y: canvasY };
        airbrushPressureRef.current = pressure;
        if (airbrushTimerRef.current) clearInterval(airbrushTimerRef.current);
        airbrushTimerRef.current = setInterval(() => {
          if (airbrushPosRef.current && strokeBufferRef.current) {
            placeDab(airbrushPosRef.current.x, airbrushPosRef.current.y, airbrushPressureRef.current);
            _compositeStrokePreviewOnCanvas();
          }
        }, 50);
      }
    } else if (brushType === 'fill') {
      // Fill: flood fill immediately, no stroke loop
      const layerCtx = canvas.getContext('2d');
      const { r, g, b } = parseColor(paintColor);
      _floodFill(layerCtx, canvasX, canvasY, r, g, b, 32);
      flush();
      isPaintingRef.current = false;
    } else {
      // Direct manipulation tools: load layer image into writable canvas
      const sc = document.createElement('canvas');
      sc.width = W; sc.height = H;
      const sctx = sc.getContext('2d');
      sctx.drawImage(canvas, 0, 0);
      strokeCanvasRef.current = sc;
      strokeCtxRef.current    = sctx;
      strokeImageDataRef.current = sctx.getImageData(0, 0, W, H);
      placeDabDirect(canvasX, canvasY, pressure);
    }
  }

  // ── Item 1: Commit stroke ─────────────────────────────────────────────────
  function commitStroke() {
    // Clear airbrush interval regardless of isPaintingRef state
    if (airbrushTimerRef.current) {
      clearInterval(airbrushTimerRef.current);
      airbrushTimerRef.current = null;
    }
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas || !isReadyRef.current) return;
    const ctx = canvas.getContext('2d');

    const isPaintOrEraser = (brushType === 'paint' || brushType === 'eraser' || brushType === 'airbrush');

    if (isPaintOrEraser && strokeBufferRef.current) {
      // Apply selection mask to stroke buffer before compositing
      if (selectionActive && selectionMaskRef?.current) {
        _applySelectionMaskToStrokeBuffer();
      }

      // Composite stroke buffer onto main canvas at brush opacity
      ctx.save();
      ctx.globalAlpha = (brushStrength ?? 100) / 100;
      if (brushType === 'eraser') ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(strokeBufferRef.current, 0, 0);
      ctx.restore();

      strokeBufferRef.current = null;
      preStrokeRef.current    = null;
    }
    // For direct tools, strokeCtxRef canvas is already composited to main canvas

    // Flush to layer
    flush();

    // Reset direct-tool state
    strokeCanvasRef.current    = null;
    strokeCtxRef.current       = null;
    strokeImageDataRef.current = null;
    smudgeCarryRef.current     = null;
    lastDabPosRef.current      = null;
  }

  // Apply selection mask to the stroke buffer (clip paint to selected area)
  function _applySelectionMaskToStrokeBuffer() {
    const sb = strokeBufferRef.current;
    if (!sb) return;
    const sCtx = sb.getContext('2d');
    const W = sb.width, H = sb.height;
    const sid = sCtx.getImageData(0, 0, W, H);
    const m = selectionMaskRef.current;
    const mW = maskW || Math.round(W / ((zoom || 1) * (canvasScaleRef.current || 1)));
    const mH = maskH || Math.round(H / ((zoom || 1) * (canvasScaleRef.current || 1)));
    const scale = (zoom || 1) * (canvasScaleRef.current || 1);
    const offX = layer?.x || 0;
    const offY = layer?.y || 0;
    for (let cy = 0; cy < H; cy++) {
      const dy = Math.floor(cy / scale) + offY;
      if (dy < 0 || dy >= mH) continue;
      for (let cx = 0; cx < W; cx++) {
        const dx = Math.floor(cx / scale) + offX;
        if (dx < 0 || dx >= mW) continue;
        const mi = dy * mW + dx;
        if (mi >= 0 && mi < m.length) {
          const pi = (cy * W + cx) * 4 + 3;
          sid.data[pi] = Math.round(sid.data[pi] * m[mi] / 255);
        }
      }
    }
    sCtx.putImageData(sid, 0, 0);
  }

  // ── Item 3: Spacing-based stroke interpolation ────────────────────────────
  function strokeToPoint(x, y, pressure) {
    const last = lastDabPosRef.current;
    if (!last) {
      lastDabPosRef.current = { x, y };
      const isPaint = (brushType === 'paint' || brushType === 'eraser' || brushType === 'airbrush');
      if (isPaint) placeDab(x, y, pressure);
      else placeDabDirect(x, y, pressure);
      return;
    }

    const dx = x - last.x, dy = y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spacing = Math.max(1, (brushSize * (zoom || 1) * canvasScaleRef.current) * ((brushSpacing ?? 25) / 100));

    let curLast = { x: last.x, y: last.y };
    let d = remainderRef.current;

    const isPaint = (brushType === 'paint' || brushType === 'eraser' || brushType === 'airbrush');

    while (d + dist >= spacing) {
      const t = (spacing - d) / Math.max(0.001, dist);
      const ix = curLast.x + (x - curLast.x) * t;
      const iy = curLast.y + (y - curLast.y) * t;
      if (isPaint) placeDab(ix, iy, pressure);
      else placeDabDirect(ix, iy, pressure);
      curLast = { x: ix, y: iy };
      d = 0;
      const rdx = x - curLast.x, rdy = y - curLast.y;
      const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rdist < 0.001) {
        lastDabPosRef.current = { x, y };
        remainderRef.current  = 0;
        return;
      }
    }

    const finalDx = x - curLast.x, finalDy = y - curLast.y;
    remainderRef.current  = Math.sqrt(finalDx * finalDx + finalDy * finalDy) % spacing;
    lastDabPosRef.current = { x, y };
  }

  // ── Item 2: Pointer event handlers ───────────────────────────────────────
  function onPointerDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    rawPressureRef.current = e.pressure;
    if (e.pointerType === 'pen' && onTabletDetected) onTabletDetected();

    if (!isReadyRef.current || !active) return;

    // Clone: Alt+click sets source
    if (brushType === 'clone' && e.altKey) {
      const pos = clientToCanvas(e.clientX, e.clientY);
      cloneSourceRef.current = { x: pos.x, y: pos.y };
      return;
    }

    if (!hasPaintedRef.current && !isMask && canvasRef.current) {
      hasPaintedRef.current = true;
      canvasRef.current.style.opacity = '1';
    }

    altPressedRef.current = e.altKey;

    const pos = clientToCanvas(e.clientX, e.clientY);
    coalescedQueueRef.current = [];
    startStroke(pos.x, pos.y, rawPressureRef.current > 0 ? rawPressureRef.current : 0.5);

    updateBrushCursor(e.clientX, e.clientY);
  }

  function onPointerMove(e) {
    e.preventDefault();
    rawPressureRef.current = e.pressure;
    lastCursorPos.current  = { x: e.clientX, y: e.clientY };
    updateBrushCursor(e.clientX, e.clientY);

    if (!isPaintingRef.current || !active || !isReadyRef.current) return;

    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of coalesced) {
      coalescedQueueRef.current.push({
        x: ce.clientX,
        y: ce.clientY,
        pressure: ce.pressure > 0 ? ce.pressure : 0.5,
      });
    }

    // Airbrush: update position so interval deposits paint at current cursor
    if (brushType === 'airbrush' && coalesced.length > 0) {
      const last = coalesced[coalesced.length - 1];
      const pos = clientToCanvas(last.clientX, last.clientY);
      airbrushPosRef.current      = { x: pos.x, y: pos.y };
      airbrushPressureRef.current = last.pressure > 0 ? last.pressure : 0.5;
    }

    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      requestAnimationFrame(flushPointQueue);
    }
  }

  function onPointerUp(e) {
    e.preventDefault();
    rawPressureRef.current = e.pressure;

    if (!isPaintingRef.current) return;

    // Flush remaining queued points synchronously
    const pts = coalescedQueueRef.current.splice(0);
    for (const pt of pts) {
      const pos     = clientToCanvas(pt.x, pt.y);
      const smoothed = applySmoothing(pos);
      strokeToPoint(smoothed.x, smoothed.y, pt.pressure);
    }

    // Composite stroke preview on viewport if paint type
    if (strokeBufferRef.current) {
      _compositeStrokePreviewOnCanvas();
    }

    commitStroke();
    updateBrushCursor(e.clientX, e.clientY);
  }

  // Item 2: flush coalesced queue via rAF
  function flushPointQueue() {
    rafPendingRef.current = false;
    const pts = coalescedQueueRef.current.splice(0);
    if (!pts.length || !isPaintingRef.current) return;

    for (const pt of pts) {
      const pos      = clientToCanvas(pt.x, pt.y);
      const smoothed = applySmoothing(pos);
      strokeToPoint(smoothed.x, smoothed.y, pt.pressure);
    }

    // Live preview during stroke (paint/eraser only)
    if (strokeBufferRef.current) {
      _compositeStrokePreviewOnCanvas();
    }
  }

  // Composite stroke buffer onto main canvas for live preview (non-destructive)
  function _compositeStrokePreviewOnCanvas() {
    const canvas = canvasRef.current;
    const sb = strokeBufferRef.current;
    if (!canvas || !sb) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (preStrokeRef.current) {
      ctx.putImageData(preStrokeRef.current, 0, 0);
    } else if (originalImgRef.current) {
      ctx.drawImage(originalImgRef.current, 0, 0, canvas.width, canvas.height);
    }
    ctx.save();
    ctx.globalAlpha = (brushStrength ?? 100) / 100;
    if (brushType === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(sb, 0, 0);
    ctx.restore();
  }

  // ── Flush layer output ─────────────────────────────────────────────────────
  function flush() {
    const canvas = canvasRef.current;
    if (!canvas || !isReadyRef.current) return;

    const snap = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = [...historyRef.current.slice(-19), snap];

    const tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    tmp.getContext('2d').putImageData(snap, 0, 0);
    const dataUrl = tmp.toDataURL('image/png');
    loadedSrcRef.current = dataUrl;
    setTimeout(() => { onUpdate({ src: dataUrl }); }, 50);
  }

  // ── Item 7: Brush cursor — DPR-crisp, per-tool variants ──────────────────
  function updateBrushCursor(clientX, clientY) {
    const cc = brushCursorCanvasRef.current;
    if (!cc) return;

    const canvas = canvasRef.current;
    const rect   = canvas ? canvas.getBoundingClientRect() : null;

    // DPR-correct canvas resolution for crisp cursor on retina displays
    const dpr = window.devicePixelRatio || 1;
    const cssW = rect ? rect.width  : 300;
    const cssH = rect ? rect.height : 200;
    if (cc.width !== Math.round(cssW * dpr) || cc.height !== Math.round(cssH * dpr)) {
      cc.width  = Math.round(cssW * dpr);
      cc.height = Math.round(cssH * dpr);
    }
    const ctx = cc.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const displayX = clientX - (rect ? rect.left : 0);
    const displayY = clientY - (rect ? rect.top  : 0);

    // Out-of-bounds: don't draw cursor
    if (displayX < 0 || displayX > cssW || displayY < 0 || displayY > cssH) return;

    const dispRadius = brushSize * (zoom || 1);
    const hardness   = brushEdge === 'hard' ? 0.99 : 0.0;

    // ── Fill tool: crosshair only ─────────────────────────────────────────
    if (brushType === 'fill') {
      _drawCrosshair(ctx, displayX, displayY, 8);
      return;
    }

    // ── Clone tool: cursor circle + source crosshair ──────────────────────
    if (brushType === 'clone' && cloneSourceRef.current && canvas) {
      const srcImgX = cloneSourceRef.current.x;
      const srcImgY = cloneSourceRef.current.y;
      // Convert image coords back to CSS display coords
      const srcCSSX = srcImgX * (cssW / canvas.width);
      const srcCSSY = srcImgY * (cssH / canvas.height);
      // Small + marker at source point
      _drawCrosshair(ctx, srcCSSX, srcCSSY, 6);
      ctx.strokeStyle = 'rgba(64,192,255,0.9)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(srcCSSX, srcCSSY, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Standard circle cursor ────────────────────────────────────────────
    if (dispRadius < 3) {
      _drawCrosshair(ctx, displayX, displayY, 7);
    } else {
      // Drop shadow for visibility on any background
      ctx.beginPath();
      ctx.arc(displayX, displayY, dispRadius + 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth   = 2;
      ctx.stroke();
      // White ring
      ctx.beginPath();
      ctx.arc(displayX, displayY, dispRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      // Soft-brush inner hardness ring
      if (hardness < 0.9 && dispRadius > 6) {
        ctx.beginPath();
        ctx.arc(displayX, displayY, dispRadius * Math.max(0.1, hardness), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Sponge: show S (saturate) or D (desaturate) label inside circle
      if (brushType === 'sponge') {
        const mode = (brushStrength ?? 50) > 50 ? 'S' : 'D';
        ctx.font      = `bold ${Math.max(9, Math.min(14, dispRadius * 0.6))}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mode, displayX, displayY);
      }
    }
  }

  function _drawCrosshair(ctx, x, y, size) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x - size + 1, y); ctx.lineTo(x + size - 1, y);
    ctx.moveTo(x, y - size + 1); ctx.lineTo(x, y + size - 1);
    ctx.stroke();
  }

  if (!active || !layer?.src) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      {/* Item 7: Brush cursor overlay */}
      <canvas
        ref={brushCursorCanvasRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          zIndex: 100000,
        }}
      />
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={(e) => { updateBrushCursor(-999, -999); onPointerUp(e); }}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          cursor: 'none', display: 'block',
          userSelect: 'none', WebkitUserSelect: 'none',
          touchAction: 'none',
          pointerEvents: 'auto',
          opacity: 0,
        }}
      />
    </div>
  );
});

// ─── Brush Tool Sidebar ─────────────────────────────────────────────────────────
export default function BrushTool({
  layer, theme: T, brushOverlayRef,
  brushType, brushSize, brushStrength, brushEdge,
  brushFlow, brushStabilizer, brushSmoothing, brushSpacing,
  paintColor, paintAlpha,
  onBrushTypeChange, onBrushSizeChange, onBrushStrengthChange,
  onBrushEdgeChange, onBrushFlowChange, onBrushStabilizerChange, onBrushSmoothingChange,
  onBrushSpacingChange, onPaintColorChange, onPaintAlphaChange,
  // Pressure props
  pressureEnabled, pressureMapping, pressureCurve, pressureMin, pressureMax, tabletDetected,
  onPressureEnabledChange, onPressureMappingChange, onPressureCurveChange,
  onPressureMinChange, onPressureMaxChange,
}) {
  const pressureCurveCanvasRef = useRef(null);
  const [showSpacing, setShowSpacing] = useState(false);

  useEffect(() => {
    const el = pressureCurveCanvasRef.current;
    if (!el || !pressureEnabled) return;
    const ctx2 = el.getContext('2d');
    ctx2.clearRect(0, 0, 60, 40);
    ctx2.fillStyle = '#1a1a1a';
    ctx2.fillRect(0, 0, 60, 40);
    ctx2.strokeStyle = '#ff6a00';
    ctx2.lineWidth = 1.5;
    ctx2.beginPath();
    for (let x = 0; x <= 60; x++) {
      const t = x / 60;
      let y;
      if (pressureCurve === 'exponential') y = 1 - Math.pow(t, 2);
      else if (pressureCurve === 'logarithmic') y = 1 - Math.sqrt(t);
      else y = 1 - t;
      if (x === 0) ctx2.moveTo(x, y * 40);
      else ctx2.lineTo(x, y * 40);
    }
    ctx2.stroke();
    ctx2.strokeStyle = '#444';
    ctx2.lineWidth = 0.5;
    ctx2.strokeRect(0, 0, 60, 40);
  }, [pressureCurve, pressureEnabled]);

  const brushTypes = [
    { key: 'blur-brush',     label: 'Blur',    icon: '◎', desc: 'Softens — good for skin and backgrounds'      },
    { key: 'smudge',         label: 'Smudge',  icon: '≋', desc: 'Drags pixels — blend edges naturally'         },
    { key: 'sharpen-brush',  label: 'Sharpen', icon: '◈', desc: 'Crispens detail — use lightly'                },
    { key: 'airbrush', label: 'Air',     icon: '∴', desc: 'Soft scattered spray'                         },
    { key: 'dodge',    label: 'Dodge',   icon: '☀', desc: 'Brightens — add highlights and rim light'     },
    { key: 'burn',     label: 'Burn',    icon: '◑', desc: 'Darkens — add shadows and depth'              },
    { key: 'sponge',   label: 'Sponge',  icon: '◉', desc: 'Saturate or desaturate — strength sets mode'  },
    { key: 'heal',     label: 'Heal',    icon: '✚', desc: 'Removes blemishes using surrounding texture'  },
    { key: 'wetmix',   label: 'Wet',     icon: '≈', desc: 'Wet mix — picks up and blends color like paint'},
    { key: 'eraser',   label: 'Erase',   icon: '○', desc: 'Erases to transparent'                        },
    { key: 'clone',    label: 'Clone',   icon: '⊕', desc: 'Alt+click to set source, then paint'          },
    { key: 'paint',    label: 'Paint',   icon: '✏', desc: 'Paint with a custom color'                    },
    { key: 'fill',     label: 'Fill',    icon: '⬛', desc: 'Flood fill — click to fill area with color'   },
  ];

  const css = {
    label:   { fontSize: '10px', color: T.muted, marginBottom: 4, marginTop: 12, letterSpacing: '0.8px', fontWeight: '600', textTransform: 'uppercase', display: 'block' },
    section: { padding: 10, background: T.input, borderRadius: 7, border: `1px solid ${T.border}`, marginTop: 8 },
    row:     { display: 'flex', gap: 6, alignItems: 'center' },
  };

  const flow       = brushFlow       ?? 100;
  const stabilizer = brushStabilizer ?? 0;
  const spacing    = brushSpacing    ?? 25;

  if (!layer?.src) return (
    <div style={{ ...css.section, marginTop: 0, fontSize: 11, color: T.muted, lineHeight: 1.8 }}>
      Click an image on the canvas to select it, then use brush tools.
    </div>
  );

  return (
    <div>
      <div style={{ ...css.section, marginTop: 0, fontSize: 11, color: T.success, fontWeight: '600' }}>
        ✓ Image selected — paint on the canvas
      </div>

      <span style={css.label}>Brush type</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
        {brushTypes.map(b => (
          <button key={b.key} onClick={() => onBrushTypeChange(b.key)} title={b.desc}
            style={{
              padding: '8px 2px', borderRadius: 6,
              border: `1px solid ${brushType === b.key ? T.accent : T.border}`,
              background: brushType === b.key ? `${T.accent}18` : T.input,
              color:      brushType === b.key ? T.accent : T.text,
              fontSize: 8, cursor: 'pointer', fontWeight: brushType === b.key ? '700' : '400',
              textAlign: 'center', lineHeight: 1.6, transition: 'all 0.1s',
            }}>
            <div style={{ fontFamily: 'monospace', fontSize: 13, marginBottom: 1 }}>{b.icon}</div>
            <div>{b.label}</div>
          </button>
        ))}
      </div>

      {brushType === 'clone' && (
        <div style={{ ...css.section, fontSize: 11, color: T.muted, lineHeight: 1.6, marginTop: 6 }}>
          <strong style={{ color: T.text }}>Alt+click</strong> to set source, then paint.
        </div>
      )}

      {brushType === 'sponge' && (
        <div style={{ ...css.section, fontSize: 11, lineHeight: 1.6, marginTop: 6,
          color: (brushStrength ?? 50) > 50 ? '#22c55e' : T.muted }}>
          Mode: <strong>{(brushStrength ?? 50) > 50 ? 'Saturate ↑' : 'Desaturate ↓'}</strong>
          <span style={{ color: T.muted }}> — drag Strength to switch</span>
        </div>
      )}

      {/* Size — [ ] keys also resize */}
      <span style={css.label}>Size — {brushSize}px  <span style={{ color: T.muted, fontWeight: 400, textTransform: 'none' }}>( [ ] keys )</span></span>
      <div style={css.row}>
        <input type="range" min="1" max="500" value={brushSize}
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (e.buttons) onBrushSizeChange(Number(e.currentTarget.value)); }}
          onPointerUp={e => onBrushSizeChange(Number(e.currentTarget.value))}
          onChange={e => onBrushSizeChange(Number(e.target.value))}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.muted, minWidth: 32, textAlign: 'right' }}>{brushSize}px</span>
      </div>

      {/* Opacity (brushStrength = ceiling opacity for stroke) */}
      <span style={css.label}>Opacity — {brushStrength}%</span>
      <div style={css.row}>
        <input type="range" min="1" max="100" value={brushStrength}
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (e.buttons) onBrushStrengthChange(Number(e.currentTarget.value)); }}
          onPointerUp={e => onBrushStrengthChange(Number(e.currentTarget.value))}
          onChange={e => onBrushStrengthChange(Number(e.target.value))}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.muted, minWidth: 32, textAlign: 'right' }}>{brushStrength}%</span>
      </div>

      {/* Flow — per-dab buildup */}
      <span style={css.label}>Flow — {flow}%</span>
      <div style={css.row}>
        <input type="range" min="1" max="100" value={flow}
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (e.buttons) onBrushFlowChange(Number(e.currentTarget.value)); }}
          onPointerUp={e => onBrushFlowChange(Number(e.currentTarget.value))}
          onChange={e => onBrushFlowChange(Number(e.target.value))}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.muted, minWidth: 32, textAlign: 'right' }}>{flow}%</span>
      </div>
      <div style={{ fontSize: 10, color: T.muted, marginTop: 2, marginBottom: 2 }}>
        Opacity = max for stroke. Flow = buildup per dab.
      </div>

      {/* Smoothing — EMA */}
      <span style={css.label}>Smoothing — {brushSmoothing ?? 35}%</span>
      <div style={css.row}>
        <input type="range" min="0" max="100" value={brushSmoothing ?? 35}
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (e.buttons && onBrushSmoothingChange) onBrushSmoothingChange(Number(e.currentTarget.value)); }}
          onPointerUp={e => { if (onBrushSmoothingChange) onBrushSmoothingChange(Number(e.currentTarget.value)); }}
          onChange={e => { if (onBrushSmoothingChange) onBrushSmoothingChange(Number(e.target.value)); }}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.muted, minWidth: 32, textAlign: 'right' }}>{brushSmoothing ?? 35}%</span>
      </div>

      {/* Stabilizer */}
      <span style={css.label}>Stabilizer — {stabilizer}%</span>
      <div style={css.row}>
        <input type="range" min="0" max="95" value={stabilizer}
          onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => { if (e.buttons) onBrushStabilizerChange(Number(e.currentTarget.value)); }}
          onPointerUp={e => onBrushStabilizerChange(Number(e.currentTarget.value))}
          onChange={e => onBrushStabilizerChange(Number(e.target.value))}
          style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.muted, minWidth: 32, textAlign: 'right' }}>{stabilizer}%</span>
      </div>

      {/* Spacing — show/hide toggle */}
      <button onClick={() => setShowSpacing(s => !s)}
        style={{ fontSize: 10, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', width: '100%', textAlign: 'left', marginTop: 4 }}>
        {showSpacing ? '▾' : '▸'} Advanced — Spacing
      </button>
      {showSpacing && (
        <>
          <span style={css.label}>Spacing — {spacing}%</span>
          <div style={css.row}>
            <input type="range" min="1" max="200" value={spacing}
              onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={e => { if (e.buttons && onBrushSpacingChange) onBrushSpacingChange(Number(e.currentTarget.value)); }}
              onPointerUp={e => { if (onBrushSpacingChange) onBrushSpacingChange(Number(e.currentTarget.value)); }}
              onChange={e => { if (onBrushSpacingChange) onBrushSpacingChange(Number(e.target.value)); }}
              style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: T.muted, minWidth: 32, textAlign: 'right' }}>{spacing}%</span>
          </div>
        </>
      )}

      {/* Edge */}
      <span style={css.label}>Edge</span>
      <div style={{ display: 'flex', gap: 5 }}>
        {['soft', 'hard'].map(edge => (
          <button key={edge} onClick={() => onBrushEdgeChange(edge)}
            style={{
              flex: 1, padding: '7px', borderRadius: 6,
              border: `1px solid ${brushEdge === edge ? T.accent : T.border}`,
              background: brushEdge === edge ? `${T.accent}18` : T.input,
              color:      brushEdge === edge ? T.accent : T.text,
              fontSize: 11, cursor: 'pointer',
              fontWeight: brushEdge === edge ? '700' : '400',
              textTransform: 'capitalize',
            }}>{edge}</button>
        ))}
      </div>

      {(brushType === 'paint' || brushType === 'fill' || brushType === 'wetmix') && (
        <div>
          <span style={css.label}>Paint color</span>
          <input type="color" value={paintColor || '#ff0000'}
            onChange={e => onPaintColorChange(e.target.value)}
            style={{ width: '100%', height: 36, borderRadius: 6, border: `1px solid ${T.border}`, cursor: 'pointer', background: 'none' }} />

          <span style={css.label}>RGB sliders</span>
          <div style={css.section}>
            {(() => {
              const hex = (paintColor || '#ff0000').replace('#', '');
              const vals = [
                parseInt(hex.slice(0, 2), 16) || 0,
                parseInt(hex.slice(2, 4), 16) || 0,
                parseInt(hex.slice(4, 6), 16) || 0,
              ];
              const colors = ['#f87171', '#4ade80', '#60a5fa'];
              const labels = ['R', 'G', 'B'];
              return labels.map((l, idx) => (
                <div key={l} style={{ ...css.row, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: colors[idx], fontWeight: '700', width: 12 }}>{l}</span>
                  <input type="range" min={0} max={255} value={vals[idx]}
                    onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
                    onChange={e => {
                      const newVals = [...vals];
                      newVals[idx] = Number(e.target.value);
                      const newHex = '#' + newVals.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
                      onPaintColorChange(newHex);
                    }}
                    style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: T.text, width: 26, textAlign: 'right' }}>{vals[idx]}</span>
                </div>
              ));
            })()}
          </div>

          <span style={css.label}>Opacity — {paintAlpha || 100}%</span>
          <input type="range" min={1} max={100} value={paintAlpha || 100}
            onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
            onChange={e => onPaintAlphaChange(Number(e.target.value))}
            style={{ width: '100%' }} />

          <div style={{
            width: '100%', height: 32, borderRadius: 6,
            background: paintColor || '#ff0000',
            opacity: (paintAlpha || 100) / 100,
            border: `1px solid ${T.border}`,
            marginTop: 8,
          }} />
        </div>
      )}

      {/* Pressure sensitivity */}
      <span style={css.label}>Pressure sensitivity</span>
      <div style={{ ...css.section, marginTop: 0 }}>
        {tabletDetected && (
          <div style={{ fontSize: 10, color: '#4ade80', fontWeight: '600', marginBottom: 6 }}>
            ✓ Drawing tablet detected
          </div>
        )}
        {!tabletDetected && (
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>
            Connect a drawing tablet to enable pressure sensitivity.
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}>
          <input type="checkbox" checked={!!pressureEnabled} onChange={e => onPressureEnabledChange && onPressureEnabledChange(e.target.checked)} style={{ accentColor: '#ff6a00' }} />
          <span style={{ fontSize: 11, color: T.text, fontWeight: '600' }}>Enable pressure</span>
        </label>
        {pressureEnabled && (
          <div>
            <div style={{ ...css.row, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: T.muted, width: 50 }}>Maps to</span>
              <select value={pressureMapping || 'both'} onChange={e => onPressureMappingChange && onPressureMappingChange(e.target.value)}
                style={{ flex: 1, background: '#222', color: '#fff', border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 6px', fontSize: 11 }}>
                <option value="none">Nothing</option>
                <option value="size">Size only</option>
                <option value="opacity">Opacity only</option>
                <option value="both">Size + Opacity</option>
              </select>
            </div>
            <div style={{ ...css.row, marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: T.muted, width: 50 }}>Curve</span>
              <select value={pressureCurve || 'linear'} onChange={e => onPressureCurveChange && onPressureCurveChange(e.target.value)}
                style={{ flex: 1, background: '#222', color: '#fff', border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 6px', fontSize: 11 }}>
                <option value="linear">Linear</option>
                <option value="exponential">Exponential (light touch)</option>
                <option value="logarithmic">Logarithmic (easy full)</option>
              </select>
              <canvas ref={pressureCurveCanvasRef} width={60} height={40}
                style={{ borderRadius: 3, border: `1px solid ${T.border}`, flexShrink: 0 }} />
            </div>
            <div style={{ ...css.row, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: T.muted, width: 50 }}>Min %</span>
              <input type="range" min={0} max={100} value={pressureMin ?? 0}
                onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
                onChange={e => onPressureMinChange && onPressureMinChange(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#ff6a00' }} />
              <span style={{ fontSize: 10, color: T.muted, width: 26, textAlign: 'right' }}>{pressureMin ?? 0}%</span>
            </div>
            <div style={{ ...css.row }}>
              <span style={{ fontSize: 10, color: T.muted, width: 50 }}>Max %</span>
              <input type="range" min={0} max={100} value={pressureMax ?? 100}
                onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); }}
                onChange={e => onPressureMaxChange && onPressureMaxChange(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#ff6a00' }} />
              <span style={{ fontSize: 10, color: T.muted, width: 26, textAlign: 'right' }}>{pressureMax ?? 100}%</span>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => brushOverlayRef?.current?.undo()}
        style={{ width: '100%', padding: 9, borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: 12, cursor: 'pointer', fontWeight: '600', marginTop: 10 }}>
        ↩ Undo stroke
      </button>

      {/* Live preview */}
      <span style={css.label}>Preview</span>
      <div style={{ position: 'relative', width: '100%', height: 64, borderRadius: 8, background: T.bg, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width:  Math.min(brushSize * 1.4, 58),
          height: Math.min(brushSize * 1.4, 58),
          borderRadius: '50%',
          background: brushEdge === 'soft'
            ? `radial-gradient(circle, rgba(249,115,22,${brushStrength / 100}) 0%, rgba(249,115,22,${brushStrength / 300}) 50%, rgba(249,115,22,0) 100%)`
            : `rgba(249,115,22,${brushStrength / 100})`,
          border: '1.5px solid rgba(249,115,22,0.6)',
          transition: 'all 0.1s',
          opacity: flow / 100,
        }} />
      </div>

      <div style={{ ...css.section, fontSize: 11, color: T.muted, lineHeight: 1.6, marginTop: 8 }}>
        {brushTypes.find(b => b.key === brushType)?.desc}
      </div>
    </div>
  );
}
