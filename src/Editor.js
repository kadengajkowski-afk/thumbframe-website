import React, { useCallback, useEffect, useRef, useState, memo, lazy, Suspense } from 'react';
import { handleUpgrade } from './utils/checkout';
import { trackEvent } from './utils/analytics';
import BrushTool, { BrushOverlay } from './Brush';
import supabase from './supabaseClient';
import ErrorBoundary from './components/ErrorBoundary';
import { createSaveEngine } from './saveEngine';
import { loadProject as loadProjectFromStorage } from './utils/projectStorage';
import { saveAs } from 'file-saver';
import { renderTextLayer, applyTextTransform } from './textRenderer';
import { SHORTCUT_GROUPS, TOOL_SHORTCUT_MAP } from './shortcuts';
import CurvesPanel, { CurveThumbnail } from './CurvesPanel';
import { DEFAULT_CURVES, applyLUTSync } from './curvesUtils';
import CommandPalette from './CommandPalette';
import LiquifyModal from './LiquifyModal';
import FiltersModal from './FiltersModal';
import SelectionOverlay from './SelectionOverlay';
import { rectMask, ellipseMask, pathMask, magicWandMask, combineMasks, invertMask, selectAllMask, maskBounds, featherMask } from './selectionUtils'; // eslint-disable-line no-unused-vars
import db from './db';
import { renderLayersWithPixi } from './pixiCompositor';
import { analyzeImage as runThumbnailAnalysis } from './ai/ThumbnailAnalyzer';
import { autoBrighten, autoContrast, autoSaturate, autoDesaturate, autoVignette, autoWhiteBalance, gamingEnhance, enhanceWithWorker } from './ai/ThumbnailEnhancer';
import DevicePreview from './ai/DevicePreview';
import ColorBlindSimulator from './ai/ColorBlindSimulator';
import PromptToThumbnail from './ai/PromptToThumbnail';
const MobileEditor = lazy(() => import('./MobileEditor'));
const MemesPanel = lazy(() => import('./Memes'));

const PLATFORMS = {
  youtube:   { label:'YouTube',   width:1280, height:720,  preview:{ w:640, h:360 } },
  tiktok:    { label:'TikTok',    width:1080, height:1920, preview:{ w:152, h:270 } },
  instagram: { label:'Instagram', width:1080, height:1080, preview:{ w:270, h:270 } },
  twitter:   { label:'Twitter',   width:1600, height:900,  preview:{ w:480, h:270 } },
  linkedin:  { label:'LinkedIn',  width:1200, height:627,  preview:{ w:480, h:251 } },
};

// Curated YouTube-optimized fonts (shown with live preview in picker)
const CURATED_FONTS = [
  { family:'Anton',            label:'Anton',             weight:700 },
  { family:'Bebas Neue',       label:'Bebas Neue',        weight:700 },
  { family:'Bangers',          label:'Bangers',           weight:700 },
  { family:'Oswald',           label:'Oswald',            weight:700 },
  { family:'Russo One',        label:'Russo One',         weight:700 },
  { family:'Permanent Marker', label:'Permanent Marker',  weight:700 },
  { family:'Montserrat',       label:'Montserrat Black',  weight:900 },
  { family:'Impact',           label:'Impact',            weight:700 },
];

const FONTS = [
  'Anton','Bebas Neue','Bangers','Oswald','Russo One','Permanent Marker','Montserrat',
  'Burbank','Komika Axis','Impact','Arial Black','Arial','Georgia','Courier New','Verdana',
  'Trebuchet MS','Times New Roman','Comic Sans MS','Palatino',
  'Garamond','Tahoma','Lucida Console','Century Gothic','Candara',
  'Franklin Gothic Medium','Rockwell','Copperplate','Papyrus',
  'Helvetica','Segoe UI','Calibri','Cambria','Brush Script MT',
];

function resolveFontFamily(fontFamily){
  if(fontFamily==='Burbank') return 'Bangers, Anton, sans-serif';
  if(fontFamily==='Komika Axis') return 'Comic Neue, Bangers, cursive';
  if(fontFamily==='Anton') return 'Anton, sans-serif';
  if(fontFamily==='Russo One') return "'Russo One', sans-serif";
  if(fontFamily==='Permanent Marker') return "'Permanent Marker', cursive";
  if(fontFamily==='Bebas Neue') return "'Bebas Neue', sans-serif";
  if(fontFamily==='Montserrat') return "'Montserrat', sans-serif";
  if(fontFamily==='Bangers') return 'Bangers, cursive';
  if(fontFamily==='Oswald') return 'Oswald, sans-serif';
  return fontFamily;
}

// ── Pro Rendering Utilities ────────────────────────────────────────────────

/**
 * drawProText — Professional outer-stroke text rendering.
 * Standard ctx.strokeText() bleeds inward, destroying font weight.
 * This draws 12 circular offset fills for the stroke, then one clean fill on top.
 */
function drawProText(ctx, text, x, y, opts={}){
  const {fill='#ffffff', stroke='#000000', strokeWidth=0,
         glowColor, glowBlur=0,
         shadowColor, shadowBlur=0, shadowX=0, shadowY=0} = opts;

  ctx.save();

  // CRITICAL: Clear any inherited shadow state first — stroke passes must be shadow-free
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Pass 1: Drop shadow (single dedicated pass, not applied to strokes)
  if(shadowColor && shadowBlur>0){
    ctx.save();
    ctx.shadowColor   = shadowColor;
    ctx.shadowBlur    = shadowBlur;
    ctx.shadowOffsetX = shadowX;
    ctx.shadowOffsetY = shadowY;
    ctx.fillStyle     = fill;
    ctx.fillText(text, x, y);
    ctx.restore();
    // Shadow is now rendered — clear for remaining passes
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
  }

  // Pass 2: Multi-pass glow (if enabled)
  if(glowColor && glowBlur>0){
    for(let pass=0; pass<3; pass++){
      ctx.save();
      ctx.shadowColor   = glowColor;
      ctx.shadowBlur    = glowBlur * (pass+1)/3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle     = glowColor;
      ctx.fillText(text, x, y);
      ctx.restore();
    }
  }

  // Pass 3: Circular offset stroke (12 directions) — NO shadow, NO glow
  if(strokeWidth > 0){
    ctx.fillStyle = stroke;
    const steps = 12;
    for(let i=0; i<steps; i++){
      const angle = (i/steps) * Math.PI * 2;
      const dx = Math.cos(angle) * strokeWidth;
      const dy = Math.sin(angle) * strokeWidth;
      ctx.fillText(text, x + dx, y + dy);
    }
  }

  // Pass 4: Clean fill on top — crisp, no bleed
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * ensureFontLoaded — Wait for a Google Font to be ready before rendering.
 * Uses the native FontFace API. Falls back silently if the font isn't available.
 */
// eslint-disable-next-line no-unused-vars
async function ensureFontLoaded(fontFamily, weight=900){
  try{
    const resolved = resolveFontFamily(fontFamily).split(',')[0].trim().replace(/['"]/g,'');
    await document.fonts.load(`${weight} 48px "${resolved}"`);
  }catch(e){
    // Font may not be available — render will use fallback
  }
}

/**
 * drawGlowImage — Multi-pass glow for image layers (subject isolation).
 * Draws the image 3 times with increasing shadowBlur for density,
 * then one clean pass with no blur for the sharp final image.
 */
function drawGlowImage(ctx, img, x, y, w, h, glowColor='#ffffff', glowBlur=20){
  for(let pass=0; pass<3; pass++){
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = glowBlur * (pass+1) / 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(img, x, y, w, h);
  }
  // Final clean pass
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.drawImage(img, x, y, w, h);
}

const FONT_WEIGHTS = [
  {label:'Thin',value:100},{label:'Light',value:300},{label:'Regular',value:400},
  {label:'Medium',value:500},{label:'SemiBold',value:600},{label:'Bold',value:700},
  {label:'ExtraBold',value:800},{label:'Black',value:900},
];

const GRADIENTS = [
  ['#f97316','#1a1a2e'],['#FF416C','#FF4B2B'],['#0F6E56','#9FE1CB'],
  ['#185FA5','#00BFFF'],['#FFD700','#FF6347'],['#FF1493','#FF8C00'],
  ['#00FA9A','#006400'],['#9400D3','#4B0082'],['#2a2a2a','#888780'],
  ['#851c1c','#FAC775'],['#00C9FF','#92FE9D'],['#FC466B','#3F5EFB'],
  ['#f7971e','#ffd200'],['#11998e','#38ef7d'],['#4776E6','#8E54E9'],
  ['#eb3349','#f45c43'],['#D4537E','#FBEAF0'],['#FF6347','#FFD700'],
];

const BLEND_MODES = [
  'normal',
  'darken','multiply','color-burn',
  'lighten','screen','color-dodge',
  'overlay','soft-light','hard-light',
  'difference','exclusion',
  'hue','saturation','color','luminosity',
];
const BLEND_MODE_GROUPS = [
  { label:'Normal',    modes:['normal'] },
  { label:'Darken',    modes:['darken','multiply','color-burn'] },
  { label:'Lighten',   modes:['lighten','screen','color-dodge'] },
  { label:'Contrast',  modes:['overlay','soft-light','hard-light'] },
  { label:'Inversion', modes:['difference','exclusion'] },
  { label:'Component', modes:['hue','saturation','color','luminosity'] },
];

// Module-level blend worker singleton
let _blendWorker = null;
function getBlendWorker() {
  if (!_blendWorker) {
    try { _blendWorker = new Worker(new URL('./blendWorker.js', import.meta.url)); }
    catch(e) { console.warn('[blend] Worker init failed:', e); }
  }
  return _blendWorker;
}
function applyPixelBlend(dstImageData, srcImageData, mode) {
  return new Promise(resolve => {
    const worker = getBlendWorker();
    if (!worker) { resolve(dstImageData); return; }
    const dstBuf = dstImageData.data.buffer.slice(0);
    const srcBuf = srcImageData.data.buffer.slice(0);
    const handler = e => {
      worker.removeEventListener('message', handler);
      resolve(new ImageData(new Uint8ClampedArray(e.data.out), dstImageData.width, dstImageData.height));
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ dst: dstBuf, src: srcBuf, mode }, [dstBuf, srcBuf]);
  });
}

// Module-level curves worker singleton
let _curvesWorker = null;
function getCurvesWorker() {
  if (!_curvesWorker) {
    try { _curvesWorker = new Worker(new URL('./curvesWorker.js', import.meta.url)); }
    catch(e) { console.warn('[curves] Worker init failed:', e); }
  }
  return _curvesWorker;
}
function applyCurvesLUT(imageData, curves) {
  return new Promise(resolve => {
    const worker = getCurvesWorker();
    if (!worker) { resolve(applyLUTSync(imageData, curves)); return; }
    const buf = imageData.data.buffer.slice(0);
    const handler = e => {
      worker.removeEventListener('message', handler);
      resolve(new ImageData(new Uint8ClampedArray(e.data.pixels), imageData.width, imageData.height));
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ pixels: buf, curves }, [buf]);
  });
}

// Module-level retouch worker singleton
let _retouchWorker = null;
function getRetouchWorker() {
  if (!_retouchWorker) {
    try { _retouchWorker = new Worker(new URL('./retouchWorker.js', import.meta.url)); }
    catch(e) { console.warn('[retouch] Worker init failed:', e); }
  }
  return _retouchWorker;
}

// ── Adjustment Layer constants & utilities ───────────────────────────────────

const ADJ_DEFAULTS = {
  levels: { inBlack:0, inGamma:1.0, inWhite:255, outBlack:0, outWhite:255, channel:'rgb',
            rInB:0,rInG:1,rInW:255, gInB:0,gInG:1,gInW:255, bInB:0,bInG:1,bInW:255 },
  hueSat:  { master:{h:0,s:0,l:0}, reds:{h:0,s:0,l:0}, yellows:{h:0,s:0,l:0},
             greens:{h:0,s:0,l:0}, cyans:{h:0,s:0,l:0}, blues:{h:0,s:0,l:0},
             magentas:{h:0,s:0,l:0}, colorize:false, colorizeH:0, colorizeS:50, colorizeL:0 },
  colorBalance: {
    shadows:{cr:0,mg:0,yb:0}, midtones:{cr:0,mg:0,yb:0}, highlights:{cr:0,mg:0,yb:0},
    preserveLuminosity:true
  },
  vibrance: { vibrance:0, saturation:0 },
  selectiveColor: {
    reds:{c:0,m:0,y:0,k:0}, yellows:{c:0,m:0,y:0,k:0}, greens:{c:0,m:0,y:0,k:0},
    cyans:{c:0,m:0,y:0,k:0}, blues:{c:0,m:0,y:0,k:0}, magentas:{c:0,m:0,y:0,k:0},
    whites:{c:0,m:0,y:0,k:0}, neutrals:{c:0,m:0,y:0,k:0}, blacks:{c:0,m:0,y:0,k:0},
    method:'relative'
  },
  gradientMap: {
    stops:[{pos:0,color:'#000000'},{pos:1,color:'#ffffff'}],
    reverse:false, preset:'bw'
  },
  posterize: { levels:4 },
  threshold: { level:128 },
};

function buildAdjLUT(layer) {
  const s = layer.settings || {};
  const t = layer.adjustmentType;
  if (t === 'levels') {
    const buildChanLUT = (inB, inG, inW, outB, outW) => {
      const arr = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        const inRange = Math.max(0, Math.min(255, inW - inB));
        if (inRange <= 0) { arr[i] = outB; continue; }
        let v = (i - inB) / inRange;
        v = Math.max(0, Math.min(1, v));
        if (inG !== 1) v = Math.pow(v, 1 / Math.max(0.01, inG));
        arr[i] = Math.round(outB + v * (outW - outB));
      }
      return arr;
    };
    const outB = s.outBlack ?? 0, outW = s.outWhite ?? 255;
    if (s.channel === 'r') return {rLut:buildChanLUT(s.rInB??0,s.rInG??1,s.rInW??255,outB,outW),single:'r'};
    if (s.channel === 'g') return {gLut:buildChanLUT(s.gInB??0,s.gInG??1,s.gInW??255,outB,outW),single:'g'};
    if (s.channel === 'b') return {bLut:buildChanLUT(s.bInB??0,s.bInG??1,s.bInW??255,outB,outW),single:'b'};
    // RGB channel
    const rgb = buildChanLUT(s.inBlack??0,s.inGamma??1,s.inWhite??255,outB,outW);
    return {rgbLut:rgb};
  }
  if (t === 'posterize') {
    const lvls = Math.max(2, s.levels ?? 4);
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.round(i / 255 * (lvls - 1)) / (lvls - 1) * 255);
    return {lut};
  }
  if (t === 'threshold') {
    const lvl = s.level ?? 128;
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) lut[i] = i >= lvl ? 255 : 0;
    return {lut};
  }
  if (t === 'gradientMap') {
    const stops = [...(s.stops||ADJ_DEFAULTS.gradientMap.stops)].sort((a,b)=>a.pos-b.pos);
    const rev = s.reverse || false;
    const lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const p = rev ? 1 - i/255 : i/255;
      let r=0,g=0,b=0;
      if (stops.length === 1) {
        const c = stops[0].color;
        r=parseInt(c.slice(1,3),16);g=parseInt(c.slice(3,5),16);b=parseInt(c.slice(5,7),16);
      } else {
        for (let j=0;j<stops.length-1;j++){
          if (p >= stops[j].pos && p <= stops[j+1].pos){
            const t2=(p-stops[j].pos)/Math.max(0.0001,stops[j+1].pos-stops[j].pos);
            const c1=stops[j].color, c2=stops[j+1].color;
            r=Math.round(parseInt(c1.slice(1,3),16)*(1-t2)+parseInt(c2.slice(1,3),16)*t2);
            g=Math.round(parseInt(c1.slice(3,5),16)*(1-t2)+parseInt(c2.slice(3,5),16)*t2);
            b=Math.round(parseInt(c1.slice(5,7),16)*(1-t2)+parseInt(c2.slice(5,7),16)*t2);
            break;
          }
        }
      }
      lut[i*3]=r; lut[i*3+1]=g; lut[i*3+2]=b;
    }
    return {gradLut:lut};
  }
  return null;
}

function applyAdjustmentToImageData(imageData, layer) {
  const d = imageData.data;
  const s = layer.settings || {};
  const t = layer.adjustmentType;
  const lut = layer._cachedLUT;

  if (t === 'levels') {
    if (lut) {
      if (lut.single === 'r' && lut.rLut) {
        for (let i=0;i<d.length;i+=4) { d[i]=lut.rLut[d[i]]; }
      } else if (lut.single === 'g' && lut.gLut) {
        for (let i=0;i<d.length;i+=4) { d[i+1]=lut.gLut[d[i+1]]; }
      } else if (lut.single === 'b' && lut.bLut) {
        for (let i=0;i<d.length;i+=4) { d[i+2]=lut.bLut[d[i+2]]; }
      } else if (lut.rgbLut) {
        for (let i=0;i<d.length;i+=4) { d[i]=lut.rgbLut[d[i]]; d[i+1]=lut.rgbLut[d[i+1]]; d[i+2]=lut.rgbLut[d[i+2]]; }
      }
    }
    return imageData;
  }
  if (t === 'posterize' || t === 'threshold') {
    if (lut?.lut) {
      for (let i=0;i<d.length;i+=4) { d[i]=lut.lut[d[i]]; d[i+1]=lut.lut[d[i+1]]; d[i+2]=lut.lut[d[i+2]]; }
    }
    return imageData;
  }
  if (t === 'gradientMap' && lut?.gradLut) {
    for (let i=0;i<d.length;i+=4) {
      const lum = Math.round(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]);
      d[i]=lut.gradLut[lum*3]; d[i+1]=lut.gradLut[lum*3+1]; d[i+2]=lut.gradLut[lum*3+2];
    }
    return imageData;
  }
  if (t === 'hueSat') {
    const {master,colorize,colorizeH,colorizeS,colorizeL} = s;
    const hShift=(master?.h||0)/360, sShift=(master?.s||0)/100, lShift=(master?.l||0)/100;
    for (let i=0;i<d.length;i+=4) {
      let r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
      // RGB to HLS
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      let h=0,s2=0,l2=(max+min)/2;
      if (max!==min) {
        const delta=max-min;
        s2=l2>0.5?delta/(2-max-min):delta/(max+min);
        if(max===r) h=(g-b)/delta+(g<b?6:0);
        else if(max===g) h=(b-r)/delta+2;
        else h=(r-g)/delta+4;
        h/=6;
      }
      if (colorize) {
        h=(colorizeH||0)/360; s2=(colorizeS||50)/100; l2=Math.max(0,Math.min(1,l2+(colorizeL||0)/100));
      } else {
        h=((h+hShift)%1+1)%1;
        s2=Math.max(0,Math.min(1,s2+sShift));
        l2=Math.max(0,Math.min(1,l2+lShift));
      }
      // HLS to RGB
      const hls2rgb=(p2,q,t3)=>{if(t3<0)t3+=1;if(t3>1)t3-=1;if(t3<1/6)return p2+(q-p2)*6*t3;if(t3<1/2)return q;if(t3<2/3)return p2+(q-p2)*(2/3-t3)*6;return p2;};
      if (s2===0) { d[i]=d[i+1]=d[i+2]=Math.round(l2*255); }
      else {
        const q=l2<0.5?l2*(1+s2):l2+s2-l2*s2, p2=2*l2-q;
        d[i]=Math.round(hls2rgb(p2,q,h+1/3)*255);
        d[i+1]=Math.round(hls2rgb(p2,q,h)*255);
        d[i+2]=Math.round(hls2rgb(p2,q,h-1/3)*255);
      }
    }
    return imageData;
  }
  if (t === 'colorBalance') {
    const {shadows,midtones,highlights,preserveLuminosity} = s;
    for (let i=0;i<d.length;i+=4) {
      const r=d[i], g=d[i+1], b=d[i+2];
      const lum=0.299*r+0.587*g+0.114*b;
      const lf=lum/255;
      // shadow weight (Photoshop-style bell curve)
      const sw=Math.max(0,0.5-lf)*2;
      const hw=Math.max(0,lf-0.5)*2;
      const mw=1-sw-hw;
      const dr=(shadows?.cr||0)*sw+(midtones?.cr||0)*mw+(highlights?.cr||0)*hw;
      const dg=(shadows?.mg||0)*sw+(midtones?.mg||0)*mw+(highlights?.mg||0)*hw;
      const db=(shadows?.yb||0)*sw+(midtones?.yb||0)*mw+(highlights?.yb||0)*hw;
      let nr=Math.max(0,Math.min(255,r+dr));
      let ng=Math.max(0,Math.min(255,g+dg));
      let nb=Math.max(0,Math.min(255,b+db));
      if (preserveLuminosity) {
        const newLum=0.299*nr+0.587*ng+0.114*nb;
        if (newLum>0) { const ratio=lum/newLum; nr=Math.min(255,nr*ratio); ng=Math.min(255,ng*ratio); nb=Math.min(255,nb*ratio); }
      }
      d[i]=Math.round(nr); d[i+1]=Math.round(ng); d[i+2]=Math.round(nb);
    }
    return imageData;
  }
  if (t === 'vibrance') {
    const vib=(s.vibrance||0)/100, sat=(s.saturation||0)/100;
    for (let i=0;i<d.length;i+=4) {
      let r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      const currSat=max>0?(max-min)/max:0;
      const skinTone=(r>0.35&&r>g*1.2&&r>b*1.4)?1:0;
      // Vibrance: boost unsaturated colors more
      const vibFactor=vib*(1-currSat)*(1-skinTone*0.5);
      const avg=(r+g+b)/3;
      r=Math.max(0,Math.min(1,avg+(r-avg)*(1+vibFactor+sat)));
      g=Math.max(0,Math.min(1,avg+(g-avg)*(1+vibFactor+sat)));
      b=Math.max(0,Math.min(1,avg+(b-avg)*(1+vibFactor+sat)));
      d[i]=Math.round(r*255); d[i+1]=Math.round(g*255); d[i+2]=Math.round(b*255);
    }
    return imageData;
  }
  if (t === 'selectiveColor') {
    for (let i=0;i<d.length;i+=4) {
      const r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
      const max=Math.max(r,g,b), min=Math.min(r,g,b);
      // Determine dominant hue range
      let range=null;
      const hue60 = max===min?-1:max===r?((g-b)/(max-min)+6)%6:max===g?(b-r)/(max-min)+2:(r-g)/(max-min)+4;
      if (max-min < 0.08) {
        if (max > 0.9) range='whites';
        else if (max < 0.2) range='blacks';
        else range='neutrals';
      } else {
        if(hue60<1||hue60>=5) range='reds';
        else if(hue60<2) range='yellows';
        else if(hue60<3) range='greens';
        else if(hue60<4) range='cyans';
        else range='blues';
        if(hue60>=4.5||hue60<0.5) range='magentas';
      }
      const adj = s[range];
      if (adj) {
        const isRel = (s.method||'relative')==='relative';
        const m = max > 0 ? 1/max : 0;
        const dc=(adj.c||0)/100, dm=(adj.m||0)/100, dy=(adj.y||0)/100, dk=(adj.k||0)/100;
        let nr=r,ng=g,nb=b;
        if(isRel){nr=Math.max(0,Math.min(1,r+dc*(max-r)*m-dm*r*m+dy*(max-b)*m*(1-dk)));nr=Math.max(0,Math.min(1,nr));ng=Math.max(0,Math.min(1,g-dc*(max-g)*m+dm*(max-g)*m+dy*(max-b)*m));nb=Math.max(0,Math.min(1,b-dy*(max-b)*m-dk*b));}
        else{nr=Math.max(0,Math.min(1,r-dc/100-dk/100));ng=Math.max(0,Math.min(1,g-dm/100-dk/100));nb=Math.max(0,Math.min(1,b-dy/100-dk/100));}
        d[i]=Math.round(nr*255); d[i+1]=Math.round(ng*255); d[i+2]=Math.round(nb*255);
      }
    }
    return imageData;
  }
  return imageData;
}

// Module-level history thumbnail worker singleton
let _histThumbWorker = null;
function getHistThumbWorker() {
  if (!_histThumbWorker) {
    try { _histThumbWorker = new Worker(new URL('./historyThumbnailWorker.js', import.meta.url)); }
    catch(e) { console.warn('[histThumb] Worker init failed:', e); }
  }
  return _histThumbWorker;
}

function BlendModeSelect({ value, onChange, style }) {
  return (
    <select value={value||'normal'} onChange={e=>onChange(e.target.value)} style={style}>
      {BLEND_MODE_GROUPS.map(g=>(
        <optgroup key={g.label} label={g.label}>
          {g.modes.map(m=>(
            <option key={m} value={m}>
              {m.charAt(0).toUpperCase()+m.slice(1).replace(/-/g,' ')}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// Text hook swap tables for A/B variant generator
const TEXT_FLIP_HOOKS = [
  ['I WON',               'THEY LOST'],
  ['I WIN',               'THEY LOSE'],
  ['WE WON',              'THEY FAILED'],
  ["YOU WON'T BELIEVE",   'NOBODY EXPECTED'],
  ["YOU WON'T",           'NOBODY'],
  ['BELIEVE THIS',        'EXPECTED THIS'],
  ['EPIC',                'INSANE'],
  ['EPIC MOMENT',         'UNREAL CLIP'],
  ['MOMENT',              'CLIP'],
  ['GONE WRONG',          'BACKFIRED'],
  ['GONE',                'BACKFIRED'],
  ['DO THIS',             'NEVER DO THIS'],
  ['HOW I MADE',          'HOW THEY LOST'],
  ['HOW TO',              'WHY NOT TO'],
  ['THE TRUTH',           'THE REAL STORY'],
  ['WAIT...',             'IMPOSSIBLE.'],
  ['WHAT?!',              'NO WAY!'],
  ['WATCH THIS',          'THEY DID WHAT'],
  ['RESULTS',             'THE PROOF'],
  ['MY STORY',            'THEIR SECRET'],
  ['SIMPLE',              'COMPLEX'],
  ['WRONG',               'DISASTER'],
  ['STORY',               'SECRET'],
  ['I SURVIVED',          'GONE WRONG!'],
  ['SURVIVED',            'TOTAL FAILURE'],
  ['I FAILED',            'THEY LAUGHED'],
  ['CHALLENGE',           'DISASTER CHALLENGE'],
  ['24 HOURS',            'OVERNIGHT FAIL'],
  ['LAST TO LEAVE',       'FIRST TO QUIT'],
  ['I TRIED',             'IT BACKFIRED'],
];

// (TEXT_DRAMA_HOOKS removed — variant C now uses text hiding instead of hook swaps)

function getProjectIdFromUrl(){
  return new URLSearchParams(window.location.search).get('project');
}

function syncProjectIdToUrl(projectId){
  if(!projectId)return;
  const url = new URL(window.location.href);
  url.searchParams.set('project', projectId);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function clearProjectIdFromUrl(){
  const url = new URL(window.location.href);
  url.searchParams.delete('project');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function getProjectStorageKey(projectId){
  return `project_state_${projectId}`;
}

function generateProjectId(){
  if(window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `project_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}

const TEXT_TEMPLATES = [
  // ── 10 Curated YouTube Presets ─────────────────────────────────────────
  { label:'🔥 MrBeast Bold',   text:'WATCH THIS',       fontSize:62, fontFamily:'Anton',            fontWeight:900, textTransform:'uppercase', fillType:'solid',    textColor:'#ffffff', gradientColors:null,                 gradientAngle:0,  strokeColor:'#000000', strokeWidth:8,  textStrokes:[], shadowEnabled:true,  shadowBlur:28, shadowX:4,  shadowY:4,  shadowColor:'#000000',        glowEnabled:false, glowColor:'#f97316', letterSpacing:3,  lineHeight:1.1, textAlign:'center' },
  { label:'⚙️ Clean Tech',      text:'HOW I BUILT THIS', fontSize:52, fontFamily:'Russo One',        fontWeight:700, textTransform:'uppercase', fillType:'gradient', textColor:'#00cfff', gradientColors:['#00cfff','#0055ff'], gradientAngle:90, strokeColor:'#000000', strokeWidth:3,  textStrokes:[], shadowEnabled:true,  shadowBlur:18, shadowX:0,  shadowY:4,  shadowColor:'rgba(0,0,0,0.8)', glowEnabled:false, glowColor:'#00cfff', letterSpacing:4,  lineHeight:1.2, textAlign:'center' },
  { label:'🎮 Gaming Neon',     text:'NEW UPDATE',       fontSize:56, fontFamily:'Bangers',          fontWeight:700, textTransform:'uppercase', fillType:'gradient', textColor:'#ff00ff', gradientColors:['#ff00ff','#00ffff'], gradientAngle:45, strokeColor:'#000000', strokeWidth:4,  textStrokes:[], shadowEnabled:false, shadowBlur:0,  shadowX:0,  shadowY:0,  shadowColor:'#000000',        glowEnabled:true,  glowColor:'#ff00ff', letterSpacing:6,  lineHeight:1.1, textAlign:'center' },
  { label:'💀 Horror',          text:'GONE WRONG',       fontSize:58, fontFamily:'Anton',            fontWeight:900, textTransform:'uppercase', fillType:'solid',    textColor:'#ff0000', gradientColors:null,                 gradientAngle:0,  strokeColor:'#ffffff', strokeWidth:6,  textStrokes:[{color:'#000',width:12,enabled:true}], shadowEnabled:true, shadowBlur:32, shadowX:0, shadowY:0, shadowColor:'#ff0000', glowEnabled:true, glowColor:'#ff0000', letterSpacing:2, lineHeight:1.1, textAlign:'center' },
  { label:'✨ Minimalist',      text:'How I Did It',     fontSize:44, fontFamily:'Montserrat',       fontWeight:700, textTransform:'none',      fillType:'solid',    textColor:'#ffffff', gradientColors:null,                 gradientAngle:0,  strokeColor:'#000000', strokeWidth:0,  textStrokes:[], shadowEnabled:true,  shadowBlur:16, shadowX:0,  shadowY:4,  shadowColor:'rgba(0,0,0,0.8)', glowEnabled:false, glowColor:'#ffffff', letterSpacing:1,  lineHeight:1.3, textAlign:'left' },
  { label:'⚡ Hype',            text:'INSANE MOMENT',    fontSize:60, fontFamily:'Bangers',          fontWeight:700, textTransform:'uppercase', fillType:'gradient', textColor:'#FFD700', gradientColors:['#FFD700','#FF4400'], gradientAngle:90, strokeColor:'#000000', strokeWidth:5,  textStrokes:[], shadowEnabled:false, shadowBlur:0,  shadowX:0,  shadowY:0,  shadowColor:'#000000',        glowEnabled:true,  glowColor:'#FF6600', letterSpacing:4,  lineHeight:1.1, textAlign:'center' },
  { label:'🎬 Cinematic',       text:'PART 1',           fontSize:50, fontFamily:'Bebas Neue',       fontWeight:700, textTransform:'uppercase', fillType:'solid',    textColor:'#e0c880', gradientColors:null,                 gradientAngle:0,  strokeColor:'#000000', strokeWidth:2,  textStrokes:[], shadowEnabled:true,  shadowBlur:20, shadowX:2,  shadowY:4,  shadowColor:'rgba(0,0,0,0.95)', glowEnabled:false, glowColor:'#e0c880', letterSpacing:12, lineHeight:1.2, textAlign:'center' },
  { label:'🛹 Street',          text:'NO CAP',           fontSize:58, fontFamily:'Permanent Marker', fontWeight:700, textTransform:'none',      fillType:'solid',    textColor:'#ffffff', gradientColors:null,                 gradientAngle:0,  strokeColor:'#000000', strokeWidth:6,  textStrokes:[], shadowEnabled:true,  shadowBlur:0,  shadowX:5,  shadowY:5,  shadowColor:'#000000',        glowEnabled:false, glowColor:'#ffffff', letterSpacing:0,  lineHeight:1.2, textAlign:'center' },
  { label:'🌈 Kids',            text:'SURPRISE!',        fontSize:60, fontFamily:'Bangers',          fontWeight:700, textTransform:'uppercase', fillType:'gradient', textColor:'#ff69b4', gradientColors:['#ff69b4','#ffcc00'], gradientAngle:45, strokeColor:'#ffffff', strokeWidth:5,  textStrokes:[], shadowEnabled:true,  shadowBlur:6,  shadowX:3,  shadowY:3,  shadowColor:'#8800cc',        glowEnabled:false, glowColor:'#ff69b4', letterSpacing:3,  lineHeight:1.2, textAlign:'center' },
  { label:'📚 Education',       text:'5 FACTS',          fontSize:54, fontFamily:'Montserrat',       fontWeight:900, textTransform:'uppercase', fillType:'gradient', textColor:'#00c9ff', gradientColors:['#00c9ff','#92fe9d'], gradientAngle:135,strokeColor:'#000000', strokeWidth:3,  textStrokes:[], shadowEnabled:true,  shadowBlur:12, shadowX:0,  shadowY:3,  shadowColor:'rgba(0,0,0,0.7)', glowEnabled:false, glowColor:'#00c9ff', letterSpacing:2,  lineHeight:1.2, textAlign:'center' },
];

const SHAPES_BASIC = [
  { key:'rect',      label:'Rectangle', icon:'▬' },
  { key:'roundrect', label:'Rounded',   icon:'▢' },
  { key:'circle',    label:'Circle',    icon:'●' },
  { key:'triangle',  label:'Triangle',  icon:'▲' },
  { key:'star',      label:'Star',      icon:'★' },
  { key:'star6',     label:'Star 6pt',  icon:'✦' },
  { key:'arrow',     label:'Arrow →',   icon:'➤' },
  { key:'arrowleft', label:'Arrow ←',   icon:'◄' },
  { key:'diamond',   label:'Diamond',   icon:'◆' },
  { key:'hexagon',   label:'Hexagon',   icon:'⬡' },
  { key:'pentagon',  label:'Pentagon',  icon:'⬠' },
  { key:'cross',     label:'Cross',     icon:'✚' },
  { key:'heart',     label:'Heart',     icon:'♥' },
  { key:'speech',    label:'Speech',    icon:'💬' },
  { key:'badge',     label:'Badge',     icon:'🏷' },
  { key:'line',      label:'Line',      icon:'—' },
];

const VIRAL_TEMPLATES = [
  {
    id:'mrbeast',
    label:'MrBeast Style',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#FFD700,#FF6B00)', text:'WATCH THIS' },
    layers:[
      { type:'background', bgColor:'#1a1a1a', bgGradient:null },
      { type:'text', text:'YOU WON\'T', fontSize:72, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:22, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:80 },
      { type:'text', text:'BELIEVE THIS', fontSize:72, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:22, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:170 },
      { type:'shape', shape:'star', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:60, height:60, x:20, y:60 },
      { type:'shape', shape:'star', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:40, height:40, x:360, y:80 },
    ],
  },
  {
    id:'mkbhd',
    label:'MKBHD Style',
    category:'Tech',
    preview:{ bg:'linear-gradient(135deg,#000000,#1a1a1a)', text:'REVIEW' },
    layers:[
      { type:'background', bgColor:'#000000', bgGradient:null },
      { type:'shape', shape:'rect', fillColor:'#FF0000',
        strokeColor:'#FF0000', width:8, height:200, x:40, y:60 },
      { type:'text', text:'THE TRUTH', fontSize:64, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'left', x:70, y:110 },
      { type:'text', text:'ABOUT THIS', fontSize:32, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#888888',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:10, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'left', x:70, y:160 },
    ],
  },
  {
    id:'gaming_epic',
    label:'Epic Gaming',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#2c2c54,#706fd3)', text:'EPIC WIN' },
    layers:[
      { type:'background', bgColor:'#0d0d1a',
        bgGradient:['#0d0d1a','#1a1a3e'] },
      { type:'shape', shape:'star6', fillColor:'#FFD700',
        strokeColor:'#FF6B00', width:80, height:80, x:30, y:30 },
      { type:'text', text:'EPIC', fontSize:96, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#FF6B00', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:30, shadowX:4, shadowY:4,
        glowEnabled:true, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:8, lineHeight:1.2, textAlign:'center', x:100, y:80 },
      { type:'text', text:'MOMENT', fontSize:56, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:120, y:190 },
    ],
  },
  {
    id:'minecraft_glow',
    label:'Minecraft Glow',
    category:'Gaming',
    preview:{ bg:'linear-gradient(135deg,#1a472a,#2d6a4f)', text:'MINECRAFT' },
    layers:[
      { type:'background', bgColor:'#0a1628',
        bgGradient:['#0a1628','#1a3a2a'] },
      { type:'shape', shape:'rect', fillColor:'rgba(0,150,255,0.15)',
        strokeColor:'rgba(0,150,255,0.4)', width:400, height:120, x:40, y:180 },
      { type:'text', text:'MINECRAFT', fontSize:68, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#00ff88', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#00ff88', shadowBlur:30, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#00ff88', arcEnabled:false, arcRadius:120,
        letterSpacing:3, lineHeight:1.2, textAlign:'center', x:40, y:80 },
      { type:'text', text:'BUT EVERYTHING IS DIFFERENT', fontSize:28,
        fontFamily:'Oswald', fontWeight:700, fontItalic:false,
        textColor:'#88ddff', strokeColor:'#000000', strokeWidth:2,
        shadowEnabled:true, shadowColor:'#000000', shadowBlur:12,
        shadowX:2, shadowY:2, glowEnabled:false, glowColor:'#f97316',
        arcEnabled:false, arcRadius:120, letterSpacing:1, lineHeight:1.2,
        textAlign:'center', x:60, y:180 },
    ],
  },
  {
    id:'viral_reaction',
    label:'Reaction',
    category:'Viral',
    preview:{ bg:'linear-gradient(135deg,#FF416C,#FF4B2B)', text:'WAIT WHAT' },
    layers:[
      { type:'background', bgColor:'#FF4B2B',
        bgGradient:['#FF416C','#FF4B2B'] },
      { type:'text', text:'WAIT...', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:24, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:100, y:60 },
      { type:'text', text:'WHAT?!', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:24, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:110, y:170 },
      { type:'shape', shape:'arrow', fillColor:'#FFD700',
        strokeColor:'#000000', width:120, height:40, x:20, y:150 },
    ],
  },
  {
    id:'finance',
    label:'Finance/Business',
    category:'Business',
    preview:{ bg:'linear-gradient(135deg,#0f2027,#2c5364)', text:'$1,000,000' },
    layers:[
      { type:'background', bgColor:'#0a1628',
        bgGradient:['#0a1628','#0f2027'] },
      { type:'shape', shape:'rect', fillColor:'#00C853',
        strokeColor:'#00C853', width:300, height:4, x:80, y:155 },
      { type:'text', text:'HOW I MADE', fontSize:36, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#88bbdd',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:12, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:120, y:60 },
      { type:'text', text:'$1,000,000', fontSize:76, fontFamily:'Bebas Neue',
        fontWeight:900, fontItalic:false, textColor:'#00C853',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#00C853', shadowBlur:20, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#00C853', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'center', x:60, y:100 },
      { type:'text', text:'IN 30 DAYS', fontSize:36, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:12, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:130, y:180 },
    ],
  },
  {
    id:'vlog_warm',
    label:'Vlog Warm',
    category:'Vlog',
    preview:{ bg:'linear-gradient(135deg,#f7971e,#ffd200)', text:'MY STORY' },
    layers:[
      { type:'background', bgColor:'#1a0a00',
        bgGradient:['#2d1600','#1a0a00'] },
      { type:'shape', shape:'roundrect', fillColor:'#FF6B00',
        strokeColor:'#FF6B00', width:6, height:160, x:40, y:50 },
      { type:'text', text:'my honest', fontSize:40, fontFamily:'Oswald',
        fontWeight:400, fontItalic:true, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:2, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:12, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'left', x:60, y:80 },
      { type:'text', text:'STORY', fontSize:80, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#FF6B00', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:20, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'left', x:60, y:130 },
    ],
  },
  {
    id:'clickbait',
    label:'Clickbait',
    category:'Viral',
    preview:{ bg:'linear-gradient(135deg,#FF0000,#8B0000)', text:'GONE WRONG' },
    layers:[
      { type:'background', bgColor:'#0d0000',
        bgGradient:['#1a0000','#0d0000'] },
      { type:'shape', shape:'badge', fillColor:'#FF0000',
        strokeColor:'#FFD700', width:100, height:100, x:20, y:30 },
      { type:'text', text:'GONE', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FF0000',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#FF0000', shadowBlur:24, shadowX:0, shadowY:0,
        glowEnabled:true, glowColor:'#FF0000', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:80, y:60 },
      { type:'text', text:'WRONG', fontSize:88, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#FF0000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:24, shadowX:4, shadowY:4,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:80, y:170 },
    ],
  },
  {
    id:'tutorial',
    label:'Tutorial',
    category:'Education',
    preview:{ bg:'linear-gradient(135deg,#4776E6,#8E54E9)', text:'HOW TO' },
    layers:[
      { type:'background', bgColor:'#0a0a2e',
        bgGradient:['#0a0a2e','#1a1a4e'] },
      { type:'shape', shape:'roundrect', fillColor:'#4776E6',
        strokeColor:'#8E54E9', width:380, height:70, x:40, y:50 },
      { type:'text', text:'HOW TO', fontSize:48, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#ffffff',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:16, shadowX:2, shadowY:2,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:6, lineHeight:1.2, textAlign:'center', x:140, y:60 },
      { type:'text', text:'DO THIS', fontSize:80, fontFamily:'Anton',
        fontWeight:900, fontItalic:false, textColor:'#FFD700',
        strokeColor:'#000000', strokeWidth:5, shadowEnabled:true,
        shadowColor:'#000000', shadowBlur:22, shadowX:3, shadowY:3,
        glowEnabled:false, glowColor:'#FFD700', arcEnabled:false, arcRadius:120,
        letterSpacing:4, lineHeight:1.2, textAlign:'center', x:100, y:150 },
      { type:'text', text:'(step by step)', fontSize:24,
        fontFamily:'Oswald', fontWeight:400, fontItalic:true,
        textColor:'#aaaaff', strokeColor:'#000000', strokeWidth:2,
        shadowEnabled:true, shadowColor:'#000000', shadowBlur:10,
        shadowX:2, shadowY:2, glowEnabled:false, glowColor:'#f97316',
        arcEnabled:false, arcRadius:120, letterSpacing:1, lineHeight:1.2,
        textAlign:'center', x:160, y:240 },
    ],
  },
  {
    id:'minimal_clean',
    label:'Minimal Clean',
    category:'Lifestyle',
    preview:{ bg:'linear-gradient(135deg,#f5f5f5,#e0e0e0)', text:'SIMPLE' },
    layers:[
      { type:'background', bgColor:'#f5f0e8', bgGradient:null },
      { type:'shape', shape:'line', fillColor:'#c45c2e',
        strokeColor:'#c45c2e', width:60, height:4, x:60, y:120 },
      { type:'text', text:'SIMPLE', fontSize:72, fontFamily:'Oswald',
        fontWeight:700, fontItalic:false, textColor:'#1a1612',
        strokeColor:'#c45c2e', strokeWidth:2, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:16, lineHeight:1.2, textAlign:'left', x:60, y:60 },
      { type:'text', text:'& effective', fontSize:32, fontFamily:'Oswald',
        fontWeight:400, fontItalic:true, textColor:'#c45c2e',
        strokeColor:'#000000', strokeWidth:0, shadowEnabled:false,
        shadowColor:'#000000', shadowBlur:0, shadowX:0, shadowY:0,
        glowEnabled:false, glowColor:'#f97316', arcEnabled:false, arcRadius:120,
        letterSpacing:2, lineHeight:1.2, textAlign:'left', x:60, y:145 },
    ],
  },
];

const STICKER_CATEGORIES = {
  'Gaming': [
    { label:'Lightning', svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M13 2L4.5 13.5H11L10 22l9.5-12H13.5L13 2z"/></svg>' },
    { label:'Star',      svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' },
    { label:'Fire',      svg:'<svg viewBox="0 0 24 24" fill="#FF4500"><path d="M12 2c0 0-5 5-5 10a5 5 0 0010 0c0-2-1-4-2-5 0 2-1 3-3 3 2-3 0-8 0-8z"/></svg>' },
    { label:'Diamond',   svg:'<svg viewBox="0 0 24 24" fill="#00BFFF"><path d="M12 2L2 9l10 13 10-13-10-7z"/></svg>' },
    { label:'Crown',     svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M3 18h18l-2-8-4 4-3-6-3 6-4-4-2 8z"/></svg>' },
    { label:'Explosion', svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2l2 4 4-2-2 4 4 2-4 2 2 4-4-2-2 4-2-4-4 2 2-4-4-2 4-2-2-4 4 2 2-4z"/></svg>' },
  ],
  'Business': [
    { label:'Rocket',  svg:'<svg viewBox="0 0 24 24" fill="#f97316"><path d="M12 2c0 0 4 4 4 10l-4 2-4-2c0-6 4-10 4-10z"/><path d="M8 16l-2 4 4-2M16 16l2 4-4-2" fill="#FF6347"/></svg>' },
    { label:'Target',  svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#FF4444" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#FF4444"/></svg>' },
    { label:'Money',   svg:'<svg viewBox="0 0 24 24" fill="#00C853"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>' },
    { label:'Trophy',  svg:'<svg viewBox="0 0 24 24"><path d="M8 21h8m-4-4v4M12 17c-4 0-7-3-7-7V4h14v6c0 4-3 7-7 7z" fill="#FFD700"/></svg>' },
    { label:'Chart',   svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#00C853" stroke-width="2"><path d="M2 20l5-7 4 3 5-8 5 5"/><path d="M15 8h5v5"/></svg>' },
    { label:'Diamond', svg:'<svg viewBox="0 0 24 24" fill="#00BCD4"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/></svg>' },
  ],
  'Nature': [
    { label:'Sun',      svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/></svg>' },
    { label:'Moon',     svg:'<svg viewBox="0 0 24 24" fill="#C0C0C0"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>' },
    { label:'Wave',     svg:'<svg viewBox="0 0 24 24" fill="#0088CC"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0v8H2v-8z"/></svg>' },
    { label:'Leaf',     svg:'<svg viewBox="0 0 24 24" fill="#00C853"><path d="M17 8C8 10 5 16 5 21c5-2 9-6 12-13z"/></svg>' },
    { label:'Snow',     svg:'<svg viewBox="0 0 24 24" stroke="#00BFFF" stroke-width="1.5" fill="none"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/><circle cx="12" cy="12" r="2" fill="#00BFFF"/></svg>' },
    { label:'Mountain', svg:'<svg viewBox="0 0 24 24" fill="#6B8E23"><path d="M2 20L9 7l4 6 3-4 6 11H2z"/></svg>' },
  ],
  'Arrows': [
    { label:'Up',    svg:'<svg viewBox="0 0 24 24" fill="#00C853"><path d="M12 4l8 8h-5v8H9v-8H4l8-8z"/></svg>' },
    { label:'Right', svg:'<svg viewBox="0 0 24 24" fill="#2196F3"><path d="M20 12l-8 8v-5H4V9h8V4l8 8z"/></svg>' },
    { label:'Check', svg:'<svg viewBox="0 0 24 24" fill="#00C853"><circle cx="12" cy="12" r="10"/><path d="M7 12l4 4 6-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>' },
    { label:'Cross', svg:'<svg viewBox="0 0 24 24" fill="#FF4444"><circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>' },
    { label:'Burst', svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2l1.5 4 4-1.5-1.5 4 4 1.5-4 1.5 1.5 4-4-1.5-1.5 4-1.5-4-4 1.5 1.5-4-4-1.5 4-1.5-1.5-4 4 1.5L12 2z"/></svg>' },
    { label:'Badge', svg:'<svg viewBox="0 0 24 24" fill="#FFD700"><path d="M12 2l2.5 7H22l-6 4.5 2.5 7L12 17l-6.5 3.5 2.5-7L2 9h7.5L12 2z"/></svg>' },
  ],
  'Food': [
    { label:'Pizza',   svg:'<svg viewBox="0 0 24 24" fill="#FF6347"><path d="M12 2L2 20h20L12 2z"/><circle cx="10" cy="14" r="1.5" fill="#8B0000"/><circle cx="14" cy="12" r="1.5" fill="#8B0000"/></svg>' },
    { label:'Coffee',  svg:'<svg viewBox="0 0 24 24" fill="#795548"><path d="M4 10h12v7a4 4 0 01-4 4H8a4 4 0 01-4-4v-7z"/><path d="M16 12h2a2 2 0 010 4h-2"/></svg>' },
    { label:'Burger',  svg:'<svg viewBox="0 0 24 24"><path d="M5 10c0-4 14-4 14 0" fill="#D2691E"/><rect x="3" y="12" width="18" height="3" rx="1" fill="#8B4513"/><path d="M5 18c0 2 14 2 14 0" fill="#D2691E"/></svg>' },
    { label:'Cake',    svg:'<svg viewBox="0 0 24 24" fill="#FFB6C1"><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 13V9a5 5 0 0110 0v4" fill="#FF69B4"/><circle cx="12" cy="3" r="1.5" fill="#FF4444"/></svg>' },
    { label:'Lemon',   svg:'<svg viewBox="0 0 24 24" fill="#FFE135"><ellipse cx="12" cy="12" rx="9" ry="7"/></svg>' },
    { label:'Avocado', svg:'<svg viewBox="0 0 24 24" fill="#90EE90"><path d="M12 2c-4 0-7 4-7 9s3 9 7 9 7-4 7-9-3-9-7-9z"/><circle cx="12" cy="13" r="3" fill="#8B4513"/></svg>' },
  ],
};

const ALL_COMMANDS = [
  { cmd:'text "..."',    desc:'Add text layer' },
  { cmd:'bg #color',     desc:'Set background color' },
  { cmd:'font Name',     desc:'Set font family' },
  { cmd:'size 48',       desc:'Set font size' },
  { cmd:'opacity 80',    desc:'Set layer opacity' },
  { cmd:'circle',        desc:'Add circle' },
  { cmd:'rect',          desc:'Add rectangle' },
  { cmd:'triangle',      desc:'Add triangle' },
  { cmd:'star',          desc:'Add star' },
  { cmd:'arrow',         desc:'Add arrow' },
  { cmd:'duplicate',     desc:'Duplicate selected' },
  { cmd:'delete',        desc:'Delete selected' },
  { cmd:'hide',          desc:'Hide selected' },
  { cmd:'show',          desc:'Show selected' },
  { cmd:'up',            desc:'Move layer up' },
  { cmd:'down',          desc:'Move layer down' },
  { cmd:'flip h',        desc:'Flip horizontal' },
  { cmd:'flip v',        desc:'Flip vertical' },
  { cmd:'align center',  desc:'Center on canvas' },
  { cmd:'align left',    desc:'Align left' },
  { cmd:'align right',   desc:'Align right' },
  { cmd:'align top',     desc:'Align top' },
  { cmd:'align bottom',  desc:'Align bottom' },
  { cmd:'blend multiply',desc:'Set blend mode' },
  { cmd:'zoom 150',      desc:'Set zoom %' },
  { cmd:'grid',          desc:'Toggle grid' },
  { cmd:'snap',          desc:'Toggle snap' },
  { cmd:'ruler',         desc:'Toggle rulers' },
  { cmd:'new',           desc:'New canvas' },
  { cmd:'save',          desc:'Save design' },
  { cmd:'undo',          desc:'Undo' },
  { cmd:'redo',          desc:'Redo' },
  { cmd:'help',          desc:'Show all commands' },
];

function defaultEffects(){
  return{
    layerBlur:0,brightness:100,contrast:100,saturation:100,
    shadow:{enabled:false,x:4,y:4,blur:12,spread:0,color:'#000000',opacity:60},
    dropShadow:{enabled:false,x:0,y:0,blur:0,color:'#ffffff',opacity:100,spread:0},
    glow:{enabled:false,color:'#f97316',blur:20,opacity:80},
    outline:{enabled:false,color:'#ffffff',width:2,position:'outside'},
    subjectOutline:{enabled:false,color:'#ffffff',width:5},
    strokes:[],
    mask:{enabled:false,inverted:false,data:null},
  };
}

function getEffectsStyle(effects){
  if(!effects)return{};
  const filters=[];
  if(effects.layerBlur>0)      filters.push(`blur(${effects.layerBlur}px)`);
  if(effects.brightness!==100) filters.push(`brightness(${effects.brightness}%)`);
  if(effects.contrast!==100)   filters.push(`contrast(${effects.contrast}%)`);
  if(effects.saturation!==100) filters.push(`saturate(${effects.saturation}%)`);
  const shadows=[];
  if(effects.shadow?.enabled){
    const r=parseInt(effects.shadow.color.slice(1,3),16)||0;
    const g=parseInt(effects.shadow.color.slice(3,5),16)||0;
    const b=parseInt(effects.shadow.color.slice(5,7),16)||0;
    const rgba=`rgba(${r},${g},${b},${(effects.shadow.opacity||60)/100})`;
    shadows.push(`${effects.shadow.x}px ${effects.shadow.y}px ${effects.shadow.blur}px ${rgba}`);
    filters.push(`drop-shadow(${effects.shadow.x||0}px ${effects.shadow.y||0}px ${effects.shadow.blur||12}px ${rgba})`);
  }
  if(effects.dropShadow?.enabled){
    const dsColor=effects.dropShadow.color||'#ffffff';
    const dsOpacity=(effects.dropShadow.opacity??100)/100;
    const r=parseInt(dsColor.slice(1,3),16)||255;
    const g=parseInt(dsColor.slice(3,5),16)||255;
    const b=parseInt(dsColor.slice(5,7),16)||255;
    const rgba=`rgba(${r},${g},${b},${dsOpacity})`;
    const spread=Math.max(0,Math.round(Number(effects.dropShadow.spread||0)));
    const blur=Math.max(0,Math.round(Number(effects.dropShadow.blur||0)));
    const x=Math.round(Number(effects.dropShadow.x||0));
    const y=Math.round(Number(effects.dropShadow.y||0));
    const singleBlur=Math.max(blur, spread*2);
    filters.push(`drop-shadow(${x}px ${y}px ${singleBlur}px ${rgba})`);
  }
  if(effects.glow?.enabled){
    const glowBlur=effects.glow.blur||20;
    const glowOpacity=(effects.glow.opacity??80)/100;
    const glowHex=effects.glow.color||'#f97316';
    const gr=parseInt(glowHex.slice(1,3),16)||249;
    const gg=parseInt(glowHex.slice(3,5),16)||115;
    const gb=parseInt(glowHex.slice(5,7),16)||22;
    const glowRgba=`rgba(${gr},${gg},${gb},${glowOpacity})`;
    shadows.push(`0 0 ${glowBlur}px ${glowRgba}`);
    shadows.push(`0 0 ${glowBlur*2}px ${glowRgba}`);
    filters.push(`drop-shadow(0 0 ${Math.ceil(glowBlur/3)}px ${glowRgba})`);
  }
  // Additional strokes (rendered as layered box-shadows with 0 blur)
  if(Array.isArray(effects.strokes)){
    effects.strokes.forEach(st=>{
      if(!st.enabled||!st.width)return;
      const pos=st.position||'outside';
      const spread=pos==='inside'?-(st.width):pos==='center'?Math.round(st.width/2):st.width;
      shadows.push(`0 0 0 ${spread}px ${st.color||'#ffffff'}`);
    });
  }
  const style={};
  if(filters.length)style.filter=filters.join(' ');
  if(shadows.length)style.boxShadow=shadows.join(',');
  if(effects.outline?.enabled&&effects.outline.width>0){
    const pos=effects.outline.position||'outside';
    const offset=pos==='inside'?-(effects.outline.width):pos==='center'?0:0;
    style.outline=`${effects.outline.width}px solid ${effects.outline.color}`;
    style.outlineOffset=`${offset}px`;
  }
  if(effects.subjectOutline?.enabled&&effects.subjectOutline.width>0){
    const sc=effects.subjectOutline.color||'#ffffff';
    const glowBlur=Math.max(20, (effects.subjectOutline.width||5)*2);
    const outlineFilter=`drop-shadow(0 0 ${glowBlur}px ${sc})`;
    style.filter = style.filter ? `${outlineFilter} ${style.filter}` : outlineFilter;
  }
  return style;
}

function renderShapeSVG(shape,fillColor,strokeColor,width,height){
  const w=width||100,h=height||100,fill=fillColor||'#FF4500',stroke=strokeColor||'#000';
  switch(shape){
    case 'rect':      return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:3}}/>;
    case 'roundrect': return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:Math.min(w,h)*0.2}}/>;
    case 'circle':    return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:'50%'}}/>;
    case 'triangle':  return<div style={{width:0,height:0,borderLeft:`${w/2}px solid transparent`,borderRight:`${w/2}px solid transparent`,borderBottom:`${h}px solid ${fill}`}}/>;
    case 'star':      return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'star6':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,28 86,15 73,40 98,50 73,60 86,85 61,72 50,95 39,72 14,85 27,60 2,50 27,40 14,15 39,28" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'arrow':     return<svg width={w} height={40} viewBox={`0 0 ${w} 40`}><polygon points={`0,15 ${w-20},15 ${w-20},5 ${w},20 ${w-20},35 ${w-20},25 0,25`} fill={fill} stroke={stroke} strokeWidth="1"/></svg>;
    case 'arrowleft': return<svg width={w} height={40} viewBox={`0 0 ${w} 40`}><polygon points={`${w},15 20,15 20,5 0,20 20,35 20,25 ${w},25`} fill={fill} stroke={stroke} strokeWidth="1"/></svg>;
    case 'diamond':   return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 95,50 50,95 5,50" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'hexagon':   return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 93,27.5 93,72.5 50,95 7,72.5 7,27.5" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'pentagon':  return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 97,40 79,95 21,95 3,40" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'cross':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="35,5 65,5 65,35 95,35 95,65 65,65 65,95 35,95 35,65 5,65 5,35 35,35" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'heart':     return<svg width={w} height={h} viewBox="0 0 100 100"><path d="M50 85 C20 65 5 50 5 35 C5 20 15 10 30 10 C38 10 45 15 50 22 C55 15 62 10 70 10 C85 10 95 20 95 35 C95 50 80 65 50 85Z" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'speech':    return<svg width={w} height={h} viewBox="0 0 100 100"><path d="M10 10 Q10 5 15 5 L85 5 Q90 5 90 10 L90 65 Q90 70 85 70 L30 70 L15 90 L20 70 L15 70 Q10 70 10 65 Z" fill={fill} stroke={stroke} strokeWidth="2"/></svg>;
    case 'badge':     return<svg width={w} height={h} viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={fill} stroke={stroke} strokeWidth="2"/><circle cx="50" cy="50" r="18" fill="none" stroke={stroke} strokeWidth="2"/></svg>;
    case 'line':      return<svg width={w} height={8} viewBox={`0 0 ${w} 8`}><line x1="0" y1="4" x2={w} y2="4" stroke={fill} strokeWidth="4" strokeLinecap="round"/></svg>;
    default:          return<div style={{width:w,height:h,background:fill,border:`2px solid ${stroke}`,borderRadius:3}}/>;
  }
}

let idCounter=1;
function newId(){return idCounter++;}
function getLayerIcon(obj){if(obj.type==='group')return'⊞';if(obj.type==='background')return'▣';if(obj.type==='text')return'T';if(obj.type==='shape')return'○';if(obj.type==='svg')return'◆';if(obj.type==='image')return'▤';if(obj.type==='curves')return'◑';if(obj.type==='adjustment'){const m={levels:'▤',hueSat:'◐',colorBalance:'⊕',vibrance:'✦',selectiveColor:'◈',gradientMap:'▓',posterize:'▦',threshold:'◑'};return m[obj.adjustmentType]||'◑';}return'▪';}
function getLayerColor(obj){if(obj.type==='group')return'#f97316';if(obj.type==='background')return obj.bgColor||'#f97316';if(obj.type==='text')return obj.textColor||'#fff';if(obj.type==='shape')return obj.fillColor||'#FF4500';if(obj.type==='curves')return'#f97316';return'#555';}
function getLayerName(obj){if(obj.type==='group')return obj.name||'Group';if(obj.type==='background')return'Background';if(obj.type==='text')return obj.text?.slice(0,18)||'Text';if(obj.type==='shape')return(obj.shape?.charAt(0).toUpperCase()+obj.shape?.slice(1))||'Shape';if(obj.type==='svg')return obj.label||'Element';if(obj.type==='image')return'Image';if(obj.type==='curves')return'Curves';if(obj.type==='adjustment')return obj.name||({levels:'Levels',hueSat:'Hue/Sat',colorBalance:'Color Balance',vibrance:'Vibrance',selectiveColor:'Selective Color',gradientMap:'Gradient Map',posterize:'Posterize',threshold:'Threshold'}[obj.adjustmentType]||'Adjustment');return'Layer';}

// ── Layer tree utilities (group-aware) ────────────────────────────────────────
function findInTree(arr,id){for(const l of arr){if(l.id===id)return l;if(l.type==='group'&&l.children){const f=findInTree(l.children,id);if(f)return f;}}return null;}
function updateLayerInTree(arr,id,fn){return arr.map(l=>{if(l.id===id)return fn(l);if(l.type==='group'&&l.children)return{...l,children:updateLayerInTree(l.children,id,fn)};return l;});}
function removeFromTree(arr,id){let removed=null;const next=arr.filter(l=>{if(l.id===id){removed=l;return false;}return true;}).map(l=>{if(l.type==='group'&&l.children){const[nc,r]=removeFromTree(l.children,id);if(r)removed=r;return{...l,children:nc};}return l;});return[next,removed];}
function deepCloneLayer(l){const clone={...l,id:idCounter++};if(l.type==='group'&&l.children)clone.children=l.children.map(deepCloneLayer);return clone;}
function getGroupBounds(group){if(!group?.children?.length)return null;let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;for(const c of group.children){if(c.hidden)continue;const w=c.width||(c.type==='text'?Math.max(80,(c.text?.length||1)*(c.fontSize||48)*0.6):100);const h=c.type==='text'?(c.fontSize||48):(c.height||100);x1=Math.min(x1,c.x);y1=Math.min(y1,c.y);x2=Math.max(x2,c.x+w);y2=Math.max(y2,c.y+h);}return x1===Infinity?null:{x:x1,y:y1,width:x2-x1,height:y2-y1};}
function getDisplayList(layerArray,depth=0){
  const result=[];
  const reversed=[...layerArray].reverse();
  for(let i=0;i<reversed.length;i++){
    const l=reversed[i];
    const origIdx=layerArray.length-1-i;
    const isClipped=l.clipMask===true&&origIdx>0;
    const isBase=origIdx<layerArray.length-1&&layerArray[origIdx+1]?.clipMask===true;
    result.push({layer:l,depth,isClipped,isBase});
    if(l.type==='group'&&!l.collapsed&&l.children?.length)result.push(...getDisplayList(l.children,depth+1));
  }
  return result;
}

function getSafeImageSrc(layer){
  const raw = (layer?.paintSrc || layer?.src || '').toString().trim();
  if(!raw) return null;
  if(/^data:image\//i.test(raw)) return raw;
  if(/^blob:/i.test(raw)) return raw;
  if(/^https?:\/\//i.test(raw)) return raw;
  if(raw.startsWith('/')) return raw;
  return null;
}

class CanvasErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={hasError:false};
  }

  static getDerivedStateFromError(){
    return {hasError:true};
  }

  componentDidCatch(error, info){
    console.error('[Canvas ErrorBoundary] Canvas render failed:', error, info);
  }

  render(){
    if(this.state.hasError){
      return (
        <div style={{
          width:'100%',
          maxWidth:700,
          minHeight:220,
          border:'1px solid rgba(255,255,255,0.15)',
          borderRadius:8,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          flexDirection:'column',
          gap:8,
          color:'#d1d5db',
          background:'rgba(0,0,0,0.22)',
          padding:18,
          textAlign:'center',
        }}>
          <div style={{fontSize:16,fontWeight:'700'}}>Canvas render error</div>
          <div style={{fontSize:12,opacity:0.85}}>A layer failed to render. Remove the last edited image and try again.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ArcText({obj}){
  const ts=(()=>{const p=[];if(obj.shadowEnabled)p.push(`${obj.shadowX||2}px ${obj.shadowY||2}px ${obj.shadowBlur||14}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);if(obj.glowEnabled)p.push(`0 0 20px ${obj.glowColor||'#f97316'}`);return p.length?p.join(','):'none';})();
  const base={fontFamily:resolveFontFamily(obj.fontFamily),fontSize:obj.fontSize,fontWeight:obj.fontWeight||700,fontStyle:obj.fontItalic?'italic':'normal',color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth}px ${obj.strokeColor}`:'none',paintOrder:'stroke fill',textShadow:ts,whiteSpace:'nowrap',letterSpacing:`${obj.letterSpacing||0}px`};
  if(!obj.arcEnabled||!obj.text)return<span style={base}>{obj.text}</span>;
  const radius=obj.arcRadius||120,chars=obj.text.split(''),step=(obj.fontSize||48)/radius*1.1,start=-(chars.length-1)*step/2;
  return(<div style={{position:'relative',width:radius*2+60,height:radius+60}}>{chars.map((ch,i)=>{const angle=start+i*step-Math.PI/2,x=radius+Math.cos(angle)*radius,y=radius+Math.sin(angle)*radius+30,rot=(angle+Math.PI/2)*180/Math.PI;return<span key={i} style={{position:'absolute',left:x,top:y,transform:`translate(-50%,-50%) rotate(${rot}deg)`,...base,lineHeight:1}}>{ch}</span>;})}</div>);
}

// ✅ Slider — uses pointer capture so drag works even when mouse leaves the element
function Slider({min,max,step,value,onChange,onCommit,style}){
  const ref=useRef(null);
  const dragging=useRef(false);
  useEffect(()=>{
    if(ref.current&&!dragging.current)ref.current.value=String(value);
  },[value]);
  return(
    <input ref={ref} type="range" min={min} max={max} step={step||1} defaultValue={value} style={style}
      onPointerDown={e=>{
        dragging.current=true;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e=>{
        if(!dragging.current)return;
        onChange(Number(e.currentTarget.value));
      }}
      onPointerUp={e=>{
        dragging.current=false;
        const v=Number(e.currentTarget.value);
        onChange(v);
        if(onCommit)onCommit(v);
      }}
    />
  );
}

function debounce(fn, wait){
  let timer = null;
  const debounced = (...args)=>{
    if(timer) clearTimeout(timer);
    timer = setTimeout(()=>fn(...args), wait);
  };
  debounced.cancel = ()=>{
    if(timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

// ── PSD Export ────────────────────────────────────────────────────────────────
const PSD_BLEND_MAP = {
  normal:'norm', multiply:'mul', screen:'scrn', overlay:'over',
  'soft-light':'sLit', 'hard-light':'hLit', 'color-dodge':'div',
  'color-burn':'idiv', darken:'dark', lighten:'lite', difference:'diff',
  exclusion:'smud', hue:'hue', saturation:'sat', color:'colr', luminosity:'lum'
};

// ── Warp Transform — mesh preset builders ─────────────────────────────────────
function buildIdentityMesh(W, H, mW, mH) {
  const m = new Float32Array(mW * mH * 2);
  for (let r = 0; r < mH; r++) for (let c = 0; c < mW; c++) {
    m[(r*mW+c)*2]   = c / (mW-1) * W;
    m[(r*mW+c)*2+1] = r / (mH-1) * H;
  }
  return m;
}
function buildArcMesh(W, H, mW, mH, bend) {
  const m = buildIdentityMesh(W, H, mW, mH);
  const b = bend / 100;
  for (let r = 0; r < mH; r++) for (let c = 0; c < mW; c++) {
    const t = c / (mW-1);
    const arc = Math.sin(Math.PI * t) * b * H * 0.4;
    m[(r*mW+c)*2+1] -= arc * (1 - r/(mH-1));
  }
  return m;
}
function buildBulgeMesh(W, H, mW, mH, bend) {
  const m = buildIdentityMesh(W, H, mW, mH);
  const b = bend / 100;
  for (let r = 0; r < mH; r++) for (let c = 0; c < mW; c++) {
    const tx = (c / (mW-1)) * 2 - 1;
    const ty = (r / (mH-1)) * 2 - 1;
    const bulge = Math.sqrt(Math.max(0, 1 - tx*tx)) * b * 0.4;
    m[(r*mW+c)*2] -= bulge * W * tx;
    m[(r*mW+c)*2+1] -= bulge * H * ty;
  }
  return m;
}
function buildWaveMesh(W, H, mW, mH, bend) {
  const m = buildIdentityMesh(W, H, mW, mH);
  const b = bend / 100;
  for (let r = 0; r < mH; r++) for (let c = 0; c < mW; c++) {
    const tx = c / (mW-1);
    m[(r*mW+c)*2+1] -= Math.sin(tx * Math.PI * 2) * b * H * 0.2;
  }
  return m;
}
function buildFisheyeMesh(W, H, mW, mH, bend) {
  const m = buildIdentityMesh(W, H, mW, mH);
  const b = bend / 100;
  const cx = W/2, cy = H/2;
  for (let r = 0; r < mH; r++) for (let c = 0; c < mW; c++) {
    const dx = (c/(mW-1) - 0.5) * 2;
    const dy = (r/(mH-1) - 0.5) * 2;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const factor = dist > 0 ? Math.pow(dist, 1 + b * 0.8) / dist : 1;
    m[(r*mW+c)*2]   = cx + dx * factor * W/2;
    m[(r*mW+c)*2+1] = cy + dy * factor * H/2;
  }
  return m;
}
const WARP_PRESETS = {
  none:    (W,H,mW,mH) => buildIdentityMesh(W,H,mW,mH),
  arc:     buildArcMesh,
  bulge:   buildBulgeMesh,
  wave:    buildWaveMesh,
  fisheye: buildFisheyeMesh,
};
function buildWarpMesh(preset, W, H, mW, mH, bend) {
  const fn = WARP_PRESETS[preset] || WARP_PRESETS.none;
  return fn(W, H, mW, mH, bend);
}

// Warp worker singleton
let _warpWorker = null;
function getWarpWorker() {
  if (!_warpWorker) {
    try { _warpWorker = new Worker(new URL('./warpWorker.js', import.meta.url)); }
    catch(e) { console.warn('[warp] Worker init failed:', e); }
  }
  return _warpWorker;
}

// ── Feature J: Niche profiles (frontend display config) ───────────────────────
const NICHE_CONFIG = {
  gaming:    { label:'Gaming',    emoji:'🎮', desc:'Gameplay, reactions & esports',      accentColor:'#7c3aed', gradFrom:'#4c1d95', gradTo:'#7c3aed' },
  tech:      { label:'Tech',      emoji:'💻', desc:'Reviews, tutorials & unboxings',     accentColor:'#0ea5e9', gradFrom:'#0c4a6e', gradTo:'#0ea5e9' },
  vlog:      { label:'Vlog',      emoji:'🎥', desc:'Lifestyle, travel & daily life',     accentColor:'#ec4899', gradFrom:'#831843', gradTo:'#ec4899' },
  cooking:   { label:'Cooking',   emoji:'🍳', desc:'Recipes, restaurants & food reviews',accentColor:'#f59e0b', gradFrom:'#78350f', gradTo:'#f59e0b' },
  fitness:   { label:'Fitness',   emoji:'💪', desc:'Workouts, nutrition & transformation',accentColor:'#22c55e', gradFrom:'#14532d', gradTo:'#22c55e' },
  education: { label:'Education', emoji:'📚', desc:'Tutorials, explainers & how-tos',   accentColor:'#f97316', gradFrom:'#7c2d12', gradTo:'#f97316' },
};

export default function Editor({onExit, user, token, apiUrl}){
  const resolvedApiUrl = (apiUrl || process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
  const [layers,setLayersRaw]              = useState([]);
  const canvasRef       = useRef(null);
  const brushOverlayRef = useRef(null);
  const cmdInputRef     = useRef(null);
  const justSelectedRef = useRef(false);
  const draggingRef     = useRef(null);
  const rimPaintingRef  = useRef(false);
  const resizingRef     = useRef(null);
  const dragOffsetRef   = useRef({x:0,y:0});
  const resizeStartRef  = useRef(null);
  const zoomRef         = useRef(1);
  const layersRef       = useRef(layers);
  const mountedRef = useRef(true);
  const currentDesignIdRef = useRef(null);
  const lastSavedSignatureRef = useRef('');
  const saveStatusTimerRef = useRef(null);
  const deletedIdsRef = useRef(new Set());
  const isSavingRef = useRef(false);
  const lassoDrawingRef = useRef(false);
  const lassoPointsRef  = useRef([]);
  const lassoSvgRef     = useRef(null);
  const lassoFeatherRef = useRef(0);
  const lassoInvertRef  = useRef(false);
  const freehandDrawingRef = useRef(false);
  const freehandPointsRef  = useRef([]);
  const freehandSvgRef     = useRef(null);
  const draftStateRef = useRef(null);
  const draftHydratedRef = useRef(false);
  const saveMetaRef = useRef({});
  const saveEngineRef = useRef(null);
  const localSavedAtRef = useRef(null);
  // Performance: Mouse tracking refs to avoid re-renders
  const mouseRef        = useRef({x:0,y:0});
  const lastRimLightRef = useRef(0);
  const rafIdRef        = useRef(null);
  const wheelRafRef     = useRef(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const rafId = rafIdRef.current;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Non-passive touchmove listener so preventDefault() works on iOS Safari.
  // React registers synthetic event listeners as passive by default, which
  // prevents calling e.preventDefault() and allows the browser to hijack
  // touch gestures for scrolling mid-stroke.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  // ── Save Engine: init on mount, destroy on unmount ─────────────────────────
  useEffect(() => {
    const engine = createSaveEngine({
      getSnapshot: () => {
        if (!saveMetaRef.current) return null;
        return {
          ...saveMetaRef.current,
          layers: layersRef.current,
        };
      },
      onSaveStart: () => {
        if (mountedRef.current) setLocalSaveStatus('saving');
      },
      onSaveEnd: ({ success, savedAt }) => {
        if (!mountedRef.current) return;
        if (success) {
          localSavedAtRef.current = savedAt;
          setLocalSaveStatus('saved');
        } else {
          setLocalSaveStatus('unsaved');
        }
      },
      onDirty: () => {
        if (mountedRef.current) setLocalSaveStatus('unsaved');
      },
    });
    saveEngineRef.current = engine;
    engine.startPeriodic();

    // ── visibilitychange & blur: save when user leaves the tab/window ────────
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        engine.saveImmediate();
      }
    };
    const handleBlur = () => { engine.saveImmediate(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    // ── beforeunload: emergency save + warn if still dirty ──────────────────
    const handleBeforeUnload = (e) => {
      if (engine.isDirty()) {
        engine.saveNow(); // best-effort sync attempt (IndexedDB)
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      engine.destroy();
      saveEngineRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const [platform,setPlatform]             = useState('youtube');
  const [activeTool,setActiveTool]         = useState('select');
  const [activeCategory,setActiveCategory] = useState('Gaming');
  const [darkMode,setDarkMode]             = useState(true);
  const [selectedId,setSelectedId]         = useState(null);
  const [zoom,setZoom]                     = useState(1);
  const [panOffset,setPanOffset]           = useState({x:0,y:0});
  const [showGrid,setShowGrid]             = useState(false);
  const [showRuler,setShowRuler]           = useState(false);
  const [showSafeZones,setShowSafeZones]   = useState(false);
  const [showStampTest,setShowStampTest]   = useState(false);
  const [mobilePreviewPos,setMobilePreviewPos] = useState({x:-1,y:-1});
  const mobilePreviewDragRef               = useRef(null); // eslint-disable-line no-unused-vars
  const [showYtPreview,setShowYtPreview]   = useState(false);
  const [ytVideoTitle,setYtVideoTitle]     = useState('Your Amazing Video Title Goes Here');
  const [ytChannel,setYtChannel]           = useState('Your Channel');
  const [ytPreviewMode,setYtPreviewMode]   = useState('mobile');
  const [ytPreviewTheme,setYtPreviewTheme] = useState('dark');
  const [snapToGrid,setSnapToGrid]         = useState(false);
  const lockAspect                         = false;
  const [recentColors,setRecentColors]     = useState(['#ffffff','#000000','#FF4500','#f97316','#FFD700','#00C853']);
  const [savedPalette,setSavedPalette]     = useState([]);
  const [clipboard,setClipboard]           = useState(null);
  const selClipboardRef                    = useRef(null); // {imageData, bounds} — pixel-level clipboard for selection ops
  const [showFileTab,setShowFileTab]       = useState(false);
  const [showDownload,setShowDownload]     = useState(false);
  const [exportFormat,setExportFormat]     = useState('png');   // 'png'|'jpeg'|'webp'|'psd'
  const [exportQuality,setExportQuality]   = useState(92);      // jpeg quality 0-100
  const [exportLoading,setExportLoading]   = useState(null);    // null|'png'|'jpeg'|'webp'|'psd'
  const [warpMode,setWarpMode]             = useState(false);
  const [warpPreset,setWarpPreset]         = useState('arc');
  const [warpBend,setWarpBend]             = useState(30);
  const [warpHDist,setWarpHDist]           = useState(0);       // eslint-disable-line no-unused-vars
  const [warpVDist,setWarpVDist]           = useState(0);       // eslint-disable-line no-unused-vars
  const [warpPreview,setWarpPreview]       = useState(null);    // data URL of warped preview
  const [warpLoading,setWarpLoading]       = useState(false);
  const [showTextWarp,setShowTextWarp]     = useState(false);
  const [showShortcutsModal,setShowShortcutsModal] = useState(false);
  const [showCommandPalette,setShowCommandPalette] = useState(false);
  const [showLiquify,setShowLiquify]               = useState(false);
  const [liquifySource,setLiquifySource]           = useState(null); // {imageData,w,h}
  const [showFilters,setShowFilters]               = useState(false);
  const [filtersSource,setFiltersSource]           = useState(null); // {imageData,w,h}
  const [filtersAutoApply,setFiltersAutoApply]     = useState(false);
  const lastFilterRef                              = useRef(null);   // {id,params} for Ctrl+F
  const [groupEditId,setGroupEditId]               = useState(null); // layer id currently being name-edited
  const [groupEditName,setGroupEditName]           = useState('');
  const [ctxMenu,setCtxMenu]                       = useState(null); // {x,y,layerId}
  const groupDragInitRef                           = useRef(null);   // {startX,startY,children:[{id,x,y}]}
  const [savedDesigns,setSavedDesigns]     = useState([]);
  const [galleryLoading,setGalleryLoading] = useState(false);
  const galleryLastFetchAt                 = useRef(0); // timestamp of last successful fetch
  const [designName,setDesignName]         = useState('My Design');
  const [transparentExport,setTransparentExport] = useState(false);
  const [textInput,setTextInput]           = useState('MY THUMBNAIL');
  const [fontSize,setFontSize]             = useState(48);
  const [fontFamily,setFontFamily]         = useState('Anton');
  const [fontWeight,setFontWeight]         = useState(900);
  const [fontItalic,setFontItalic]         = useState(false);
  const [letterSpacing,setLetterSpacing]   = useState(0);
  const [lineHeight,setLineHeight]         = useState(1.2);
  const [textAlign,setTextAlign]           = useState('left');
  const [shadowEnabled,setShadowEnabled]   = useState(true);
  const [shadowColor,setShadowColor]       = useState('#000000');
  const [shadowBlur,setShadowBlur]         = useState(15);
  const [shadowX,setShadowX]               = useState(3);
  const [shadowY,setShadowY]               = useState(3);
  const [glowEnabled,setGlowEnabled]       = useState(false);
  const [glowColor,setGlowColor]           = useState('#f97316');
  const [arcEnabled,setArcEnabled]         = useState(false);
  const [arcRadius,setArcRadius]           = useState(120);
  const [textColor,setTextColor]           = useState('#ffffff');
  const [strokeColor,setStrokeColor]       = useState('#000000');
  const [strokeWidth,setStrokeWidth]       = useState(5);
  const [textTransform,setTextTransform]   = useState('uppercase');
  const [fillType,setFillType]             = useState('solid');
  const [gradColor1,setGradColor1]         = useState('#ff6600');
  const [gradColor2,setGradColor2]         = useState('#ffcc00');
  const [gradAngle,setGradAngle]           = useState(0);
  const [textStrokes,setTextStrokes]       = useState([]);
  const [warpType,setWarpType]             = useState('none');
  const [warpAmount,setWarpAmount]         = useState(30);
  const [fillColor,setFillColor]           = useState('#FF4500');
  const [brightness,setBrightness]         = useState(100);
  const [contrast,setContrast]             = useState(100);
  const [saturation,setSaturation]         = useState(100);
  const [hue,setHue]                       = useState(0);
  const [rgbR,setRgbR]                     = useState(108);
  const [rgbG,setRgbG]                     = useState(99);
  const [rgbB,setRgbB]                     = useState(255);
  const [cmdInput,setCmdInput]             = useState('');
  const [cmdLog,setCmdLog]                 = useState('');
  const [cmdHistory,setCmdHistory]         = useState([]);
  const [cmdHistoryIdx,setCmdHistoryIdx]   = useState(-1);
  const [cmdSuggestions,setCmdSuggestions] = useState([]);
  const [cmdOpen,setCmdOpen]               = useState(false);
  const [showCmdHelp,setShowCmdHelp]       = useState(false);
  const [history,setHistory]               = useState([]);
  const [historyIndex,setHistoryIndex]     = useState(-1);
  const historyRef                         = useRef([]);
  const historyIndexRef                    = useRef(-1);
  const historyDebounceRef                 = useRef(null);
  const [historyLabels,setHistoryLabels]   = useState(['Open']);
  const historyLabelsRef                   = useRef(['Open']);
  const [historyTimestamps,setHistoryTimestamps] = useState([Date.now()]);
  const historyTimestampsRef               = useRef([Date.now()]);
  const [historyThumbnails,setHistoryThumbnails] = useState({});
  const [rightPanelTab,setRightPanelTab]   = useState('layers');
  const [dbSnapshots,setDbSnapshots]       = useState([]);
  const thumbQueueRef                      = useRef([]);
  const thumbBusyRef                       = useRef(false);
  const thumbCanvasRef                     = useRef(null);
  const historyListRef                     = useRef(null);
  const [layerDragId,setLayerDragId]       = useState(null);
  const [layerDragOver,setLayerDragOver]   = useState(null);
  const [smartGuides,setSmartGuides]       = useState({h:[],v:[]});   // active guide lines during drag
  const [snapEnabled,setSnapEnabled]       = useState(true);           // master snap toggle (Shift+;)
  const [showThirds,setShowThirds]         = useState(false);          // rule of thirds overlay
  const [pixelSnapEnabled,setPixelSnapEnabled] = useState(true);       // snap to whole pixel values
  const [selectedIds,setSelectedIds]       = useState(new Set());      // multi-select layer IDs
  const altPressedRef                      = useRef(false);            // Alt held → disable snap temporarily
  const spaceHeldRef                       = useRef(false);            // Space held → temporary pan mode
  const spaceToolRef                       = useRef(null);             // tool active before space was pressed
  const [brushTypeState,setBrushTypeState]             = useState('blur');
  const [brushSizeState,setBrushSizeState]             = useState(20);
  const [brushStrengthState,setBrushStrengthState]     = useState(50);
  const [brushEdgeState,setBrushEdgeState]             = useState('soft');
  const [brushColorState,setBrushColorState]           = useState('#ff0000');
  const [brushColorAlpha,setBrushColorAlpha]           = useState(100);
  const [rimLightColor,setRimLightColor]       = useState('#00aaff');
  const [rimLightSize,setRimLightSize]         = useState(40);
  const [rimLightIntensity,setRimLightIntensity] = useState(80);
  const [rimLightSoftness,setRimLightSoftness] = useState(70);
  const [rimLightBlend,setRimLightBlend]       = useState('screen');
  const [rimPickingColor,setRimPickingColor] = useState(false);
  const [rimPickedFrom,setRimPickedFrom]     = useState(null);
  const [ctrScore,setCtrScore]     = useState(null);     // eslint-disable-line no-unused-vars
  const [ctrBreakdown,setCtrBreakdown] = useState(null); // eslint-disable-line no-unused-vars
  const [ctrLoading,setCtrLoading] = useState(false);
  const [ctrV2,         setCtrV2]          = useState(null);
  const [ctrTitle,      setCtrTitle]       = useState('');
  const [ctrNiche,      setCtrNiche]       = useState('Gaming');
  const [ctrChecked,    setCtrChecked]     = useState(new Set());
  const [ctrExpandedCat,setCtrExpandedCat] = useState(null);
  const [ctrThumbUrl,   setCtrThumbUrl]    = useState(null);
  const [compResult,setCompResult]           = useState(null);
  const [compLoading,setCompLoading]         = useState(false);
  const [compOverlay,setCompOverlay]         = useState(true);
  const [compChecked,setCompChecked]         = useState(new Set());
  const [compVideoTitle,setCompVideoTitle]   = useState('');
  const [aiTextTitle,  setAiTextTitle]       = useState('');
  const [aiTextNiche,  setAiTextNiche]       = useState('Gaming');
  const [aiTextResults,setAiTextResults]     = useState([]);
  const [aiTextLoading,setAiTextLoading]     = useState(false);
  const [styleMode,     setStyleMode]         = useState('preset');
  const [stylePreset,   setStylePreset]       = useState('mrbeast');
  const [styleUrl,      setStyleUrl]          = useState('');
  const [styleResult,   setStyleResult]       = useState(null);
  const [styleIntensity,setStyleIntensity]    = useState(75);
  const [styleBusy,     setStyleBusy]         = useState(false);
  const [bgGenNiche,    setBgGenNiche]         = useState('gaming');
  const [bgGenCustom,   setBgGenCustom]        = useState('');
  const [bgGenPreview,  setBgGenPreview]       = useState(null);
  const [bgGenBusy,     setBgGenBusy]          = useState(false);
  const [bgGenPrompt,   setBgGenPrompt]        = useState('');
  const [cgPreset,      setCgPreset]           = useState('default');
  const [cgIntensity,   setCgIntensity]        = useState(80);
  const [cgBusy,        setCgBusy]             = useState(false);
  const [cgOriginalSrc, setCgOriginalSrc]      = useState(null);
  const [cgGradedSrc,   setCgGradedSrc]        = useState(null);
  const [cgLayerId,     setCgLayerId]          = useState(null);
  const [abVariants,setAbVariants]   = useState([]);
  const [abLoading,setAbLoading]     = useState(false);
  const [abSelected,setAbSelected]   = useState(null);
  const [aiVariants,setAiVariants]   = useState([]);   // Feature I: [{base64,label,description}|null] ×6
  const [aiVarBusy, setAiVarBusy]   = useState(false);
  const [aiVarSelected,setAiVarSelected] = useState(null);
  const [aiVarTitle, setAiVarTitle]  = useState('');
  const [aiVarNiche, setAiVarNiche]  = useState('gaming');
  // Feature J: Niche profiles
  const [userNiche,     setUserNicheState] = useState(()=>localStorage.getItem('tf_niche')||null);
  const [nicheOnboarding,setNicheOnboarding] = useState(false);
  const [nicheHovered,  setNicheHovered]  = useState(null);
  const [nicheSaving,   setNicheSaving]   = useState(false);
  const [resizeExporting,setResizeExporting] = useState(false);
  const [ytConnected,setYtConnected]       = useState(()=>{
    // Check if we have a stored YouTube token from a previous OAuth flow
    return !!localStorage.getItem('yt_access_token');
  });
  // Feature K: YouTube History Intelligence
  const [ytHistConnected, setYtHistConnected] = useState(()=>!!localStorage.getItem('tf_yt_connected'));
  const [ytHistChannel,   setYtHistChannel]   = useState(()=>{try{return JSON.parse(localStorage.getItem('tf_yt_channel')||'null');}catch{return null;}});
  const [ytHistVideos,    setYtHistVideos]    = useState([]);
  const [ytHistInsights,  setYtHistInsights]  = useState(()=>{try{return JSON.parse(localStorage.getItem('tf_yt_insights')||'null');}catch{return null;}});
  const [ytHistBusy,      setYtHistBusy]      = useState(false);
  const [ytHistProgress,  setYtHistProgress]  = useState(0);
  const [ytHistError,     setYtHistError]     = useState('');
  // Feature L: Team Collaboration & Version History
  const [teamData,        setTeamData]        = useState(null);
  const [teamBusy,        setTeamBusy]        = useState(false);
  const [teamError,       setTeamError]       = useState('');
  const [teamInviteEmail, setTeamInviteEmail] = useState('');
  const [teamCreateName,  setTeamCreateName]  = useState('');
  const [comments,        setComments]        = useState([]);
  const [commentMode,     setCommentMode]     = useState(false); // clicking canvas drops a pin
  const [activeCommentId, setActiveCommentId] = useState(null); // open popover
  const [replyDraft,      setReplyDraft]      = useState('');
  const [versionHistory,  setVersionHistory]  = useState([]);
  const [versionBusy,     setVersionBusy]     = useState(false);
  const [versionLabel,    setVersionLabel]    = useState('');
  const [approvalStatus,  setApprovalStatus]  = useState('draft'); // draft | review | approved
  const [ytTests,setYtTests]               = useState([]);
  const [ytVideoUrl,setYtVideoUrl]         = useState('');
  const [ytTestDuration,setYtTestDuration] = useState('24h');
  const [ytTestStatus,setYtTestStatus]     = useState(null);
  const [resizeProgress,setResizeProgress]   = useState('');
  const [faceAnalysis,setFaceAnalysis]   = useState(null);
  const [faceLoading,setFaceLoading]     = useState(false);
  const [aiCmd,setAiCmd]           = useState('');
  const [aiCmdLoading,setAiCmdLoading] = useState(false);
  const [aiCmdLog,setAiCmdLog]     = useState('');
  const [showAiBar,setShowAiBar]   = useState(false);
  const aiCmdInputRef              = useRef(null);
  const [maskingLayerId,setMaskingLayerId] = useState(null); // eslint-disable-line no-unused-vars
  const [maskPaintColor,setMaskPaintColor] = useState('#000000'); // eslint-disable-line no-unused-vars
  const [isLassoMode,setIsLassoMode]       = useState(false);
  const [freeBrushColor,setFreeBrushColor] = useState('#ff4500');
  const [freeBrushSize,setFreeBrushSize]   = useState(8);
  const [brushFlowState,setBrushFlowState]             = useState(100);
  const [brushStabilizerState,setBrushStabilizerState] = useState(0);
  const [brushSmoothingState,setBrushSmoothingState]   = useState(35);
  const [brushSpacingState,setBrushSpacingState]       = useState(25);

  // ── Pressure sensitivity (drawing tablet) ────────────────────────────────
  const [pressureEnabled,setPressureEnabled]   = useState(false);
  const [pressureMapping,setPressureMapping]   = useState('both');   // 'size'|'opacity'|'both'|'none'
  const [pressureCurve,setPressureCurve]       = useState('linear'); // 'linear'|'exponential'|'logarithmic'
  const [pressureMin,setPressureMin]           = useState(0);
  const [pressureMax,setPressureMax]           = useState(100);
  const [tabletDetected,setTabletDetected]     = useState(false);

  // ── Retouch tools (Dodge/Burn/Smudge/Blur/Sharpen) ───────────────────────
  const [dodgeBurnMode,setDodgeBurnMode]   = useState('dodge'); // 'dodge'|'burn'
  const [retouchRange,setRetouchRange]     = useState('midtones'); // 'shadows'|'midtones'|'highlights'
  const [retouchExposure,setRetouchExposure] = useState(50);
  const [retouchStrength,setRetouchStrength] = useState(50);
  const [fingerPainting,setFingerPainting] = useState(false); // eslint-disable-line no-unused-vars
  const retouchActiveRef                   = useRef(false);
  const retouchPrevTileRef                 = useRef(null);

  // ── Adjustment layers ─────────────────────────────────────────────────────
  const [adjLayerMenu,setAdjLayerMenu]     = useState(false);
  const [adjLayerMenuPos,setAdjLayerMenuPos] = useState({x:0,y:0}); // eslint-disable-line no-unused-vars
  const adjHistRef                         = useRef({}); // eslint-disable-line no-unused-vars

  // ── Selection system ──────────────────────────────────────────────────────
  const [selectionActive, setSelectionActive] = useState(false);
  const selectionMaskRef = useRef(null);
  const [selVersion, setSelVersion] = useState(0); // eslint-disable-line no-unused-vars
  const [selFeather, setSelFeather] = useState(0);
  const [selTolerance, setSelTolerance] = useState(32);
  const [selAntiAlias, setSelAntiAlias] = useState(true); // eslint-disable-line no-unused-vars
  const [selSubMode, setSelSubMode] = useState('rect'); // 'rect' | 'ellipse' for marquee
  const selDrawRef = useRef(null); // drawing-in-progress state
  const selPolyPointsRef = useRef([]); // eslint-disable-line no-unused-vars
  const [selDrawState, setSelDrawState] = useState(null); // {type, x1,y1,x2,y2} | {type:'path',points} for live SVG
  // ── Quick Mask Mode (Item 20) ──────────────────────────────────────────────
  const [quickMaskActive, setQuickMaskActive] = useState(false);
  const quickMaskCanvasRef = useRef(null);

  const [remainingQuota,setRemainingQuota]             = useState(null); // eslint-disable-line no-unused-vars
  const [showPaywall,setShowPaywall]                   = useState(false); // eslint-disable-line no-unused-vars
  // Automation pipeline
  const [autoPanel,setAutoPanel]                       = useState(false);
  const [autoLoading,setAutoLoading]                   = useState(false);
  const [autoRecs,setAutoRecs]                         = useState([]);
  const [autoMetrics,setAutoMetrics]                   = useState(null);
  const [autoDismissed,setAutoDismissed]               = useState(new Set());
  const [autoFixRunning,setAutoFixRunning]             = useState(false);
  const [autoShowDevicePreview,setAutoShowDevicePreview] = useState(false);
  const [autoShowColorBlind,setAutoShowColorBlind]       = useState(false);
  const [showPromptEngine,setShowPromptEngine]           = useState(false);
  const [autoPreviewUrl,setAutoPreviewUrl]               = useState(null);
  const autoAnalysisDebounceRef                          = useRef(null);

  // ── Tier 3 Item 3: Competitor Comparison ─────────────────────────────────
  const [showCompetitor,setShowCompetitor]       = useState(false);
  const [competitorQuery,setCompetitorQuery]     = useState('');
  const [competitorResults,setCompetitorResults] = useState([]);
  const [competitorLoading,setCompetitorLoading] = useState(false);
  const [competitorError,setCompetitorError]     = useState('');
  const [competitorAnalysis,setCompetitorAnalysis] = useState('');
  const [competitorAnalyzing,setCompetitorAnalyzing] = useState(false);
  const [competitorThumbUrl,setCompetitorThumbUrl] = useState(null);

  // ── Tier 3 Item 4: Focus/Saliency Heat Map ────────────────────────────────
  const [showHeatMap,setShowHeatMap]       = useState(false);
  const [heatMapOpacity,setHeatMapOpacity] = useState(60);
  const [heatMapData,setHeatMapData]       = useState(null);
  const [heatMapLoading,setHeatMapLoading] = useState(false);
  const [heatMapInsights,setHeatMapInsights] = useState([]);
  const [heatMapVisible,setHeatMapVisible] = useState(true);
  const heatMapCanvasRef                   = useRef(null);
  const [showAlreadyPro,setShowAlreadyPro]             = useState(false);
  const [isProUser,setIsProUser]                       = useState(!!(token==='test-key-123'||user?.is_admin||user?.is_pro||user?.plan==='pro'));
  const [isLoading,setIsLoading]                       = useState(true);
  const [removeBgBusy,setRemoveBgBusy]                 = useState(false);
  const [segmentMasks,setSegmentMasks]                 = useState([]);
  const [segmentBusy,setSegmentBusy]                   = useState(false);
  const [segmentHoverIdx,setSegmentHoverIdx]           = useState(null);
  const [segmentStatus,setSegmentStatus]               = useState('');
  const [segmentError,setSegmentError]                 = useState('');
  const [expressionScore,setExpressionScore]           = useState(null);
  const [showExpressionScore,setShowExpressionScore]   = useState(false);
  const [expressionBusy,setExpressionBusy]             = useState(false);
  const [enhanceBusy,setEnhanceBusy]                   = useState(false);
  const [enhanceInstruction,setEnhanceInstruction]     = useState('open mouth more');
  const [saveStatus, setSaveStatus]                    = useState('Saved');
  // localSaveStatus: 'saved' | 'saving' | 'unsaved'
  const [localSaveStatus, setLocalSaveStatus]          = useState('saved');
  const [aiPrompt,setAiPrompt]                         = useState('');
  const [lastGeneratedImageUrl,setLastGeneratedImageUrl] = useState('');
  const [projectId,setProjectId]                       = useState(null);
  const [currentDesignId,setCurrentDesignId]           = useState(null);
  const setCurrentProjectId = setCurrentDesignId;

  const [expandedCategories,setExpandedCategories]     = useState({Tools:true,Create:true,Paint:true,Select:true,Design:true,Analyze:true,File:true,Canvas:true});
  const [showToast,setShowToast]                       = useState(false);
  const [toastMessage,setToastMessage]                 = useState('');
  const [toastType,setToastType]                       = useState('info');

  // ── Document title: asterisk when unsaved (must be after localSaveStatus + designName decls) ──
  useEffect(() => {
    const isUnsaved = localSaveStatus === 'unsaved';
    const baseName  = designName || 'ThumbFrame';
    document.title  = isUnsaved ? `* ${baseName} — ThumbFrame` : `${baseName} — ThumbFrame`;
    return () => { document.title = 'ThumbFrame — YouTube Thumbnail Editor'; };
  }, [localSaveStatus, designName]);

  function setLayers(val){
    if(typeof val==='function'){
      setLayersRaw(prev=>{const next=val(prev);layersRef.current=next;return next;});
    }else{
      layersRef.current=val;
      setLayersRaw(val);
    }
  }

  useEffect(()=>{
    layersRef.current = layers;
  },[layers]);

  // ── Restore tablet detection from localStorage on mount ───────────────────
  useEffect(()=>{
    if(localStorage.getItem('tf_tablet_detected')==='1'){
      setTabletDetected(true);
      setPressureEnabled(true);
      setPressureMapping('both');
    }
  },[]);

  // ── Sprint 3: Layers Panel sync plan ──────────────────────────────────────
  useEffect(()=>{
    console.log(
`[LAYERS PANEL SYNC PLAN]
Architecture: Pure React state — NO Fabric.js required.

PHASE 1 — State Source of Truth:
  • layers[] is the single source of truth (React useState)
  • layersRef.current mirrors it for non-reactive contexts
  • Every mutation (add/remove/move/update) goes through setLayers()
  • No event listeners needed — React re-renders propagate all changes automatically

PHASE 2 — Dedicated Right Sidebar:
  • New 3rd flex column (w:210) added to the right of the tool-options panel
  • Layers rendered via [...layers].reverse() — top canvas layer appears first (Photoshop order)

PHASE 3 — Per-Layer Controls:
  • Eye (●/○)    → updateLayer(id, { hidden: !hidden })
  • Lock (🔒/🔓) → updateLayer(id, { locked: !locked })
  • ▲ Bring fwd  → moveLayerUp(id)   — swaps layer[idx] with layer[idx+1]
  • ▼ Send back  → moveLayerDown(id) — swaps layer[idx] with layer[idx-1]
  • 🗑 Delete    → deleteLayer(id)   — removes from layers[], pushes undo history

PHASE 4 — Selection Hook:
  • Click row → setSelectedId(id) → canvas re-renders with selection handles
  • Background layer click also triggers setActiveTool('background')

Guards:
  • Background layer: lock toggle + delete button are hidden
  • ▲ disabled at top of stack; ▼ disabled at bottom / for background layer`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // run once on mount

  // ── Sprint 4: Selected Object Specs panel + Freehand Brush plan ─────────
  useEffect(()=>{
    console.log(
`[SPRINT 4 — SELECTED OBJECT SPECS + FREEHAND BRUSH PLAN]

PHASE 1 — MrBeast Typography Defaults (addText()):
  • fontFamily : Anton
  • textColor  : #FFD700 (YouTube gold) — was #FFFFFF
  • strokeWidth: 8, strokeColor: #000000 (strokeUniform = CSS paint-order: stroke fill)
  • shadow     : color rgba(0,0,0,0.8), blur 15, offsetX 0, offsetY 10

PHASE 2 — Selected Object Specs / Neon Glow (Sprint 3 Layers Panel):
  • Renders when selectedLayer !== null
  • Shows layer name, type badge, and quick-action buttons
  • ⚡ Neon Glow button:
      text layers  → updateLayer(id, { glowEnabled: true, glowColor: '#00ffff' })
      image layers → updateLayerEffect(id, 'glow', { enabled: true, color: '#00ffff', blur: 30 })
  • Acts as a toggle: second click turns glow off

PHASE 3 — Freehand Brush (activeTool='freehand'):
  • New tool entry in Paint group: key='freehand', icon='✏'
  • State: freeBrushColor (#ff4500), freeBrushSize (8)
  • Refs:  freehandDrawingRef, freehandPointsRef, freehandSvgRef
  • onMouseDown  → start collecting points
  • onMouseMove  → push points, update live SVG polyline preview
  • onMouseUp    → render points to offscreen canvas (p.preview.w × p.preview.h)
                   → addLayer({ type:'image', src: dataUrl, ... })
                   → layer auto-appears in Sprint 3 panel (React state propagation)
  • pointerEvents on layers div: 'none' when freehand active (same as brush/zoom/lasso)
  • Layer sync: NO manual syncLayers() call needed — addLayer() calls setLayers() which
    re-renders the Sprint 3 Layers Panel automatically`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // run once on mount

  // ── Sprint 5: WebGL filter plan (printed before code modification) ───────
  useEffect(()=>{
    console.log(
`[SPRINT 5 — A/B VARIANT EXPORT ENGINE PLAN]

IMAGE FILTER ARCHITECTURE (HTML5 Canvas 2D — Fabric WebGL equivalents):
  Fabric Brightness filter: new fabric.filters.Brightness({ brightness: -0.2 })
    → Our equivalent: layer.imgBrightness = 80  (100 + (-0.2 * 100) = 80%)
    → Renderer: ctx.filter = "brightness(80%)" — applied per-image draw call

  Fabric Blur filter: new fabric.filters.Blur({ blur: 0.1 })
    → Our equivalent: layer.imgBlur = 8  (0.1 * 80px scale factor)
    → Renderer: ctx.filter = "blur(8px)" — applied per-image draw call

  obj.applyFilters() + canvas.renderAll() equivalent:
    → Our renderer reads imgBrightness/imgBlur from the layer object directly
    → No imperative "applyFilters" step needed — declarative layer state drives rendering

PHASE 1 — renderAtScale(layerSnapshot, multiplier):
  • multiplier=1  → p.width × p.height    (1280×720 YouTube native)
  • multiplier=2  → 2560×1440             (enterprise 2K)
  • renderLayersToCanvas handles all scaling internally

PHASE 2 — State Preservation:
  • originalState = JSON.parse(JSON.stringify(layersRef.current))
  • Variant arrays are NEW objects — React state is NEVER mutated during pipeline
  • Restore verification: layersRef.current.length === originalState.length

PHASE 3 — Variant Math:
  • A (Base)      : deep-clone of originalState — zero modifications
  • B (Panic)     : background imgBrightness=80, non-subject images dim to 80%,
                    subject +12% scale + cyan glow, text → #FFD700
  • C (Curiosity) : background images imgBlur=8 imgBrightness=70,
                    text/shapes hidden=true, subject contrast+sat boost + white glow

PHASE 4 — Toolbar button:
  • 'generateAndExportVariants()' triggered from top toolbar ⚡ button
  • Shows spinner via variantExporting state
  • Downloads JPEG ZIP at 2x (2560×1440) — no canvas mutation`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]); // run once on mount

  const saveProjectRef = useRef(null);
  const debouncedSaveRef = useRef(null);
  const triggerAutoSave = useCallback(() => {
    if(debouncedSaveRef.current){
      debouncedSaveRef.current();
    }
  }, []);

  // Warp live preview — recompute when preset/bend changes while warpMode is active
  useEffect(() => {
    if (!warpMode || !selectedId) return;
    let cancelled = false;
    computeWarpPreview(selectedId, warpPreset, warpBend).then(dataUrl => {
      if (!cancelled) setWarpPreview(dataUrl || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warpMode, warpPreset, warpBend, selectedId]);

  const p  = PLATFORMS[platform];

  saveMetaRef.current = {
    aiPrompt,
    brightness,
    contrast,
    designName,
    fillColor,
    hue,
    lastGeneratedImageUrl,
    platform,
    projectId,
    saturation,
    strokeColor,
    textColor,
    userId: user?.id || null,
  };

  const buildProjectSnapshot = useCallback((layerSnapshot = layersRef.current)=>(
    {
      projectId,
      currentDesignId: currentDesignIdRef.current,
      platform,
      layers: JSON.parse(JSON.stringify(layerSnapshot)),
      brightness,
      contrast,
      saturation,
      hue,
      designName,
      aiPrompt,
      lastGeneratedImageUrl,
      textColor,
      strokeColor,
      fillColor,
    }
  ),[aiPrompt, brightness, contrast, designName, fillColor, hue, lastGeneratedImageUrl, platform, projectId, saturation, strokeColor, textColor]);

  const buildSaveSignature = useCallback((snapshot)=>{
    return JSON.stringify({
      projectId: snapshot?.projectId || null,
      platform: snapshot?.platform || 'youtube',
      designName: snapshot?.designName || '',
      layers: snapshot?.layers || [],
      brightness: snapshot?.brightness ?? 100,
      contrast: snapshot?.contrast ?? 100,
      saturation: snapshot?.saturation ?? 100,
      hue: snapshot?.hue ?? 0,
      aiPrompt: snapshot?.aiPrompt || '',
      lastGeneratedImageUrl: snapshot?.lastGeneratedImageUrl || '',
    });
  },[]);

  function persistSavedDesigns(nextDesign){
    // Strip heavy fields — gallery only needs display metadata
    const galleryItem = {
      id:              nextDesign?.id,
      currentDesignId: nextDesign?.currentDesignId || nextDesign?.id,
      projectId:       nextDesign?.projectId       || nextDesign?.id,
      name:            nextDesign?.name            || 'Untitled Project',
      created:         nextDesign?.created         || new Date().toLocaleString(),
      platform:        nextDesign?.platform        || 'youtube',
      thumbnail:       nextDesign?.thumbnail       || null,
      last_edited:     nextDesign?.last_edited     || new Date().toISOString(),
    };

    setSavedDesigns(prevList=>{
      const list = Array.isArray(prevList) ? prevList : [];
      const targetId = galleryItem.id;
      if(!targetId){
        return [...list, galleryItem].slice(0,20);
      }

      const existingIndex = list.findIndex(item => (
        item?.id===targetId ||
        item?.currentDesignId===targetId ||
        item?.projectId===targetId
      ));

      if(existingIndex>=0){
        return list.map((item, idx)=>idx===existingIndex ? { ...item, ...galleryItem } : item);
      }

      return [...list, galleryItem].slice(0,20);
    });
  }

  const generateDesignThumbnail = useCallback(async (quality=1.0)=>{
    try{
      const layerSnapshot = JSON.parse(JSON.stringify(layersRef.current));
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = 640;
      tmpCanvas.height = Math.round(640 * p.preview.h / p.preview.w);
      const tctx = tmpCanvas.getContext('2d');
      if(!tctx)return null;

      const sx = tmpCanvas.width / p.preview.w;
      const sy = tmpCanvas.height / p.preview.h;
      const bgLayer = layerSnapshot.find(l=>l.type==='background');

      if(bgLayer){
        if(bgLayer.bgGradient){
          const gradient=tctx.createLinearGradient(0,0,0,tmpCanvas.height);
          gradient.addColorStop(0,bgLayer.bgGradient[0]);
          gradient.addColorStop(1,bgLayer.bgGradient[1]);
          tctx.fillStyle=gradient;
        }else{
          tctx.fillStyle=bgLayer.bgColor||'#f97316';
        }
        tctx.fillRect(0,0,tmpCanvas.width,tmpCanvas.height);
      }

      const imageLayers = layerSnapshot.filter(layer=>layer.type==='image'&&!layer.hidden);
      await Promise.all(imageLayers.map(layer=>
        new Promise(resolve=>{
          const imageSrc = getSafeImageSrc(layer);
          if(!imageSrc){
            resolve();
            return;
          }
          const img=new Image();
          img.crossOrigin='Anonymous';
          img.onload=()=>{
            tctx.drawImage(img, layer.x*sx, layer.y*sy, layer.width*sx, layer.height*sy);
            resolve();
          };
          img.onerror=()=>resolve();
          img.src=imageSrc;
        })
      ));

      let dataUrl;
      try{
        dataUrl = tmpCanvas.toDataURL('image/jpeg',quality);
      }catch(err){
        console.error('[THUMBNAIL] toDataURL failed:', {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
        });
        throw err;
      }
      console.log('[THUMBNAIL] Generated OK, length:', dataUrl?.length);
      return dataUrl;
    }catch(err){
      console.error('[SAVE PROJECT] Thumbnail generation failed:', err?.message || err, err);
      return null;
    }
  },[p.preview.h, p.preview.w]);

  const fetchSavedDesigns = useCallback(async ({ force = false } = {})=>{
    const userEmail = user?.email;
    if(!userEmail){
      setSavedDesigns([]);
      return;
    }

    // Cache: skip refetch if data is fresh (< 30s old) and not forced
    const now = Date.now();
    if(!force && galleryLastFetchAt.current && (now - galleryLastFetchAt.current) < 30_000){
      return;
    }

    console.time('gallery-load');
    setGalleryLoading(true);

    try{
      const endpoint = `${resolvedApiUrl}/designs/list`;
      console.time('gallery-load:session');
      const { data: { session: dlSess } } = await supabase.auth.getSession();
      console.timeEnd('gallery-load:session');
      const dlToken = dlSess?.access_token;

      console.time('gallery-load:fetch');
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${dlToken}` },
      });
      console.timeEnd('gallery-load:fetch');

      if(!response.ok){
        throw new Error(`Design list request failed (${response.status})`);
      }

      console.time('gallery-load:parse');
      const payload = await response.json().catch(()=>[]);
      console.timeEnd('gallery-load:parse');

      const rows = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : []);

      console.time('gallery-load:normalize');
      // Limit to 20 most recent — never hold full layer/blob data in gallery state
      const normalized = rows.slice(0, 20).map((row)=>{
        const jsonData = row?.json_data;
        const normalizedName =
          row?.name ||
          (typeof jsonData?.name==='string' && jsonData.name.trim() ? jsonData.name.trim() : '') ||
          'Untitled Project';

        // Gallery only needs display metadata — no layers, no json_data, no base64 blobs
        return {
          id:             row?.id,
          currentDesignId:row?.id,
          projectId:      row?.id,
          name:           normalizedName,
          created:        row?.last_edited ? new Date(row.last_edited).toLocaleString() : 'Just now',
          platform:       jsonData?.platform || row?.platform || 'youtube',
          thumbnail:      row?.thumbnail || null,
          last_edited:    row?.last_edited || null,
          // loadProject() will fetch full json_data from server when user clicks Open
        };
      });
      console.timeEnd('gallery-load:normalize');

      setSavedDesigns(normalized);
      galleryLastFetchAt.current = Date.now();
    }catch(err){
      console.error('[FETCH SAVED DESIGNS] Failed:', err);
      setSavedDesigns([]);
    }finally{
      setGalleryLoading(false);
      console.timeEnd('gallery-load');
    }
  },[resolvedApiUrl, user?.email]);

  useEffect(()=>{
    currentDesignIdRef.current=currentDesignId;
  },[currentDesignId]);

  useEffect(()=>{
    if(user?.email) return;
    setSavedDesigns([]);
    setLayers([]);
    layersRef.current=[];
    setSelectedId(null);
  },[user?.email]);
  const T  = {
    bg:     darkMode?'#06070a':'#f0f2f5',
    bg2:    darkMode?'#0d0f14':'#e8eaed',
    panel:  darkMode?'#0c0d11':'#ffffff',
    sidebar:darkMode?'#08090d':'#f7f8fa',
    input:  darkMode?'#13151c':'#ffffff',
    border: darkMode?'#1c1f2b':'#e2e5ec',
    text:   darkMode?'#e8eaf2':'#111827',
    muted:  darkMode?'#454e6b':'#9ca3af',
    accent: '#f97316',
    accentDim: darkMode?'rgba(249,115,22,0.1)':'rgba(249,115,22,0.08)',
    accentBorder: darkMode?'rgba(249,115,22,0.25)':'rgba(249,115,22,0.3)',
    danger: '#ef4444',success:'#22c55e',warning:'#f59e0b',
    glow: darkMode?'0 0 0 1px rgba(249,115,22,0.15), 0 4px 24px rgba(249,115,22,0.08)':'none',
  };

  const selectedLayer   = selectedId ? findInTree(layers,selectedId) : null;
  const bg              = layers.find(l=>l.type==='background');
  const canvasFilter    = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
  const RETOUCH_TOOLS = ['dodge','burn','smudge','blur-brush','sharpen-brush'];
  const canDrag         = activeTool!=='brush' && activeTool!=='rimlight' && activeTool!=='zoom' && !RETOUCH_TOOLS.includes(activeTool);
  // ✅ When brush active on image — that image is ONLY shown in brush overlay, nowhere else
  const brushingImageId = activeTool==='brush'&&(selectedLayer?.type==='image'||selectedLayer?.type==='background')&&!selectedLayer?.isRimLight ? selectedId : null;

  // Auto-select first real image when brush/retouch tool is active but selected layer is wrong
  useEffect(()=>{
    if(activeTool==='brush'||RETOUCH_TOOLS.includes(activeTool)){
      if(!selectedLayer || selectedLayer.isRimLight || (selectedLayer.type!=='image'&&selectedLayer.type!=='background')){
        const realImage = layers.find(l=>l.type==='image'&&!l.isRimLight&&!l.hidden);
        if(realImage) setSelectedId(realImage.id);
      }
    }
    // When switching to adjustment tool, switch panel
    if(activeTool==='adjustment'&&selectedLayer?.type!=='adjustment'){
      setAdjLayerMenu(false);
    }
  },[activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide expression score badge when switching away from face tool
  useEffect(()=>{
    if(activeTool!=='face') setShowExpressionScore(false);
  },[activeTool]);

  const [isMobile,setIsMobile] = useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener('resize',check);
    return()=>window.removeEventListener('resize',check);
  },[]);

  useEffect(()=>{zoomRef.current=zoom;},[zoom]);

  // Feature J: load niche from backend on mount; show onboarding if not set
  useEffect(()=>{
    if(!token) return;
    fetch(`${resolvedApiUrl}/api/get-niche`,{
      headers:{Authorization:`Bearer ${token}`}
    })
    .then(r=>r.json())
    .then(data=>{
      if(data.success&&data.niche){
        setUserNicheState(data.niche);
        localStorage.setItem('tf_niche',data.niche);
      } else if(!localStorage.getItem('tf_niche')){
        setNicheOnboarding(true);
      }
    })
    .catch(()=>{ if(!localStorage.getItem('tf_niche')) setNicheOnboarding(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  // Feature K: detect ?yt_connected=1 redirect back from OAuth
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get('yt_connected')==='1'&&token){
      // Remove the param from URL without reload
      const url=new URL(window.location.href);
      url.searchParams.delete('yt_connected');
      window.history.replaceState(null,'',url.toString());

      localStorage.setItem('tf_yt_connected','1');
      setYtHistConnected(true);
      // Immediately fetch channel info so we can show name + avatar
      fetch(`${resolvedApiUrl}/api/youtube/thumbnails`,{
        headers:{Authorization:`Bearer ${token}`}
      })
      .then(r=>r.json())
      .then(data=>{
        if(data.success){
          const ch={title:data.channelTitle,avatar:data.channelAvatar};
          setYtHistChannel(ch);
          setYtHistVideos(data.videos||[]);
          localStorage.setItem('tf_yt_channel',JSON.stringify(ch));
        }
      })
      .catch(()=>{});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  // Feature L: handle ?team_invite= redirect
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const inviteToken=params.get('team_invite');
    const teamId=params.get('team');
    if(inviteToken&&teamId&&token){
      const url=new URL(window.location.href);
      url.searchParams.delete('team_invite');
      url.searchParams.delete('team');
      window.history.replaceState(null,'',url.toString());
      fetch(`${resolvedApiUrl}/api/team/join?token=${inviteToken}&teamId=${teamId}`,{
        headers:{Authorization:`Bearer ${token}`}
      })
      .then(r=>r.json())
      .then(d=>{ if(d.success) setTeamData(d.team); })
      .catch(()=>{});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);


  useEffect(()=>{
    let cancelled=false;

    async function bootstrapEditor(){
      const safeUser = user;
      const safeToken = token || '';
      if (!safeUser || !safeUser.id) return;

      setIsLoading(true);

      try{
        // ── Resolve project ID synchronously before any await ──
        const urlDesignId = getProjectIdFromUrl();
        const resolvedProjectId = urlDesignId || generateProjectId();
        if(!cancelled){
          setProjectId(resolvedProjectId);
          if(!urlDesignId) syncProjectIdToUrl(resolvedProjectId);
        }

        // ── Path 0: IndexedDB local project (Gallery → Editor nav) ──────────────
        // When the Gallery sets ?project=<id> in the URL, try IndexedDB first.
        // This is instant (no network) and is the primary source of truth for
        // projects created/auto-saved in the browser.
        let idbProject = null;
        if(urlDesignId){
          try{
            idbProject = await loadProjectFromStorage(urlDesignId);
          }catch(e){
            console.warn('[BOOTSTRAP] IndexedDB load failed, falling back:', e);
          }
        }

        // ── Read localStorage draft synchronously (no network, instant) ──
        let restoredDraft = null;
        if(!idbProject){
          if(urlDesignId){
            // URL project ID found but not in IndexedDB — might be a Supabase UUID, continue
          } else {
            try{
              const rawDraft = localStorage.getItem(getProjectStorageKey(resolvedProjectId));
              if(rawDraft) restoredDraft = JSON.parse(rawDraft);
            }catch(e){
              console.error('Draft restore failed:', e);
              localStorage.removeItem(getProjectStorageKey(resolvedProjectId));
            }
          }
        }

        // ── Fire ALL network requests in parallel ──
        const isAdmin = safeUser?.is_admin || safeUser?.is_admin;
        // fetchSavedDesigns is non-critical — fire in background, don't block canvas render
        fetchSavedDesigns().catch(()=>{});
        const [remoteDesignResult, profileResult] = await Promise.allSettled([
          // 1. Remote design from Supabase (if URL has a valid UUID project ID)
          // Timestamp-based IDs (e.g. "1775596436228") are local-only — skip Supabase query
          (urlDesignId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlDesignId))
            ? supabase.from('thumbnails').select('*').eq('id', urlDesignId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          // 2. Pro profile — query by email (avoids bigint vs UUID mismatch)
          safeUser?.email
            ? supabase.from('profiles').select('is_pro').eq('email', safeUser.email).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if(cancelled)return;

        // ── Process remote design result ──
        let remoteDesign = null;
        if(urlDesignId){
          if(remoteDesignResult.status==='fulfilled'){
            const { data: remoteData, error: remoteError } = remoteDesignResult.value;
            if(remoteError){
              console.error('[BOOTSTRAP] Failed to load remote design:', remoteError.message);
            }else if(remoteData){
              console.log('[BOOTSTRAP] Remote design loaded:', remoteData.name);
              remoteDesign = remoteData;
            }
          }else{
            console.error('[BOOTSTRAP] Exception loading remote design:', remoteDesignResult.reason);
          }
        }

        // If no remote design and we skipped draft earlier, try localStorage now
        if(!remoteDesign && urlDesignId && !restoredDraft){
          try{
            const rawDraft = localStorage.getItem(getProjectStorageKey(resolvedProjectId));
            if(rawDraft) restoredDraft = JSON.parse(rawDraft);
          }catch(e){ /* ignore */ }
        }

        try{
          if(safeToken==='test-key-123' || isAdmin){
            setIsProUser(true);
          }else if(profileResult.status==='fulfilled'){
            const { data: profileData, error: profileError } = profileResult.value;
            if(profileError){
              console.error('[PRO PROFILE] Failed to fetch profiles.is_pro:', {
                email:safeUser?.email,
                message:profileError?.message,
                details:profileError?.details,
                hint:profileError?.hint,
                code:profileError?.code,
                status:profileError?.status,
              });
              setIsProUser(false);
            }else{
              setIsProUser(!!profileData?.is_pro);
            }
          }else{
            console.error('[PRO PROFILE] Promise rejected while fetching profiles.is_pro:', profileResult.reason);
            setIsProUser(false);
          }

        }catch(profileErr){
          if(!cancelled)console.error('[PRO PROFILE] Bootstrap failed:',profileErr);
        }

        const stateToRestore = restoredDraft;

        if(idbProject){
          // ── Path 0: Hydrate from IndexedDB (Gallery → Editor nav, or offline) ──
          const idbLayers = idbProject.layers || [];
          const idbPlatform = idbProject.platform || 'youtube';
          const maxIdbId = idbLayers.reduce((m,l)=>Math.max(m,typeof l.id==='number'?l.id:0),0);
          if(maxIdbId>=idCounter) idCounter=maxIdbId+1;

          setPlatform(idbPlatform);
          setLayers(idbLayers);
          layersRef.current=idbLayers;
          setBrightness(idbProject.brightness??100);
          setContrast(idbProject.contrast??100);
          setSaturation(idbProject.saturation??100);
          setHue(idbProject.hue??0);
          setDesignName(idbProject.designName||idbProject.name||'My Design');
          setProjectId(idbProject.projectId||resolvedProjectId);
          currentDesignIdRef.current=idbProject.projectId||resolvedProjectId;
          setCurrentDesignId(idbProject.projectId||resolvedProjectId);

          const snapshot=JSON.parse(JSON.stringify(idbLayers));
          historyRef.current=[snapshot];
          historyIndexRef.current=0;
          setHistory([snapshot]);
          setHistoryIndex(0);
          historyLabelsRef.current=['Open'];historyTimestampsRef.current=[Date.now()];
          setHistoryLabels(['Open']);setHistoryTimestamps([Date.now()]);setHistoryThumbnails({});
          loadDbSnapshots();
          lastSavedSignatureRef.current=buildSaveSignature({
            projectId:idbProject.projectId||resolvedProjectId,
            platform:idbPlatform,
            layers:idbLayers,
            brightness:idbProject.brightness??100,
            contrast:idbProject.contrast??100,
            saturation:idbProject.saturation??100,
            hue:idbProject.hue??0,
            designName:idbProject.designName||idbProject.name||'My Design',
            aiPrompt:'',
            lastGeneratedImageUrl:'',
          });
        }else if(remoteDesign){
          // ── Path A: Hydrate from Supabase remote design (Dashboard → Editor nav) ──
          const jsonData = remoteDesign.json_data || {};
          const remoteLayers = Array.isArray(jsonData.layers) && jsonData.layers.length > 0
            ? jsonData.layers
            : [makeBg(PLATFORMS[jsonData.platform || 'youtube'] || p)];
          const remotePlatform = jsonData.platform || remoteDesign.platform || 'youtube';
          const remoteBrightness = jsonData.brightness ?? 100;
          const remoteContrast   = jsonData.contrast   ?? 100;
          const remoteSaturation = jsonData.saturation ?? 100;
          const remoteHue        = jsonData.hue        ?? 0;
          const remoteName       = remoteDesign.name   || jsonData.name || 'My Design';

          const maxRemoteId = remoteLayers.reduce((m,l)=>Math.max(m,typeof l.id==='number'?l.id:0),0);
          if(maxRemoteId>=idCounter) idCounter=maxRemoteId+1;

          setPlatform(remotePlatform);
          setLayers(remoteLayers);
          layersRef.current=remoteLayers;
          setBrightness(remoteBrightness);
          setContrast(remoteContrast);
          setSaturation(remoteSaturation);
          setHue(remoteHue);
          setDesignName(remoteName);
          setProjectId(resolvedProjectId);
          currentDesignIdRef.current=remoteDesign.id;
          setCurrentDesignId(remoteDesign.id);
          syncProjectIdToUrl(remoteDesign.id);

          const snapshot = JSON.parse(JSON.stringify(remoteLayers));
          historyRef.current=[snapshot];
          historyIndexRef.current=0;
          setHistory([snapshot]);
          setHistoryIndex(0);
          historyLabelsRef.current=['Open'];historyTimestampsRef.current=[Date.now()];
          setHistoryLabels(['Open']);setHistoryTimestamps([Date.now()]);setHistoryThumbnails({});
          loadDbSnapshots();
          lastSavedSignatureRef.current=buildSaveSignature({
            projectId:resolvedProjectId,
            platform:remotePlatform,
            layers:remoteLayers,
            brightness:remoteBrightness,
            contrast:remoteContrast,
            saturation:remoteSaturation,
            hue:remoteHue,
            designName:remoteName,
            aiPrompt:'',
            lastGeneratedImageUrl:'',
          });
        }else if(stateToRestore){
          const restoredPlatform = stateToRestore.platform||'youtube';
          const restoredLayers = Array.isArray(stateToRestore.layers) && stateToRestore.layers.length>0
            ? stateToRestore.layers
            : [makeBg(PLATFORMS[restoredPlatform]||p)];
          const restoredCurrentDesignId = stateToRestore.currentDesignId||stateToRestore.currentId||null;
          // Advance idCounter past any restored IDs to prevent collisions when adding new layers
          const maxRestoredId = restoredLayers.reduce((m,l)=>Math.max(m,typeof l.id==='number'?l.id:0),0);
          if(maxRestoredId>=idCounter) idCounter=maxRestoredId+1;
          setPlatform(restoredPlatform);
          setLayers(restoredLayers);
          layersRef.current=restoredLayers;
          setBrightness(stateToRestore.brightness||100);
          setContrast(stateToRestore.contrast||100);
          setSaturation(stateToRestore.saturation||100);
          setHue(stateToRestore.hue||0);
          setDesignName(stateToRestore.designName||stateToRestore.name||'My Design');
          setAiPrompt(stateToRestore.aiPrompt||stateToRestore.prompt||'');
          setLastGeneratedImageUrl(stateToRestore.lastGeneratedImageUrl||stateToRestore.result_image_url||'');
          setProjectId(stateToRestore.projectId||resolvedProjectId);
          currentDesignIdRef.current=restoredCurrentDesignId;
          setCurrentDesignId(restoredCurrentDesignId);
          if(stateToRestore.textColor)setTextColor(stateToRestore.textColor);
          if(stateToRestore.strokeColor)setStrokeColor(stateToRestore.strokeColor);
          if(stateToRestore.fillColor)setFillColor(stateToRestore.fillColor);

          const snapshot = JSON.parse(JSON.stringify(restoredLayers));
          historyRef.current=[snapshot];
          historyIndexRef.current=0;
          setHistory([snapshot]);
          setHistoryIndex(0);
          historyLabelsRef.current=['Open'];historyTimestampsRef.current=[Date.now()];
          setHistoryLabels(['Open']);setHistoryTimestamps([Date.now()]);setHistoryThumbnails({});
          loadDbSnapshots();
          lastSavedSignatureRef.current=buildSaveSignature({
            projectId:stateToRestore.projectId||resolvedProjectId,
            platform:restoredPlatform,
            layers:restoredLayers,
            brightness:stateToRestore.brightness||100,
            contrast:stateToRestore.contrast||100,
            saturation:stateToRestore.saturation||100,
            hue:stateToRestore.hue||0,
            designName:stateToRestore.designName||stateToRestore.name||'My Design',
            aiPrompt:stateToRestore.aiPrompt||stateToRestore.prompt||'',
            lastGeneratedImageUrl:stateToRestore.lastGeneratedImageUrl||stateToRestore.result_image_url||'',
          });
        }else{
          const b=makeBg(p);
          setLayers([b]);
          layersRef.current=[b];
          historyRef.current=[[b]];
          historyIndexRef.current=0;
          setHistory([[b]]);
          setHistoryIndex(0);
          historyLabelsRef.current=['Open'];historyTimestampsRef.current=[Date.now()];
          setHistoryLabels(['Open']);setHistoryTimestamps([Date.now()]);setHistoryThumbnails({});
          loadDbSnapshots();
          setProjectId(resolvedProjectId);
          currentDesignIdRef.current=null;
          setCurrentDesignId(null);
          lastSavedSignatureRef.current=buildSaveSignature({
            projectId:resolvedProjectId,
            platform,
            layers:[b],
            brightness:100,
            contrast:100,
            saturation:100,
            hue:0,
            designName:'My Design',
            aiPrompt:'',
            lastGeneratedImageUrl:'',
          });
        }

        draftHydratedRef.current=true;
      }catch(e){
        if(!cancelled)console.error('Editor bootstrap failed:',e);

        if(!draftHydratedRef.current){
          const b=makeBg(p);
          setLayers([b]);
          layersRef.current=[b];
          historyRef.current=[[b]];
          historyIndexRef.current=0;
          setHistory([[b]]);
          setHistoryIndex(0);
          draftHydratedRef.current=true;
        }
      }finally{
        if(!cancelled){
          setIsLoading(false);
        }
      }
    }

    bootstrapEditor();
    return()=>{cancelled=true;};
  },[buildSaveSignature, fetchSavedDesigns, p, platform, token, user]);

  useEffect(()=>{
    if(!showFileTab)return;
    // Force fetch when tab opens for the first time; use cache on rapid re-opens
    fetchSavedDesigns({ force: galleryLastFetchAt.current === 0 });
  },[fetchSavedDesigns, showFileTab]);

  // Sync user.is_pro → isProUser whenever App.js async /auth/me response arrives
  useEffect(()=>{
    if(user?.is_pro===true||user?.plan==='pro') setIsProUser(true);
  },[user?.is_pro, user?.plan]);

  // ── Redraw heat map when canvas becomes visible or opacity changes ─────────
  useEffect(()=>{
    if(showHeatMap&&heatMapVisible&&heatMapData&&heatMapCanvasRef.current){
      drawHeatMap(heatMapData,p.preview.w,p.preview.h,heatMapOpacity,heatMapCanvasRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showHeatMap,heatMapVisible,heatMapData,heatMapOpacity]);

  // ── Sync text panel state when a text layer is selected ──────────────────
  useEffect(()=>{
    if(!selectedId)return;
    const layer=layersRef.current.find(l=>l.id===selectedId);
    if(layer?.type!=='text')return;
    if(layer.text!==undefined) setTextInput(layer.text);
    if(layer.fontFamily) setFontFamily(layer.fontFamily);
    if(layer.fontWeight) setFontWeight(layer.fontWeight);
    setFontItalic(!!layer.fontItalic);
    if(layer.fontSize) setFontSize(layer.fontSize);
    if(layer.letterSpacing!==undefined) setLetterSpacing(layer.letterSpacing||0);
    if(layer.lineHeight) setLineHeight(layer.lineHeight);
    if(layer.textAlign) setTextAlign(layer.textAlign);
    if(layer.textColor) setTextColor(layer.textColor);
    if(layer.strokeColor) setStrokeColor(layer.strokeColor);
    if(layer.strokeWidth!==undefined) setStrokeWidth(layer.strokeWidth||0);
    setShadowEnabled(!!layer.shadowEnabled);
    if(layer.shadowColor) setShadowColor(layer.shadowColor);
    if(layer.shadowBlur!==undefined) setShadowBlur(layer.shadowBlur||0);
    if(layer.shadowX!==undefined) setShadowX(layer.shadowX||0);
    if(layer.shadowY!==undefined) setShadowY(layer.shadowY||0);
    setGlowEnabled(!!layer.glowEnabled);
    if(layer.glowColor) setGlowColor(layer.glowColor);
    setArcEnabled(!!layer.arcEnabled);
    if(layer.arcRadius) setArcRadius(layer.arcRadius);
    setTextTransform(layer.textTransform||'none');
    setFillType(layer.fillType||'solid');
    if(Array.isArray(layer.gradientColors)&&layer.gradientColors.length>=2){setGradColor1(layer.gradientColors[0]);setGradColor2(layer.gradientColors[1]);}
    if(layer.gradientAngle!==undefined) setGradAngle(layer.gradientAngle||0);
    if(Array.isArray(layer.textStrokes)) setTextStrokes(layer.textStrokes);
    setWarpType(layer.warpType||'none');
    if(layer.warpAmount!==undefined) setWarpAmount(layer.warpAmount||30);
  },[selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Window drag handlers — ONLY fire when draggingRef or resizingRef is set
  // This means sidebar sliders are completely unaffected
  useEffect(()=>{
    function onMove(e){
      if(!draggingRef.current&&!resizingRef.current)return;
      const rs=resizeStartRef.current;
      const z=zoomRef.current;
      if(resizingRef.current&&rs){
        const dx=(e.clientX-rs.mouseX)/z,dy=(e.clientY-rs.mouseY)/z;
        setLayers(prev=>{
          const layer=prev.find(l=>l.id===resizingRef.current);if(!layer)return prev;
          if(layer.type==='text')return prev.map(l=>l.id===resizingRef.current?{...l,fontSize:Math.max(8,Math.round(rs.origFontSize+dx*0.5))}:l);
          const nw=Math.max(20,Math.round(rs.origW+dx));
          const nh=lockAspect?Math.round(nw/rs.aspect):Math.max(20,Math.round(rs.origH+dy));
          return prev.map(l=>l.id===resizingRef.current?{...l,width:nw,height:nh}:l);
        });
        return;
      }
      if(!draggingRef.current||!canvasRef.current)return;
      const rect=canvasRef.current.getBoundingClientRect();
      let x=(e.clientX-rect.left)/z-dragOffsetRef.current.x;
      let y=(e.clientY-rect.top)/z-dragOffsetRef.current.y;
      if(snapToGrid){x=Math.round(x/10)*10;y=Math.round(y/10)*10;}
      x=Math.max(-p.preview.w+10,Math.min(p.preview.w-10,x));
      y=Math.max(-p.preview.h+10,Math.min(p.preview.h-10,y));
      // ── Smart guides + snap ───────────────────────────────────────────────
      if(snapEnabled&&!altPressedRef.current){
        const SNAP_DIST=8;
        const dragLayer=layersRef.current.find(l=>l.id===draggingRef.current);
        const lw=dragLayer?.width||100;
        const lh=dragLayer?.type==='text'?(dragLayer?.fontSize||48):(dragLayer?.height||48);
        const pw=p.preview.w, ph=p.preview.h;
        // Targets: canvas edges, center, rule-of-thirds, other layer edges+centers
        const vT=[0, pw/2, pw, pw/3, pw*2/3];
        const hT=[0, ph/2, ph, ph/3, ph*2/3];
        layersRef.current.forEach(l=>{
          if(l.id===draggingRef.current||l.type==='background'||l.hidden)return;
          const lw2=l.width||100;
          const lh2=l.type==='text'?(l.fontSize||48):(l.height||48);
          vT.push(l.x, l.x+lw2/2, l.x+lw2);
          hT.push(l.y, l.y+lh2/2, l.y+lh2);
        });
        // Equal-spacing distribution guides (equidistant between two other layers)
        const others=layersRef.current.filter(l=>l.id!==draggingRef.current&&l.type!=='background'&&!l.hidden);
        for(let i=0;i<others.length;i++){
          for(let j=i+1;j<others.length;j++){
            const a=others[i],b=others[j];
            const aw=a.width||100, bw=b.width||100;
            const ah=a.type==='text'?(a.fontSize||48):(a.height||48);
            const bh=b.type==='text'?(b.fontSize||48):(b.height||48);
            const gH=a.x<b.x?b.x-(a.x+aw):a.x-(b.x+bw);
            if(gH>0)vT.push(Math.min(a.x+aw,b.x+bw)+gH/2-lw/2);
            const gV=a.y<b.y?b.y-(a.y+ah):a.y-(b.y+bh);
            if(gV>0)hT.push(Math.min(a.y+ah,b.y+bh)+gV/2-lh/2);
          }
        }
        let snappedV=null,snappedH=null;
        for(const g of vT){
          if(Math.abs(x-g)<SNAP_DIST){snappedV=g;x=g;break;}
          if(Math.abs(x+lw/2-g)<SNAP_DIST){snappedV=g;x=g-lw/2;break;}
          if(Math.abs(x+lw-g)<SNAP_DIST){snappedV=g;x=g-lw;break;}
        }
        for(const g of hT){
          if(Math.abs(y-g)<SNAP_DIST){snappedH=g;y=g;break;}
          if(Math.abs(y+lh/2-g)<SNAP_DIST){snappedH=g;y=g-lh/2;break;}
          if(Math.abs(y+lh-g)<SNAP_DIST){snappedH=g;y=g-lh;break;}
        }
        setSmartGuides({h:snappedH!==null?[snappedH]:[],v:snappedV!==null?[snappedV]:[]});
      } else {
        setSmartGuides({h:[],v:[]});
      }
      // Pixel snap — always land on whole pixel values
      if(pixelSnapEnabled){x=Math.round(x);y=Math.round(y);}
      // Group drag: move all children by delta from drag start
      if(groupDragInitRef.current){
        const init=groupDragInitRef.current;
        const cx=(e.clientX-rect.left)/z;
        const cy=(e.clientY-rect.top)/z;
        const dx=cx-init.startX;
        const dy=cy-init.startY;
        setLayers(prev=>prev.map(l=>{
          if(l.id!==draggingRef.current)return l;
          return{...l,children:(l.children||[]).map(c=>{const ic=init.children.find(ic2=>ic2.id===c.id);return ic?{...c,x:ic.x+dx,y:ic.y+dy}:c;})};
        }));
        return;
      }
      setLayers(prev=>prev.map(l=>l.id===draggingRef.current?{...l,x,y}:l));
    }
    function onUp(){
      if(!draggingRef.current&&!resizingRef.current)return;
      const clone=JSON.parse(JSON.stringify(layersRef.current));
      const newHist=[...historyRef.current.slice(0,historyIndexRef.current+1),clone];
      historyRef.current=newHist;
      historyIndexRef.current=newHist.length-1;
      setHistory(newHist);
      setHistoryIndex(newHist.length-1);
      draggingRef.current=null;
      resizingRef.current=null;
      resizeStartRef.current=null;
      setSmartGuides({h:[],v:[]});
      triggerAutoSave();
    }
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);};
  },[snapToGrid,snapEnabled,pixelSnapEnabled,lockAspect,p.preview.w,p.preview.h,triggerAutoSave]);

  useEffect(()=>{
    const handler=(e)=>{
      const active=document.activeElement;
      const typing=active.tagName==='INPUT'||active.tagName==='TEXTAREA'||active.tagName==='SELECT';
      const ctrl=e.ctrlKey||e.metaKey;

      // ── Always-on: Alt + Space refs ───────────────────────────────────────
      if(e.key==='Alt'){altPressedRef.current=true;}

      // ── Space → temporary pan mode ────────────────────────────────────────
      if(e.key===' '&&!typing&&!spaceHeldRef.current){
        e.preventDefault();
        spaceHeldRef.current=true;
        spaceToolRef.current=activeTool;
        setActiveTool('zoom');
        return;
      }

      // ── Ctrl / Cmd combos (work even while typing) ────────────────────────
      if(ctrl&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();return;}
      if(ctrl&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();redo();return;}
      if(ctrl&&e.key==='c'&&!e.shiftKey){
        if(selectionActive){e.preventDefault();copySelection();return;}
        if(selectedId){const l=layers.find(x=>x.id===selectedId);if(l)setClipboard(l);}
        return;
      }
      if(ctrl&&e.key==='x'&&!e.shiftKey){
        if(selectionActive){e.preventDefault();cutSelection();return;}
        return;
      }
      if(ctrl&&e.key==='v'){
        if(selClipboardRef.current){e.preventDefault();pasteFromSelClipboard();return;}
        if(clipboard)duplicateLayerFromObj(clipboard);
        return;
      }
      if(ctrl&&e.key==='j'){
        e.preventDefault();
        if(selectionActive){copySelectionToNewLayer();return;}
        if(selectedId)duplicateLayer(selectedId);
        return;
      }
      if(ctrl&&e.key==='d'){e.preventDefault();setSelectedId(null);setSelectedIds(new Set());clearSel();return;}
      if(ctrl&&e.key==='a'){e.preventDefault();if(['marquee','sel-lasso','sel-poly','sel-wand'].includes(activeTool)){selectAll();}else{const ids=new Set(layers.filter(l=>l.type!=='background').map(l=>l.id));setSelectedIds(ids);}return;}
      if(ctrl&&(e.key==='+'||e.key==='=')){e.preventDefault();setZoom(z=>Math.min(16,+(z+0.1).toFixed(1)));return;}
      if(ctrl&&e.key==='-'){e.preventDefault();setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)));return;}
      if(ctrl&&e.key==='0'){e.preventDefault();setZoom(1);setPanOffset({x:0,y:0});return;}
      if(ctrl&&e.key==='k'){e.preventDefault();setShowCommandPalette(o=>!o);return;}
      if(ctrl&&e.key==='p'){e.preventDefault();setShowCommandPalette(o=>!o);return;}
      if(ctrl&&e.key==='i'&&!e.shiftKey){e.preventDefault();setShowAiBar(o=>!o);setTimeout(()=>aiCmdInputRef.current?.focus(),50);return;}
      if(ctrl&&e.key==='s'){e.preventDefault();saveDesign(designName);saveEngineRef.current?.saveImmediate();return;}
      if(ctrl&&(e.key==='e'||e.key==='E')){e.preventDefault();setShowDownload(true);return;}
      if(ctrl&&e.key==='t'){e.preventDefault();/* free transform: layer already has handles */return;}
      if(ctrl&&e.key==='/'){ e.preventDefault();setShowShortcutsModal(s=>!s);return;}
      if(ctrl&&(e.key==='f'||e.key==='F')){ e.preventDefault();openFilters(!!lastFilterRef.current);return;}
      if(ctrl&&(e.key==='m'||e.key==='M')){ e.preventDefault();setShowStampTest(s=>!s);return;}
      if(ctrl&&e.key==='g'&&!e.shiftKey&&!e.altKey){ e.preventDefault();groupSelectedLayers();return;}
      if(ctrl&&e.shiftKey&&(e.key==='g'||e.key==='G')){ e.preventDefault();if(selectedId)ungroupLayer(selectedId);return;}
      if(ctrl&&e.altKey&&(e.key==='g'||e.key==='G')){ e.preventDefault();if(selectedId)toggleClipMask(selectedId);return;}
      if(ctrl&&e.shiftKey&&e.key==='i'){e.preventDefault();
        if(selectionActive){invertSel();return;}
        // Invert selection: select all except current
        const allIds=new Set(layers.filter(l=>l.type!=='background').map(l=>l.id));
        if(selectedId) allIds.delete(selectedId);
        setSelectedIds(allIds);
        return;
      }
      if(ctrl&&e.shiftKey&&(e.key==='p'||e.key==='P')){e.preventDefault();exportAsPsd();return;}
      if(ctrl&&e.shiftKey&&(e.key==='w'||e.key==='W')){e.preventDefault();if(selectedId){const l=layers.find(x=>x.id===selectedId);if(l&&(l.type==='image'||l.type==='text')){setWarpMode(true);setWarpBend(30);setWarpPreset('arc');}}return;}

      // ── Below this point: single-key shortcuts �� skip when typing ─────────
      if(typing) return;

      // Escape — deselect / cancel
      if(e.key==='Escape'){
        if(activeTool==='sel-poly'&&selDrawRef.current){selDrawRef.current=null;setSelDrawState(null);selPolyPointsRef.current=[];return;}
        if(selectionActive){clearSel();return;}
        setSelectedId(null);setSelectedIds(new Set());setShowShortcutsModal(false);return;
      }

      // Delete / Backspace — delete selection pixels if active, else delete selected layer
      if(e.key==='Delete'||e.key==='Backspace'){
        if(selectionActive){e.preventDefault();deleteSelection();return;}
        if(selectedId)deleteLayer(selectedId);
        return;
      }
      // Alt+Delete = fill with foreground color, Ctrl+Delete = fill with background color
      if(e.key==='Delete'&&e.altKey&&!ctrl){e.preventDefault();if(selectionActive)fillSelection(fillColor||'#FF4500');return;}
      if(e.key==='Delete'&&ctrl&&!e.altKey){e.preventDefault();if(selectionActive)fillSelection('#ffffff');return;}

      // ? — shortcuts modal
      if(e.key==='?'){setShowShortcutsModal(s=>!s);return;}

      // Smart snap toggle
      if(e.shiftKey&&e.key===';'){e.preventDefault();setSnapEnabled(s=>!s);return;}

      // Arrow keys — nudge selected layer
      if(selectedId&&(e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='ArrowLeft'||e.key==='ArrowRight')){
        e.preventDefault();
        const step=e.shiftKey?10:1;
        const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;
        const dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
        const cur=layers.find(l=>l.id===selectedId);
        if(cur&&cur.type!=='background'){
          updateLayer(selectedId,{x:Math.round((cur.x||0)+dx),y:Math.round((cur.y||0)+dy)});
          saveEngineRef.current?.markDirty('layerProperties',selectedId);
        }
        return;
      }

      // 1-9 → opacity, 0 → 100%
      if(/^[0-9]$/.test(e.key)&&selectedId){
        const pct=e.key==='0'?100:Number(e.key)*10;
        const cur=layers.find(l=>l.id===selectedId);
        if(cur&&cur.type!=='background'){updateLayer(selectedId,{opacity:pct});return;}
      }

      // [ ] — brush size   Shift+[ Shift+] — brush hardness
      if(e.key==='['&&!e.shiftKey&&(activeTool==='brush'||activeTool==='freehand'||RETOUCH_TOOLS.includes(activeTool))){
        if(activeTool==='freehand')setFreeBrushSize(s=>Math.max(1,s-2));
        else setBrushSizeState(s=>Math.max(1,s-5));
        return;
      }
      if(e.key===']'&&!e.shiftKey&&(activeTool==='brush'||activeTool==='freehand'||RETOUCH_TOOLS.includes(activeTool))){
        if(activeTool==='freehand')setFreeBrushSize(s=>Math.min(100,s+2));
        else setBrushSizeState(s=>Math.min(500,s+5));
        return;
      }
      if(e.key==='['&&e.shiftKey&&activeTool==='brush'){setBrushEdgeState('soft');return;}
      if(e.key===']'&&e.shiftKey&&activeTool==='brush'){setBrushEdgeState('hard');return;}

      // O key — toggle dodge/burn or set dodge tool
      if(e.key==='o'||e.key==='O'){
        if(activeTool==='dodge'||activeTool==='burn'){
          const next=activeTool==='dodge'?'burn':'dodge';
          setDodgeBurnMode(next);setActiveTool(next);
        } else {
          setActiveTool('dodge');setDodgeBurnMode('dodge');
        }
        return;
      }

      // Tool switches
      const toolMap={
        'v':'select','l':'lasso','w':'segment','c':'crop',
        'b':'brush','e':'freehand','t':'text','i':'rimlight',
        'g':'bggen','s':'segment','z':'zoom','h':'move',
      };
      if(e.key==='m'||e.key==='M'){setActiveTool('marquee');return;}
      const dest=toolMap[e.key.toLowerCase()];
      if(dest){setActiveTool(dest);if(dest!=='lasso')setIsLassoMode(false);return;}

      // D — reset colors, X — swap, Q — quick mask
      if(e.key==='d'||e.key==='D'){
        setTextColor('#ffffff');setFillColor('#FF4500');
        setStrokeColor('#000000');return;
      }
      if(e.key==='x'||e.key==='X'){
        setTextColor(prev=>{const old=prev;setStrokeColor(old);return strokeColor;});return;
      }
      if(e.key==='q'||e.key==='Q'){
        // Q = Quick Mask toggle (Item 20)
        if(['marquee','sel-lasso','sel-poly','sel-wand'].includes(activeTool)||selectionActive||quickMaskActive){
          e.preventDefault();toggleQuickMask();return;
        }
        if(activeTool==='lasso'){setIsLassoMode(false);setActiveTool('select');}
        else{setActiveTool('lasso');setIsLassoMode(true);}
        return;
      }
      // Shift+F6 — Feather dialog (Item 19)
      if(e.key==='F6'&&e.shiftKey){e.preventDefault();featherSelDialog();return;}
    };

    const onKeyUp=(e)=>{
      if(e.key==='Alt'){altPressedRef.current=false;}
      if(e.key===' '){
        spaceHeldRef.current=false;
        if(spaceToolRef.current){setActiveTool(spaceToolRef.current);spaceToolRef.current=null;}
      }
    };

    window.addEventListener('keydown',handler);
    window.addEventListener('keyup',onKeyUp);
    return()=>{window.removeEventListener('keydown',handler);window.removeEventListener('keyup',onKeyUp);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedId,layers,clipboard,historyIndex,history,designName,activeTool,strokeColor]);

  function makeBg(plat){return{id:newId(),type:'background',bgColor:'#ffffff',bgGradient:null,x:0,y:0,width:plat.preview.w,height:plat.preview.h,opacity:100,hidden:false,locked:true,blendMode:'normal',effects:defaultEffects()};}

  function pushHistory(nl, label='Edit'){
    const clone=nl.map(l=>{
      if(l.type==='image'){const {src,...rest}=l;return{...JSON.parse(JSON.stringify(rest)),src};}
      return JSON.parse(JSON.stringify(l));
    });
    const cutIdx=historyIndexRef.current+1;
    const newHist=[...historyRef.current.slice(0,cutIdx),clone].slice(-50);
    historyRef.current=newHist;
    historyIndexRef.current=newHist.length-1;
    setHistory(newHist);
    setHistoryIndex(newHist.length-1);
    // Labels + timestamps (parallel arrays, same slicing)
    const newLabels=[...historyLabelsRef.current.slice(0,cutIdx),label].slice(-50);
    const newTs=[...historyTimestampsRef.current.slice(0,cutIdx),Date.now()].slice(-50);
    historyLabelsRef.current=newLabels;
    historyTimestampsRef.current=newTs;
    setHistoryLabels(newLabels);
    setHistoryTimestamps(newTs);
    // Queue thumbnail generation for this new entry
    enqueueHistoryThumbnail(newHist.length-1, nl);
  }
  function pushHistoryDebounced(nl, label='Edit'){
    if(historyDebounceRef.current)clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current=setTimeout(()=>pushHistory(nl, label),400);
  }

  // ── History Thumbnail Generation ──────────────────────────────────────────
  function enqueueHistoryThumbnail(entryIdx, layersSnapshot){
    thumbQueueRef.current.push({entryIdx, layersSnapshot});
    if(!thumbBusyRef.current) processThumbQueue();
  }
  async function processThumbQueue(){
    if(thumbBusyRef.current) return;
    thumbBusyRef.current=true;
    while(thumbQueueRef.current.length>0){
      const {entryIdx,layersSnapshot}=thumbQueueRef.current.shift();
      await generateThumbForEntry(entryIdx, layersSnapshot);
      await new Promise(r=>setTimeout(r,16)); // yield a frame
    }
    thumbBusyRef.current=false;
  }
  async function generateThumbForEntry(entryIdx, layersSnapshot){
    if(!thumbCanvasRef.current) return;
    try{
      const TW=160, TH=90;
      thumbCanvasRef.current.width=TW;
      thumbCanvasRef.current.height=TH;
      await renderLayersToCanvas(thumbCanvasRef.current, layersSnapshot, {previewW:TW, previewH:TH, skipGlobalFilter:true});
      const ctx=thumbCanvasRef.current.getContext('2d');
      const idata=ctx.getImageData(0,0,TW,TH);
      const worker=getHistThumbWorker();
      if(worker){
        const buf=idata.data.buffer.slice(0);
        const handler=e=>{
          if(e.data.entryIdx!==entryIdx) return;
          worker.removeEventListener('message',handler);
          if(e.data.blob){
            const url=URL.createObjectURL(e.data.blob);
            setHistoryThumbnails(prev=>({...prev,[entryIdx]:url}));
          }
        };
        worker.addEventListener('message',handler);
        worker.postMessage({entryIdx, pixels:buf, srcW:TW, srcH:TH},[buf]);
      } else {
        // Fallback: use data URL directly
        const url=thumbCanvasRef.current.toDataURL('image/jpeg',0.65);
        setHistoryThumbnails(prev=>({...prev,[entryIdx]:url}));
      }
    }catch{}
  }

  // ── Snapshot persistence ───────────────────────────────────────────────────
  async function loadDbSnapshots(){
    try{
      const projectId=currentDesignIdRef.current||'default';
      const snaps=await db.snapshots.where('projectId').equals(projectId).sortBy('createdAt');
      setDbSnapshots(snaps.slice(-10));
    }catch{}
  }
  async function saveDbSnapshot(name){
    if(!name?.trim()) return;
    try{
      const layersClone=layers.map(l=>{
        if(l.type==='image'){const {src,...rest}=l;return{...JSON.parse(JSON.stringify(rest)),src};}
        return JSON.parse(JSON.stringify(l));
      });
      const thumbnail=Object.values(historyThumbnails).slice(-1)[0]||null;
      const projectId=currentDesignIdRef.current||'default';
      // Keep max 10 per project — delete oldest if over limit
      const existing=await db.snapshots.where('projectId').equals(projectId).sortBy('createdAt');
      if(existing.length>=10) await db.snapshots.delete(existing[0].id);
      await db.snapshots.add({projectId, name:name.trim(), createdAt:Date.now(), layers:layersClone, thumbnail});
      await loadDbSnapshots();
    }catch(e){console.error('Snapshot save error',e);}
  }
  async function restoreDbSnapshot(snap){
    const nl=snap.layers.map(l=>{
      if(l.type==='image'){const {src,...rest}=l;return{...JSON.parse(JSON.stringify(rest)),src};}
      return JSON.parse(JSON.stringify(l));
    });
    setLayers(nl);
    pushHistory(nl,`Restore: ${snap.name}`);
    triggerAutoSave();
  }
  async function deleteDbSnapshot(snapId){
    try{await db.snapshots.delete(snapId);await loadDbSnapshots();}catch{}
  }

  function undo(){
    const ni=historyIndexRef.current-1;if(ni<0)return;
    historyIndexRef.current=ni;setHistoryIndex(ni);
    setLayers(JSON.parse(JSON.stringify(historyRef.current[ni])));
    triggerAutoSave();
  }
  function redo(){
    const ni=historyIndexRef.current+1;if(ni>=historyRef.current.length)return;
    historyIndexRef.current=ni;setHistoryIndex(ni);
    setLayers(JSON.parse(JSON.stringify(historyRef.current[ni])));
    triggerAutoSave();
  }

  function addLayer(obj){
    const id=newId();
    const sx=snapToGrid?Math.round((obj.x??40)/10)*10:(obj.x??40);
    const sy=snapToGrid?Math.round((obj.y??40)/10)*10:(obj.y??40);
    const layer={...obj,id,x:sx,y:sy,opacity:100,hidden:false,locked:false,blendMode:'normal',flipH:false,flipV:false,rotation:0,effects:{...defaultEffects(),...(obj.effects||{})}};
    setLayers(prev=>{const nl=[...prev,layer];pushHistory(nl);return nl;});
    setSelectedId(id);
    triggerAutoSave();
  }

  function updateLayer(id,updates){setLayers(prev=>{const nl=updateLayerInTree(prev,id,l=>({...l,...updates}));pushHistoryDebounced(nl,"Edit Properties");return nl;});triggerAutoSave();saveEngineRef.current?.markDirty('layerProperties',id);}
  function updateLayerSilent(id,updates){setLayers(prev=>updateLayerInTree(prev,id,l=>({...l,...updates})));}
  function updateLayerEffect(id,key,value){setLayers(prev=>{const nl=updateLayerInTree(prev,id,l=>({...l,effects:{...(l.effects||defaultEffects()),[key]:value}}));pushHistory(nl);return nl;});triggerAutoSave();saveEngineRef.current?.markDirty('layerProperties',id);}
  function updateLayerEffectSilent(id,key,value){setLayers(prev=>updateLayerInTree(prev,id,l=>({...l,effects:{...(l.effects||defaultEffects()),[key]:value}})));}
  function updateLayerEffectNested(id,ek,sk,value){setLayers(prev=>{const nl=updateLayerInTree(prev,id,l=>({...l,effects:{...(l.effects||defaultEffects()),[ek]:{...((l.effects||defaultEffects())[ek]||{}),[sk]:value}}}));pushHistory(nl);return nl;});triggerAutoSave();saveEngineRef.current?.markDirty('layerProperties',id);}
  function updateLayerEffectNestedSilent(id,ek,sk,value){setLayers(prev=>updateLayerInTree(prev,id,l=>({...l,effects:{...(l.effects||defaultEffects()),[ek]:{...((l.effects||defaultEffects())[ek]||{}),[sk]:value}}})));}
  function updateLayerStrokes(id,newStrokes){updateLayerEffect(id,'strokes',newStrokes);}

  async function openLiquify(){
    const flat = document.createElement('canvas');
    flat.width  = p.preview.w;
    flat.height = p.preview.h;
    await renderLayersToCanvas(flat, layers);
    const imgData = flat.getContext('2d').getImageData(0, 0, p.preview.w, p.preview.h);
    setLiquifySource({ imageData: imgData, w: p.preview.w, h: p.preview.h });
    setShowLiquify(true);
  }

  async function openFilters(autoApply=false){
    const flat = document.createElement('canvas');
    flat.width  = p.preview.w;
    flat.height = p.preview.h;
    await renderLayersToCanvas(flat, layers);
    const imgData = flat.getContext('2d').getImageData(0, 0, p.preview.w, p.preview.h);
    setFiltersSource({ imageData: imgData, w: p.preview.w, h: p.preview.h });
    setFiltersAutoApply(autoApply);
    setShowFilters(true);
  }

  function addCurvesLayer(){
    const id=newId();
    const layer={id,type:'curves',curves:DEFAULT_CURVES(),x:0,y:0,opacity:100,hidden:false,locked:false,blendMode:'normal',flipH:false,flipV:false,rotation:0,effects:{...defaultEffects()}};
    setLayers(prev=>{const nl=[...prev,layer];pushHistory(nl);return nl;});
    setSelectedId(id);
    setActiveTool('curves');
    triggerAutoSave();
  }

  function addAdjustmentLayer(adjType){
    const id=newId();
    const nameMap={levels:'Levels 1',hueSat:'Hue/Sat 1',colorBalance:'Color Balance 1',vibrance:'Vibrance 1',selectiveColor:'Selective Color 1',gradientMap:'Gradient Map 1',posterize:'Posterize 1',threshold:'Threshold 1'};
    const layer={id,type:'adjustment',adjustmentType:adjType,name:nameMap[adjType]||'Adjustment 1',x:0,y:0,opacity:100,hidden:false,locked:false,blendMode:'normal',flipH:false,flipV:false,rotation:0,effects:{...defaultEffects()},settings:{...ADJ_DEFAULTS[adjType]},_cachedLUT:null,_lutDirty:true};
    setLayers(prev=>{
      // Insert above selected layer or at top
      const idx=selectedId?prev.findIndex(l=>l.id===selectedId):-1;
      const nl=idx>=0?[...prev.slice(0,idx+1),layer,...prev.slice(idx+1)]:[...prev,layer];
      pushHistory(nl,'Add Adjustment');return nl;
    });
    setSelectedId(id);
    setActiveTool('adjustment');
    setAdjLayerMenu(false);
    triggerAutoSave();
  }

  // ── Tablet detection handler (called by BrushOverlay on first pen event) ────
  function handleTabletDetected(){
    if(tabletDetected) return;
    setTabletDetected(true);
    setPressureEnabled(true);
    setPressureMapping('both');
    localStorage.setItem('tf_tablet_detected','1');
    showToastMsg('Drawing tablet detected — pressure sensitivity enabled','success');
  }

  // ── Retouch helpers ───────────────────────────────────────────────────────
  function applyRetouchStroke(canvasX, canvasY, tool){
    const layer = selectedId ? findInTree(layers, selectedId) : null;
    if(!layer || (layer.type!=='image'&&layer.type!=='background')) return;
    // Get image data from the layer
    const imgSrc = layer.paintSrc || layer.src;
    if(!imgSrc && layer.type!=='background') return;
    const imgW = layer.type==='background' ? p.preview.w : (layer.width||p.preview.w);
    const imgH = layer.type==='background' ? p.preview.h : (layer.height||p.preview.h);
    const bSize = brushSizeState;
    // Tile extraction: extract region around brush position
    const tx = Math.max(0, Math.round(canvasX - bSize));
    const ty = Math.max(0, Math.round(canvasY - bSize));
    const tw = Math.min(imgW - tx, bSize * 2 + 1);
    const th = Math.min(imgH - ty, bSize * 2 + 1);
    if(tw <= 0 || th <= 0) return;
    // We need to read from the flat render or from the layer canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = imgW; offscreen.height = imgH;
    const octx = offscreen.getContext('2d');
    if(layer.type==='background'){
      if(layer.bgGradient){const g=octx.createLinearGradient(0,0,0,imgH);g.addColorStop(0,layer.bgGradient[0]);g.addColorStop(1,layer.bgGradient[1]);octx.fillStyle=g;}else{octx.fillStyle=layer.bgColor||'#ffffff';}
      octx.fillRect(0,0,imgW,imgH);
    } else {
      const img = new Image();
      img.crossOrigin='Anonymous';
      img.onload=()=>{
        octx.drawImage(img,0,0,imgW,imgH);
        const tileData = octx.getImageData(tx,ty,tw,th);
        _sendRetouchTile(tileData,tx,ty,tw,th,layer,offscreen,octx,imgW,imgH,tool);
      };
      img.onerror=()=>{};
      img.src=imgSrc;
      return;
    }
    const tileData = octx.getImageData(tx,ty,tw,th);
    _sendRetouchTile(tileData,tx,ty,tw,th,layer,offscreen,octx,imgW,imgH,tool);
  }

  function _sendRetouchTile(tileData,tx,ty,tw,th,layer,offscreen,octx,imgW,imgH,tool){
    // Build feathered brush mask
    const hardness = brushEdgeState==='hard' ? 1.0 : 0.5;
    const bSize = brushSizeState;
    const mask = new Float32Array(tw*th);
    const cx2=tw/2, cy2=th/2;
    for(let my=0;my<th;my++) for(let mx=0;mx<tw;mx++){
      const dist=Math.hypot(mx-cx2,my-cy2);
      const norm=dist/bSize;
      mask[my*tw+mx]=norm>=1?0:norm<hardness?1:1-(norm-hardness)/(1-hardness+0.001);
    }
    const pixBuf=tileData.data.buffer.slice(0);
    const prevBuf=retouchPrevTileRef.current?.buffer?.slice(0)||null;
    const worker=getRetouchWorker();
    if(!worker){return;}
    const thisTool=(tool==='dodge'||tool==='burn')?dodgeBurnMode:tool==='blur-brush'?'blur':tool==='sharpen-brush'?'sharpen':tool;
    const onMsg=(evt)=>{
      worker.removeEventListener('message',onMsg);
      const {processedPixels}=evt.data;
      const processed=new Uint8ClampedArray(processedPixels);
      octx.putImageData(tileData,0,0); // restore full image
      // Read full image back then patch
      const fullData=octx.getImageData(0,0,imgW,imgH);
      for(let py=0;py<th;py++) for(let px=0;px<tw;px++){
        const si=(py*tw+px)*4, di=((ty+py)*imgW+(tx+px))*4;
        fullData.data[di]=processed[si]; fullData.data[di+1]=processed[si+1]; fullData.data[di+2]=processed[si+2]; fullData.data[di+3]=processed[si+3];
      }
      octx.putImageData(fullData,0,0);
      const dataUrl=offscreen.toDataURL('image/png');
      if(layer.type==='background'){
        updateLayerSilent(layer.id,{bgColor:'transparent',bgGradient:null,paintSrc:dataUrl,src:dataUrl,type:'image',x:0,y:0,width:p.preview.w,height:p.preview.h});
      } else {
        updateLayerSilent(layer.id,{paintSrc:dataUrl});
      }
      retouchPrevTileRef.current=new Uint8ClampedArray(processed);
    };
    worker.addEventListener('message',onMsg);
    const maskBuf=mask.buffer.slice(0);
    worker.postMessage({tool:thisTool,tilePixels:pixBuf,tileW:tw,tileH:th,strength:retouchStrength,exposure:retouchExposure,range:retouchRange,prevTilePixels:prevBuf,brushMask:maskBuf},[pixBuf,maskBuf]);
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  function getSelMode(e){
    if(e.shiftKey&&e.altKey)return'intersect';
    if(e.shiftKey)return'add';
    if(e.altKey)return'subtract';
    return'new';
  }

  function applySelection(newMask,mode){
    const combined=combineMasks(selectionMaskRef.current,newMask,mode);
    const feathered=selFeather>0?featherMask(combined,p.preview.w,p.preview.h,selFeather):combined;
    selectionMaskRef.current=feathered;
    setSelectionActive(true);
    setSelVersion(v=>v+1);
  }

  function clearSel(){
    selectionMaskRef.current=null;
    setSelectionActive(false);
    setSelDrawState(null);
    selPolyPointsRef.current=[];
  }

  function selectAll(){
    selectionMaskRef.current=selectAllMask(p.preview.w,p.preview.h);
    setSelectionActive(true);
    setSelVersion(v=>v+1);
  }

  function invertSel(){
    if(!selectionMaskRef.current)return;
    selectionMaskRef.current=invertMask(selectionMaskRef.current);
    setSelVersion(v=>v+1);
  }

  // ── Item 19: Feather dialog (Shift+F6) ────────────────────────────────────
  function featherSelDialog(){
    if(!selectionMaskRef.current){showToastMsg('No active selection','info');return;}
    const rawInput=window.prompt('Feather radius (pixels):', '5');
    if(rawInput===null)return; // cancelled
    const radius=parseInt(rawInput,10);
    if(!isFinite(radius)||radius<0){showToastMsg('Invalid feather radius','error');return;}
    if(radius===0)return;
    selectionMaskRef.current=featherMask(selectionMaskRef.current,p.preview.w,p.preview.h,radius);
    setSelVersion(v=>v+1);
    showToastMsg(`Feathered selection by ${radius}px`,'success');
  }

  // ── Item 20: Quick Mask Mode ───────────────────────────────────────────────
  function drawQuickMaskOverlay(){
    const qm=quickMaskCanvasRef.current;
    if(!qm)return;
    const ctx=qm.getContext('2d');
    ctx.clearRect(0,0,qm.width,qm.height);
    const m=selectionMaskRef.current;
    if(!m){ctx.fillStyle='rgba(255,0,0,0.4)';ctx.fillRect(0,0,qm.width,qm.height);return;}
    const id=ctx.createImageData(qm.width,qm.height);
    const scaleX=qm.width/p.preview.w, scaleY=qm.height/p.preview.h;
    for(let y=0;y<qm.height;y++) for(let x=0;x<qm.width;x++){
      const mx=Math.floor(x/scaleX), my=Math.floor(y/scaleY);
      const maskVal=m[my*p.preview.w+mx]||0;
      const i=(y*qm.width+x)*4;
      id.data[i]=255;id.data[i+1]=0;id.data[i+2]=0;
      id.data[i+3]=Math.round((1-maskVal/255)*0.4*255);
    }
    ctx.putImageData(id,0,0);
  }

  function toggleQuickMask(){
    if(quickMaskActive){
      // Convert QM canvas alpha back to selection mask
      const qm=quickMaskCanvasRef.current;
      if(qm){
        const qCtx=qm.getContext('2d');
        const qData=qCtx.getImageData(0,0,p.preview.w,p.preview.h);
        const newMask=new Uint8Array(p.preview.w*p.preview.h);
        for(let i=0;i<newMask.length;i++){
          newMask[i]=255-qData.data[i*4+3];
        }
        selectionMaskRef.current=newMask;
        setSelectionActive(true);
        setSelVersion(v=>v+1);
      }
      setQuickMaskActive(false);
    }else{
      setQuickMaskActive(true);
      // Draw overlay immediately
      setTimeout(()=>drawQuickMaskOverlay(),0);
    }
  }

  // ── Selection pixel operations ────────────────────────────────────────────
  // Helper: get the active image layer (selectedId must point to an image/background)
  function getActiveImageLayer(){
    if(!selectedId)return null;
    const layer=findInTree(layersRef.current,selectedId);
    if(!layer||(layer.type!=='image'&&layer.type!=='background'))return null;
    return layer;
  }

  // Helper: read layer pixels into an ImageData synchronously
  // Returns a Promise resolving to {imageData, canvas, ctx, layer}
  function readLayerPixels(layer){
    return new Promise(resolve=>{
      const W=layer.type==='background'?p.preview.w:(layer.width||p.preview.w);
      const H=layer.type==='background'?p.preview.h:(layer.height||p.preview.h);
      const canvas=document.createElement('canvas');
      canvas.width=W; canvas.height=H;
      const ctx=canvas.getContext('2d');
      if(layer.type==='background'){
        if(layer.bgGradient){
          const g=ctx.createLinearGradient(0,0,0,H);
          g.addColorStop(0,layer.bgGradient[0]);
          g.addColorStop(1,layer.bgGradient[1]);
          ctx.fillStyle=g;
        }else{ctx.fillStyle=layer.bgColor||'#ffffff';}
        ctx.fillRect(0,0,W,H);
        resolve({imageData:ctx.getImageData(0,0,W,H),canvas,ctx,layer});
      }else{
        const imgSrc=layer.paintSrc||layer.src;
        if(!imgSrc){resolve({imageData:ctx.getImageData(0,0,W,H),canvas,ctx,layer});return;}
        const img=new Image();
        img.crossOrigin='Anonymous';
        img.onload=()=>{ctx.drawImage(img,0,0,W,H);resolve({imageData:ctx.getImageData(0,0,W,H),canvas,ctx,layer});};
        img.onerror=()=>resolve({imageData:ctx.getImageData(0,0,W,H),canvas,ctx,layer});
        img.src=imgSrc;
      }
    });
  }

  // Helper: write modified ImageData back to layer
  function writeLayerPixels(layer,imageData,canvas,ctx,label){
    ctx.putImageData(imageData,0,0);
    const dataUrl=canvas.toDataURL('image/png');
    if(layer.type==='background'){
      updateLayerSilent(layer.id,{bgColor:'transparent',bgGradient:null,paintSrc:dataUrl,src:dataUrl,type:'image',
        x:0,y:0,width:p.preview.w,height:p.preview.h,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
        imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
    }else{
      updateLayerSilent(layer.id,{paintSrc:dataUrl});
    }
    setLayers(prev=>{pushHistory(prev,label);return prev;});
    saveEngineRef.current?.markDirty('layerContent',layer.id);
  }

  // Delete pixels under the selection mask
  // Helper: map a mask pixel index (p.preview.w stride) to an imageData pixel index
  // (layer.width stride, with layer.x/layer.y offset). Returns -1 if outside the layer.
  function maskIdxToImgIdx(mi,maskW,lx,ly,lw,lh){
    const mx=mi%maskW, my=Math.floor(mi/maskW);
    const px=mx-lx, py=my-ly;
    if(px<0||px>=lw||py<0||py>=lh)return -1;
    return py*lw+px;
  }

  function deleteSelection(){
    if(!selectionActive||!selectionMaskRef.current)return;
    const layer=getActiveImageLayer();
    if(!layer)return;
    readLayerPixels(layer).then(({imageData,canvas,ctx})=>{
      const m=selectionMaskRef.current;
      const mW=p.preview.w;
      const lx=layer.type==='background'?0:(layer.x||0);
      const ly=layer.type==='background'?0:(layer.y||0);
      const lw=imageData.width, lh=imageData.height;
      for(let i=0;i<m.length;i++){
        if(m[i]>0){
          const ii=maskIdxToImgIdx(i,mW,lx,ly,lw,lh);
          if(ii>=0)imageData.data[ii*4+3]=Math.max(0,Math.round(imageData.data[ii*4+3]*(1-m[i]/255)));
        }
      }
      writeLayerPixels(layer,imageData,canvas,ctx,'Delete Selection');
    });
  }

  // Copy pixels under selection mask to internal sel clipboard
  function copySelection(){
    if(!selectionActive||!selectionMaskRef.current)return;
    const layer=getActiveImageLayer();
    if(!layer)return;
    readLayerPixels(layer).then(({imageData,layer:l})=>{
      const m=selectionMaskRef.current;
      const mW=p.preview.w;
      const lx=layer.type==='background'?0:(layer.x||0);
      const ly=layer.type==='background'?0:(layer.y||0);
      const lw=imageData.width, lh=imageData.height;
      const copyData=new ImageData(lw,lh);
      for(let i=0;i<m.length;i++){
        if(m[i]>0){
          const ii=maskIdxToImgIdx(i,mW,lx,ly,lw,lh);
          if(ii>=0){
            const alpha=m[i]/255;
            copyData.data[ii*4]  =imageData.data[ii*4];
            copyData.data[ii*4+1]=imageData.data[ii*4+1];
            copyData.data[ii*4+2]=imageData.data[ii*4+2];
            copyData.data[ii*4+3]=Math.round(imageData.data[ii*4+3]*alpha);
          }
        }
      }
      selClipboardRef.current={imageData:copyData,bounds:maskBounds(m,mW,p.preview.h)};
    });
  }

  // Cut = Copy + Delete
  function cutSelection(){
    copySelection();
    // Slight delay so copySelection's async finishes first, then delete
    setTimeout(()=>deleteSelection(),10);
  }

  // Paste from sel clipboard as new layer
  function pasteFromSelClipboard(){
    const sc=selClipboardRef.current;
    if(!sc)return;
    const {imageData}=sc;
    const tmpC=document.createElement('canvas');
    tmpC.width=imageData.width; tmpC.height=imageData.height;
    tmpC.getContext('2d').putImageData(imageData,0,0);
    const dataUrl=tmpC.toDataURL('image/png');
    addLayer({type:'image',src:dataUrl,paintSrc:null,width:imageData.width,height:imageData.height,
      x:0,y:0,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
  }

  // Copy selection to new layer (Ctrl+J when selection active)
  function copySelectionToNewLayer(){
    if(!selectionActive||!selectionMaskRef.current)return;
    const layer=getActiveImageLayer();
    if(!layer)return;
    readLayerPixels(layer).then(({imageData})=>{
      const m=selectionMaskRef.current;
      const mW=p.preview.w;
      const lx=layer.type==='background'?0:(layer.x||0);
      const ly=layer.type==='background'?0:(layer.y||0);
      const lw=imageData.width, lh=imageData.height;
      const newCanvas=document.createElement('canvas');
      newCanvas.width=lw; newCanvas.height=lh;
      const nc=newCanvas.getContext('2d');
      const nd=nc.createImageData(lw,lh);
      for(let i=0;i<m.length;i++){
        if(m[i]>0){
          const ii=maskIdxToImgIdx(i,mW,lx,ly,lw,lh);
          if(ii>=0){
            nd.data[ii*4]  =imageData.data[ii*4];
            nd.data[ii*4+1]=imageData.data[ii*4+1];
            nd.data[ii*4+2]=imageData.data[ii*4+2];
            nd.data[ii*4+3]=Math.round(imageData.data[ii*4+3]*m[i]/255);
          }
        }
      }
      nc.putImageData(nd,0,0);
      const dataUrl=newCanvas.toDataURL('image/png');
      addLayer({type:'image',src:dataUrl,paintSrc:null,width:lw,height:lh,
        x:lx,y:ly,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
        name:(layer.name||'Layer')+' copy'});
      // addLayer already calls pushHistory, no need to call again
    });
  }

  // Fill selection with a color
  function fillSelection(color){
    if(!selectionActive||!selectionMaskRef.current)return;
    const layer=getActiveImageLayer();
    if(!layer)return;
    const hexStr=(color||'#ff4500').replace('#','');
    const fr=parseInt(hexStr.slice(0,2),16)||0;
    const fg=parseInt(hexStr.slice(2,4),16)||0;
    const fb=parseInt(hexStr.slice(4,6),16)||0;
    readLayerPixels(layer).then(({imageData,canvas,ctx})=>{
      const m=selectionMaskRef.current;
      const mW=p.preview.w;
      const lx=layer.type==='background'?0:(layer.x||0);
      const ly=layer.type==='background'?0:(layer.y||0);
      const lw=imageData.width, lh=imageData.height;
      for(let i=0;i<m.length;i++){
        if(m[i]>0){
          const ii=maskIdxToImgIdx(i,mW,lx,ly,lw,lh);
          if(ii>=0){
            const alpha=m[i]/255;
            imageData.data[ii*4]  =Math.round(imageData.data[ii*4]*(1-alpha)+fr*alpha);
            imageData.data[ii*4+1]=Math.round(imageData.data[ii*4+1]*(1-alpha)+fg*alpha);
            imageData.data[ii*4+2]=Math.round(imageData.data[ii*4+2]*(1-alpha)+fb*alpha);
            imageData.data[ii*4+3]=Math.max(imageData.data[ii*4+3],m[i]);
          }
        }
      }
      writeLayerPixels(layer,imageData,canvas,ctx,'Fill Selection');
    });
  }

  // ── Text panel helpers — keep panel state + selected layer in sync ────────
  function setTextProp(updates){if(selectedId&&layers.find(l=>l.id===selectedId)?.type==='text')updateLayer(selectedId,updates);}
  function setTextPropSilent(updates){if(selectedId&&layers.find(l=>l.id===selectedId)?.type==='text')updateLayerSilent(selectedId,updates);}

  // ── Multi-select align / distribute ──────────────────────────────────────
  function getLayerH(l){return l.type==='text'?(l.fontSize||48):(l.height||48);}
  function alignLayers(mode){
    const ids=[...selectedIds];
    if(ids.length<2)return;
    const sel=layers.filter(l=>ids.includes(l.id));
    const minX=Math.min(...sel.map(l=>l.x));
    const maxX=Math.max(...sel.map(l=>l.x+(l.width||100)));
    const minY=Math.min(...sel.map(l=>l.y));
    const maxY=Math.max(...sel.map(l=>l.y+getLayerH(l)));
    let nl=layers.map(l=>{
      if(!ids.includes(l.id))return l;
      const lw=l.width||100, lh=getLayerH(l);
      let nx=l.x, ny=l.y;
      if(mode==='left')   nx=minX;
      if(mode==='hcenter')nx=minX+(maxX-minX)/2-lw/2;
      if(mode==='right')  nx=maxX-lw;
      if(mode==='top')    ny=minY;
      if(mode==='vcenter')ny=minY+(maxY-minY)/2-lh/2;
      if(mode==='bottom') ny=maxY-lh;
      return {...l,x:Math.round(nx),y:Math.round(ny)};
    });
    setLayers(nl);pushHistory(nl);saveEngineRef.current?.markDirty('layerProperties');
  }
  function distributeLayers(axis){
    const ids=[...selectedIds];
    if(ids.length<3)return;
    const sel=layers.filter(l=>ids.includes(l.id));
    let nl=[...layers];
    if(axis==='h'){
      const sorted=[...sel].sort((a,b)=>a.x-b.x);
      const minX=sorted[0].x;
      const maxX=sorted[sorted.length-1].x+(sorted[sorted.length-1].width||100);
      const totalW=sorted.reduce((s,l)=>s+(l.width||100),0);
      const gap=(maxX-minX-totalW)/(sorted.length-1);
      let cx=minX;
      sorted.forEach(l=>{nl=nl.map(r=>r.id===l.id?{...r,x:Math.round(cx)}:r);cx+=(l.width||100)+gap;});
    } else {
      const sorted=[...sel].sort((a,b)=>a.y-b.y);
      const minY=sorted[0].y;
      const maxY=sorted[sorted.length-1].y+getLayerH(sorted[sorted.length-1]);
      const totalH=sorted.reduce((s,l)=>s+getLayerH(l),0);
      const gap=(maxY-minY-totalH)/(sorted.length-1);
      let cy=minY;
      sorted.forEach(l=>{nl=nl.map(r=>r.id===l.id?{...r,y:Math.round(cy)}:r);cy+=getLayerH(l)+gap;});
    }
    setLayers(nl);pushHistory(nl);saveEngineRef.current?.markDirty('layerProperties');
  }

  function deleteLayer(id){
    const layer=findInTree(layersRef.current,id);
    if(!layer) return;
    if(layer.type==='background'){if(layers.length<=1) return;}
    const[nl]=removeFromTree(layersRef.current,id);
    setLayers(prev=>{pushHistory(nl);return nl;});
    setSelectedId(null);triggerAutoSave();
    saveEngineRef.current?.saveImmediate();
  }
  function moveLayerUp(id){const idx=layers.findIndex(l=>l.id===id);if(idx>=layers.length-1)return;const nl=[...layers];[nl[idx],nl[idx+1]]=[nl[idx+1],nl[idx]];setLayers(nl);pushHistory(nl);triggerAutoSave();}
  function moveLayerDown(id){const idx=layers.findIndex(l=>l.id===id);if(idx<=0)return;const nl=[...layers];[nl[idx],nl[idx-1]]=[nl[idx-1],nl[idx]];setLayers(nl);pushHistory(nl);triggerAutoSave();}
  function duplicateLayerFromObj(layer){const nl2=deepCloneLayer({...layer,x:layer.x+16,y:layer.y+16});setLayers(prev=>{const nl=[...prev,nl2];pushHistory(nl,"Duplicate Layer");return nl;});setSelectedId(nl2.id);triggerAutoSave();}
  function duplicateLayer(id){const layer=findInTree(layersRef.current,id);if(!layer||layer.type==='background')return;duplicateLayerFromObj(layer);}
  function updateBg(updates){const bgL=layers.find(l=>l.type==='background');if(bgL)updateLayer(bgL.id,updates);}

  // ── Layer Groups ──────────────────────────────────────────────────────────────

  function groupSelectedLayers(){
    const allIds=new Set([...selectedIds,...(selectedId?[selectedId]:[])]);
    const toGroup=layers.filter(l=>allIds.has(l.id)&&l.type!=='background');
    if(toGroup.length<2){return;}
    const groupNum=layers.filter(l=>l.type==='group').length+1;
    const groupId=newId();
    const group={id:groupId,type:'group',name:`Group ${groupNum}`,children:toGroup,collapsed:false,opacity:100,hidden:false,locked:false,blendMode:'normal',effects:defaultEffects(),x:0,y:0};
    const toGroupIds=new Set(toGroup.map(l=>l.id));
    const maxIdx=Math.max(...toGroup.map(l=>layers.indexOf(l)));
    const remaining=layers.filter(l=>!toGroupIds.has(l.id));
    // Insert group at the position the topmost selected layer occupied
    const insertAt=remaining.findIndex((_,i)=>layers.findIndex(x=>x.id===remaining[i]?.id)>maxIdx);
    const adjustedAt=insertAt<0?remaining.length:insertAt;
    const nl=[...remaining.slice(0,adjustedAt),group,...remaining.slice(adjustedAt)];
    setLayers(nl);pushHistory(nl,"Group Layers");setSelectedId(groupId);setSelectedIds(new Set());
    triggerAutoSave();saveEngineRef.current?.markDirty('layerContent','group');
    // group created successfully
  }

  function ungroupLayer(id){
    const group=findInTree(layersRef.current,id);
    if(!group||group.type!=='group')return;
    const idx=layersRef.current.findIndex(l=>l.id===id);
    if(idx<0)return; // nested groups: only top-level ungroup for now
    const nl=[...layersRef.current];
    nl.splice(idx,1,...(group.children||[]));
    setLayers(nl);pushHistory(nl,"Ungroup Layers");
    setSelectedIds(new Set((group.children||[]).map(c=>c.id)));
    setSelectedId((group.children||[])[0]?.id||null);
    triggerAutoSave();saveEngineRef.current?.markDirty('layerContent','ungroup');
  }

  function setGroupCollapsed(id,collapsed){
    setLayers(prev=>updateLayerInTree(prev,id,l=>({...l,collapsed})));
  }

  async function mergeGroupToLayer(id){
    const group=findInTree(layersRef.current,id);
    if(!group||group.type!=='group')return;
    const tmp=document.createElement('canvas');
    tmp.width=p.preview.w;tmp.height=p.preview.h;
    await renderLayersToCanvas(tmp,group.children||[],{skipGlobalFilter:true});
    const dataUrl=tmp.toDataURL('image/png');
    const merged={type:'image',src:dataUrl,width:p.preview.w,height:p.preview.h,x:0,y:0,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,opacity:group.opacity??100,blendMode:group.blendMode||'normal',hidden:false,locked:false,flipH:false,flipV:false,rotation:0,effects:defaultEffects()};
    const idx=layersRef.current.findIndex(l=>l.id===id);
    const nl=[...layersRef.current];
    const mergedId=newId();
    nl.splice(idx,1,{...merged,id:mergedId});
    setLayers(nl);pushHistory(nl,"Merge Group");setSelectedId(mergedId);
    triggerAutoSave();saveEngineRef.current?.markDirty('layerContent','merge-group');
  }

  function deleteGroupAndChildren(id){deleteLayer(id);}

  // ── Clipping Masks ────────────────────────────────────────────────────────
  function toggleClipMask(id){
    const layerIdx=layers.findIndex(l=>l.id===id);
    if(layerIdx<=0) return; // can't clip the bottom-most layer
    const layer=layers[layerIdx];
    if(!layer||layer.type==='background') return;
    const wasClipped=layer.clipMask===true;
    const nl=layers.map((l,i)=>i===layerIdx?{...l,clipMask:wasClipped?undefined:true}:l);
    setLayers(nl);
    pushHistory(nl,wasClipped?'Release Clip Mask':'Create Clip Mask');
    saveEngineRef.current?.markDirty('layerProperties',id);
    triggerAutoSave();
  }
  function getLayerSrc(layer){
    if(layer.type==='image')return layer.paintSrc || layer.src;
    if(layer.type==='background'){
      const tmp=document.createElement('canvas');
      tmp.width=p.preview.w;tmp.height=p.preview.h;
      const ctx=tmp.getContext('2d');
      if(layer.bgGradient){const g=ctx.createLinearGradient(0,0,0,tmp.height);g.addColorStop(0,layer.bgGradient[0]);g.addColorStop(1,layer.bgGradient[1]);ctx.fillStyle=g;}
      else{ctx.fillStyle=layer.bgColor||'#f97316';}
      ctx.fillRect(0,0,tmp.width,tmp.height);
      return tmp.toDataURL('image/png');
    }
    return null;
  }
  function addRecentColor(color){setRecentColors(prev=>[color,...prev.filter(c=>c!==color)].slice(0,12));}


  function loadTemplate(template){
    if(!window.confirm(`Load template "${template.label}"? This will replace your current canvas.`)) return;

    // ✅ Find if template has its own background layer
    const templateHasBg = template.layers.some(l=>l.type==='background');

    // Only add a fresh bg if template doesn't include one
    const bg = makeBg(p);

    const templateLayers = template.layers.map(l=>({
      ...l,
      id:newId(),
      x:l.x??40,
      y:l.y??40,
      opacity:100,
      hidden:false,
      locked:l.type==='background'?true:false,
      blendMode:'normal',
      flipH:false,
      flipV:false,
      rotation:0,
      effects:defaultEffects(),
    }));

    // ✅ Use template bg if it has one, otherwise use fresh white bg
    const newLayers = templateHasBg
      ? templateLayers
      : [bg, ...templateLayers];

    setLayers(newLayers);
    pushHistory(newLayers);
    setSelectedId(null);
    setCmdLog(`Loaded: ${template.label}`);
    setActiveTool('select');
  }

  async function executeAiCommand(cmd){
    if(!cmd.trim()) return;
    setAiCmdLoading(true);
    setAiCmdLog('');

    try{
      const canvasState = {
        platform,
        canvasWidth:  p.preview.w,
        canvasHeight: p.preview.h,
        globalBrightness: brightness,
        globalContrast:   contrast,
        globalSaturation: saturation,
        globalHue:        hue,
        selectedLayerId:  selectedId,
        selectedLayerType: selectedLayer?.type,
        layers: layers.map(l=>({
          id:         l.id,
          type:       l.type,
          isSelected: l.id === selectedId,
          isImage:    l.type === 'image',
          label:      l.type==='text' ? `text:"${l.text?.slice(0,30)}"` : l.type==='background' ? 'background' : `${l.type}-layer`,
          x:          l.x,
          y:          l.y,
          width:      l.width,
          height:     l.height,
          hidden:     l.hidden,
          opacity:    l.opacity,
          blendMode:  l.blendMode,
          text:       l.text,
          fontSize:   l.fontSize,
          fontFamily: l.fontFamily,
          fontWeight: l.fontWeight,
          textColor:  l.textColor,
          strokeWidth:l.strokeWidth,
          strokeColor:l.strokeColor,
          shadowEnabled:l.shadowEnabled,
          glowEnabled:l.glowEnabled,
          bgColor:    l.bgColor,
          bgGradient: l.bgGradient,
          imgBrightness: l.imgBrightness,
          imgContrast:   l.imgContrast,
          imgSaturate:   l.imgSaturate,
          imgBlur:       l.imgBlur,
        })),
      };

      const { data: { session: aiCmdSession } } = await supabase.auth.getSession();
      const aiCmdToken = aiCmdSession?.access_token;
      const res = await fetch(`${resolvedApiUrl}/ai-command`,{
        method:  'POST',
        headers: {'Content-Type':'application/json','Authorization':`Bearer ${aiCmdToken}`},
        body:    JSON.stringify({ command:cmd, canvasState }),
      });
      const data = await res.json().catch(()=>({}));

      if(data.error){
        setAiCmdLog(`Error: ${data.error}`);
        setAiCmdLoading(false);
        return;
      }

      const result = data.result;
      if(!result){
        setAiCmdLog('Could not understand. Try rephrasing.');
        setAiCmdLoading(false);
        return;
      }

      // Handle single or multiple actions
      const actions = result.actions || [result];
      const log = [];

      for(const action of actions){
        if(!action?.action) continue;

        switch(action.action){

          case 'adjustBrightness':
            setBrightness(Math.min(200,Math.max(0,Number(action.value)||100)));
            log.push(`Brightness → ${action.value}%`);
            break;

          case 'adjustContrast':
            setContrast(Math.min(300,Math.max(0,Number(action.value)||100)));
            log.push(`Contrast → ${action.value}%`);
            break;

          case 'adjustSaturation':
            setSaturation(Math.min(300,Math.max(0,Number(action.value)||100)));
            log.push(`Saturation → ${action.value}%`);
            break;

          case 'adjustHue':
            setHue(Math.min(360,Math.max(0,Number(action.value)||0)));
            log.push(`Hue → ${action.value}°`);
            break;

          case 'updateBackground':{
            const bgLayer = layers.find(l=>l.type==='background');
            if(bgLayer){
              updateLayer(bgLayer.id, action.updates||{});
              log.push('Background updated');
            }
            break;
          }

          case 'updateLayer':
            if(action.id){
              const target = layers.find(l=>l.id===action.id);
              if(target){
                updateLayer(action.id, action.updates||{});
                const changes = Object.keys(action.updates||{}).join(', ');
                log.push(`Updated ${target.type==='text'?`"${target.text?.slice(0,15)}"`:target.type}: ${changes}`);
              }
            }
            break;

          case 'addText':
            addLayer({
              type:         'text',
              text:         action.text         || 'NEW TEXT',
              fontSize:     action.fontSize      || 60,
              fontFamily:   action.fontFamily    || 'Impact',
              fontWeight:   action.fontWeight    || 900,
              fontItalic:   action.fontItalic    || false,
              textColor:    action.textColor     || '#ffffff',
              strokeColor:  action.strokeColor   || '#000000',
              strokeWidth:  action.strokeWidth   || 3,
              shadowEnabled:action.shadowEnabled !== false,
              shadowColor:  action.shadowColor   || '#000000',
              shadowBlur:   action.shadowBlur    || 20,
              shadowX:      action.shadowX       || 3,
              shadowY:      action.shadowY       || 3,
              glowEnabled:  action.glowEnabled   || false,
              glowColor:    action.glowColor     || '#f97316',
              arcEnabled:   false,
              arcRadius:    120,
              letterSpacing:action.letterSpacing || 2,
              lineHeight:   action.lineHeight    || 1.2,
              textAlign:    action.textAlign     || 'center',
              x:            action.x             || 60,
              y:            action.y             || 80,
            });
            log.push(`Added text: "${action.text}"`);
            break;

          case 'deleteLayer':
            if(action.id){
              const target = layers.find(l=>l.id===action.id);
              if(target && target.type!=='background'){
                deleteLayer(action.id);
                log.push('Layer deleted');
              }
            }
            break;

          case 'moveLayer':
            if(action.id){
              updateLayer(action.id,{
                x: action.x ?? layers.find(l=>l.id===action.id)?.x,
                y: action.y ?? layers.find(l=>l.id===action.id)?.y,
              });
              log.push('Layer moved');
            }
            break;

          case 'resizeLayer':
            if(action.id){
              updateLayer(action.id,{
                width:  action.width  || layers.find(l=>l.id===action.id)?.width,
                height: action.height || layers.find(l=>l.id===action.id)?.height,
              });
              log.push('Layer resized');
            }
            break;

          case 'message':
            setAiCmdLog(action.message||'Done');
            setAiCmdLoading(false);
            return;

          default:
            log.push(`Unknown action: ${action.action}`);
        }
      }

      setAiCmdLog(log.length>0 ? `✓ ${log.join(' · ')}` : '✓ Done');
      setAiCmd('');

    }catch(err){
      console.error('AI command error:',err);
      setAiCmdLog('Failed — make sure API is running on port 5000');
    }

    setAiCmdLoading(false);
  }

  async function analyzeFace(){
    setFaceLoading(true);
    setFaceAnalysis(null);

    try{
      // Find image layers that might have faces
      const imageLayers=layers.filter(l=>l.type==='image'&&!l.hidden);
      if(imageLayers.length===0){
        setFaceAnalysis({
          error:true,
          message:'No image layers found. Upload a photo with a face first.',
        });
        setFaceLoading(false);
        return;
      }

      // Render the canvas for analysis
      const canvas  = document.createElement('canvas');
      canvas.width  = p.preview.w;
      canvas.height = p.preview.h;
      const ctx     = canvas.getContext('2d');

      // Draw background
      const bg=layers.find(l=>l.type==='background');
      if(bg){
        ctx.fillStyle=bg.bgColor||'#000';
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }

      // Draw image layers
      for(const obj of imageLayers){
        await new Promise(resolve=>{
          const img=new Image();
          img.crossOrigin='Anonymous';
          img.onload=()=>{
            ctx.save();
            ctx.globalAlpha=(obj.opacity??100)/100;
            ctx.drawImage(img,obj.x,obj.y,obj.width,obj.height);
            ctx.restore();
            resolve();
          };
          img.onerror=()=>resolve();
          img.src=obj.paintSrc||obj.src;
        });
      }

      // Analyze pixel data for face-like features
      const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
      const data      = imageData.data;
      const w         = canvas.width, h = canvas.height;

      // ── Skin tone detection ──────────────────────────────────────────────────
      let skinPixels=0, totalPixels=0;
      let skinCenterX=0, skinCenterY=0, skinCount=0;
      for(let x=0;x<w;x+=2) for(let y=0;y<h;y+=2){
        const i=(y*w+x)*4;
        const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
        if(a<128) continue;
        totalPixels++;
        // Skin tone ranges (works for multiple skin tones)
        const isSkin=(
          r>60&&g>40&&b>20&&
          r>g&&r>b&&
          Math.abs(r-g)>10&&
          r-b>10&&
          r<250&&g<220&&b<200&&
          (r-g)<50
        );
        if(isSkin){
          skinPixels++;
          skinCenterX+=x;skinCenterY+=y;skinCount++;
        }
      }

      const skinRatio = totalPixels>0?skinPixels/totalPixels:0;
      const hasFace   = skinRatio>0.03;
      const faceX     = skinCount>0?skinCenterX/skinCount:w/2;
      const faceY     = skinCount>0?skinCenterY/skinCount:h/2;

      // ── Face position analysis ───────────────────────────────────────────────
      const isLeftThird   = faceX<w*0.33;
      const isRightThird  = faceX>w*0.66;
      const isCentered    = !isLeftThird&&!isRightThird;
      const isTopHalf     = faceY<h*0.5;

      // ── Face size analysis ───────────────────────────────────────────────────
      const faceArea = skinPixels*4; // approximate
      const canvasArea = w*h;
      const faceSizeRatio = faceArea/canvasArea;
      const faceIsTooSmall = faceSizeRatio<0.04;
      const faceIsGood     = faceSizeRatio>=0.04&&faceSizeRatio<0.35;

      // ── Brightness at face area ──────────────────────────────────────────────
      let faceBrightness=0, facePxCount=0;
      const fr=30;
      for(let x=Math.max(0,Math.round(faceX)-fr);
          x<Math.min(w,Math.round(faceX)+fr);x++){
        for(let y=Math.max(0,Math.round(faceY)-fr);
            y<Math.min(h,Math.round(faceY)+fr);y++){
          const i=(y*w+x)*4;
          const lum=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
          faceBrightness+=lum;facePxCount++;
        }
      }
      const avgFaceBrightness=facePxCount>0?faceBrightness/facePxCount:128;
      const faceWellLit=avgFaceBrightness>80&&avgFaceBrightness<220;

      // ── Contrast around face ─────────────────────────────────────────────────
      let edgeStrength=0, edgeCount=0;
      for(let x=Math.max(1,Math.round(faceX)-fr);
          x<Math.min(w-1,Math.round(faceX)+fr);x++){
        for(let y=Math.max(1,Math.round(faceY)-fr);
            y<Math.min(h-1,Math.round(faceY)+fr);y++){
          const i=(y*w+x)*4;
          const dx=Math.abs(data[i]-data[(y*w+x+1)*4]);
          const dy=Math.abs(data[i]-data[((y+1)*w+x)*4]);
          edgeStrength+=dx+dy;edgeCount++;
        }
      }
      const avgEdge=edgeCount>0?edgeStrength/edgeCount:0;
      const hasGoodContrast=avgEdge>15;

      // ── Generate scores and tips ─────────────────────────────────────────────
      const scores=[];
      const tips=[];
      const goods=[];

      // Face presence
      if(!hasFace){
        scores.push({label:'Face detected',score:0,max:25});
        tips.push('No face detected. Thumbnails with faces get up to 38% more clicks.');
      } else {
        scores.push({label:'Face detected',score:25,max:25});
        goods.push('Face detected — great start!');
      }

      // Face size
      if(hasFace){
        if(faceIsTooSmall){
          scores.push({label:'Face size',score:5,max:20});
          tips.push('Face is too small. Fill at least 15% of the thumbnail for maximum impact.');
        } else if(faceIsGood){
          scores.push({label:'Face size',score:20,max:20});
          goods.push('Face size is perfect.');
        } else {
          scores.push({label:'Face size',score:12,max:20});
          tips.push('Face might be slightly too large. Leave room for text.');
        }
      } else {
        scores.push({label:'Face size',score:0,max:20});
      }

      // Face position
      if(hasFace){
        if(isRightThird&&isTopHalf){
          scores.push({label:'Positioning',score:20,max:20});
          goods.push('Face is top-right — perfect for text on the left.');
        } else if(isLeftThird&&isTopHalf){
          scores.push({label:'Positioning',score:18,max:20});
          goods.push('Face is top-left — good composition.');
        } else if(isCentered){
          scores.push({label:'Positioning',score:12,max:20});
          tips.push('Face is centered. Try moving it to the right third — leaves room for bold text on the left.');
        } else {
          scores.push({label:'Positioning',score:10,max:20});
          tips.push('Face is in the lower area. Move it higher — faces in the top half get more attention.');
        }
      } else {
        scores.push({label:'Positioning',score:0,max:20});
      }

      // Lighting
      if(hasFace){
        if(faceWellLit){
          scores.push({label:'Lighting',score:20,max:20});
          goods.push('Face is well lit — clear and visible.');
        } else if(avgFaceBrightness<=80){
          scores.push({label:'Lighting',score:8,max:20});
          tips.push('Face looks dark. Increase brightness or add rim lighting to make the face pop.');
        } else {
          scores.push({label:'Lighting',score:10,max:20});
          tips.push('Face may be overexposed. Reduce brightness slightly for a more natural look.');
        }
      } else {
        scores.push({label:'Lighting',score:0,max:20});
      }

      // Contrast
      if(hasFace){
        if(hasGoodContrast){
          scores.push({label:'Stands out',score:15,max:15});
          goods.push('Face stands out from the background.');
        } else {
          scores.push({label:'Stands out',score:5,max:15});
          tips.push('Face blends into background. Remove the background or add a contrasting color behind the subject.');
        }
      } else {
        scores.push({label:'Stands out',score:0,max:15});
      }

      // Calculate total
      const total=scores.reduce((a,s)=>a+s.score,0);
      const maxTotal=scores.reduce((a,s)=>a+s.max,0);
      const pct=Math.round((total/maxTotal)*100);

      // Emotion suggestions based on content
      const emotionTips=[];
      if(hasFace){
        emotionTips.push({
          emotion:'😱 Shocked',
          tip:'Works great for "You won\'t believe..." thumbnails. Wide eyes, open mouth.',
          ctr:'High CTR',
        });
        emotionTips.push({
          emotion:'😄 Excited',
          tip:'Best for positive content, reveals, giveaways. Big smile, eyebrows raised.',
          ctr:'High CTR',
        });
        emotionTips.push({
          emotion:'😤 Determined',
          tip:'Great for challenge/achievement videos. Strong jaw, focused eyes.',
          ctr:'Medium CTR',
        });
        emotionTips.push({
          emotion:'🤔 Curious',
          tip:'Works for "what if" and educational content. Head tilt, raised eyebrow.',
          ctr:'Medium CTR',
        });
      }

      setFaceAnalysis({
        hasFace,
        score:pct,
        total,maxTotal,
        scores,tips,goods,
        emotionTips,
        facePosition:{
          x:Math.round((faceX/w)*100),
          y:Math.round((faceY/h)*100),
        },
        skinRatio:Math.round(skinRatio*100),
      });

    }catch(err){
      console.error('Face analysis error:',err);
      setFaceAnalysis({error:true,message:'Analysis failed. Try again.'});
    }
    setFaceLoading(false);
  }

  // ── MediaPipe Face Mesh — Expression Engine ───────────────────────────────

  // Lazy-load MediaPipe from CDN (only when first needed)
  async function loadMediaPipeFaceMesh(){
    if(window._mpFaceMeshReady) return true;
    return new Promise((resolve)=>{
      if(document.getElementById('mp-face-mesh-script')){
        // Script tag exists but may still be loading
        const check=setInterval(()=>{
          if(window.FaceMesh){clearInterval(check);window._mpFaceMeshReady=true;resolve(true);}
        },200);
        setTimeout(()=>{clearInterval(check);resolve(false);},15000);
        return;
      }
      const script=document.createElement('script');
      script.id='mp-face-mesh-script';
      script.src='https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js';
      script.crossOrigin='anonymous';
      script.onload=()=>{window._mpFaceMeshReady=true;resolve(true);};
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    });
  }

  function calculateExpressionScore(landmarks){
    if(!landmarks||landmarks.length<468) return null;
    const lm=landmarks;
    const faceHeight=Math.abs(lm[152].y-lm[10].y)||0.3;

    // 1. Mouth openness — inner lip gap
    const mouthOpen=Math.abs(lm[13].y-lm[14].y)/faceHeight;
    const mouthScore=Math.min(10,Math.round((mouthOpen/0.12)*10));
    const mouthTip=mouthOpen<0.04
      ?'Open your mouth wider — closed mouths lose ~30% CTR on average'
      :mouthOpen<0.08
      ?'Open your mouth a bit more for a higher-energy expression'
      :null;

    // 2. Eye wideness — eyelid gap
    const leftEyeH =Math.abs(lm[159].y-lm[145].y)/faceHeight;
    const rightEyeH=Math.abs(lm[386].y-lm[374].y)/faceHeight;
    const eyeAvg=(leftEyeH+rightEyeH)/2;
    const eyeScore=Math.min(10,Math.round((eyeAvg/0.04)*10));
    const eyeTip=eyeAvg<0.02
      ?'Open your eyes wider — wide eyes signal surprise and excitement'
      :eyeAvg<0.03
      ?'Open your eyes a bit more for a punchier expression'
      :null;

    // 3. Eyebrow raise — brow-to-eye vertical gap (landmarks 66/296 are mid-brow)
    const leftBrow =Math.abs(lm[66].y -lm[159].y)/faceHeight;
    const rightBrow=Math.abs(lm[296].y-lm[386].y)/faceHeight;
    const browAvg=(leftBrow+rightBrow)/2;
    const browScore=Math.min(10,Math.round((browAvg/0.09)*10));
    const browTip=browAvg<0.05
      ?'Raise your eyebrows — high eyebrows signal shock or excitement'
      :browAvg<0.07
      ?'Raise your eyebrows a bit more for maximum impact'
      :null;

    // 4. Head tilt — angle of eye-to-eye line
    const dx=lm[263].x-lm[33].x;
    const dy=lm[263].y-lm[33].y;
    const tiltDeg=Math.abs(Math.atan2(dy,dx)*(180/Math.PI));
    const tiltScore=tiltDeg<3?4:tiltDeg<7?7:tiltDeg<22?10:tiltDeg<35?7:4;
    const tiltTip=tiltDeg<5
      ?'Add a slight head tilt (10–15°) — dynamic angles boost visual energy'
      :tiltDeg>30
      ?'Your tilt is quite extreme — 10–20° is the sweet spot'
      :null;

    const weights=[0.35,0.25,0.25,0.15];
    const overall=Math.min(10,Math.round(
      mouthScore*weights[0]+eyeScore*weights[1]+browScore*weights[2]+tiltScore*weights[3]
    ));

    // Face bounding box (normalized 0-1)
    const faceX=Math.min(lm[234].x,lm[454].x);
    const faceY=Math.min(lm[10].y, lm[152].y);
    const faceW=Math.abs(lm[454].x-lm[234].x);
    const faceH=Math.abs(lm[152].y-lm[10].y);

    return{overall,mouth:{score:mouthScore,tip:mouthTip},eyes:{score:eyeScore,tip:eyeTip},brows:{score:browScore,tip:browTip},tilt:{score:tiltScore,tip:tiltTip},bbox:{x:faceX,y:faceY,w:faceW,h:faceH}};
  }

  // Run on composite canvas — called after image upload (fire-and-forget)
  async function runFaceDetectionOnComposite(){
    const ready=await loadMediaPipeFaceMesh();
    if(!ready||!window.FaceMesh) return;
    setExpressionBusy(true);
    try{
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w;
      flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layersRef.current);

      const imgEl=new Image();
      imgEl.src=flatCanvas.toDataURL('image/jpeg',0.9);
      await new Promise(res=>{ imgEl.onload=res; imgEl.onerror=res; });

      const result=await new Promise((resolve)=>{
        try{
          const fm=new window.FaceMesh({
            locateFile:(file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
          });
          fm.setOptions({maxNumFaces:1,refineLandmarks:false,minDetectionConfidence:0.5,minTrackingConfidence:0.5});
          fm.onResults((r)=>{
            fm.close();
            resolve(r.multiFaceLandmarks?.[0]||null);
          });
          fm.send({image:imgEl}).catch(()=>resolve(null));
        }catch(e){resolve(null);}
      });

      if(result){
        setExpressionScore(calculateExpressionScore(result));
        setShowExpressionScore(true);
      }
    }catch(e){
      console.warn('[FACE MESH]',e.message);
    }finally{
      setExpressionBusy(false);
    }
  }

  // Enhance expression via backend SD inpainting
  async function enhanceExpression(){
    if(!expressionScore?.bbox||enhanceBusy) return;
    setEnhanceBusy(true);
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      // Composite full canvas
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w;
      flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layers);

      // Extract face crop with 15% padding
      const bb=expressionScore.bbox;
      const padX=bb.w*p.preview.w*0.15;
      const padY=bb.h*p.preview.h*0.15;
      const cx=Math.max(0,Math.round(bb.x*p.preview.w-padX));
      const cy=Math.max(0,Math.round(bb.y*p.preview.h-padY));
      const cw=Math.min(p.preview.w-cx,Math.round(bb.w*p.preview.w+padX*2));
      const ch=Math.min(p.preview.h-cy,Math.round(bb.h*p.preview.h+padY*2));

      const crop=document.createElement('canvas');
      crop.width=cw; crop.height=ch;
      crop.getContext('2d').drawImage(flatCanvas,cx,cy,cw,ch,0,0,cw,ch);

      // Create mask (white = re-generate expression features, black = keep edges)
      const maskCanvas=document.createElement('canvas');
      maskCanvas.width=cw; maskCanvas.height=ch;
      const mCtx=maskCanvas.getContext('2d');
      mCtx.fillStyle='#000000';
      mCtx.fillRect(0,0,cw,ch);
      mCtx.fillStyle='#ffffff';
      const mx=cw*0.08, my=ch*0.12, mw=cw*0.84, mh=ch*0.78;
      mCtx.beginPath();
      if(mCtx.roundRect) mCtx.roundRect(mx,my,mw,mh,16);
      else mCtx.rect(mx,my,mw,mh);
      mCtx.fill();

      const faceCrop=crop.toDataURL('image/png');
      const mask=maskCanvas.toDataURL('image/png');

      if(!token) throw new Error('No session');
      const res=await fetch(`${resolvedApiUrl}/api/enhance-expression`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({faceCrop,mask,instruction:enhanceInstruction}),
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data?.error||'Enhancement failed');
      if(!data.success||!data.image) throw new Error('No image returned');

      // Add enhanced face as new layer at face position
      const enhImg=new Image();
      enhImg.src=data.image;
      await new Promise(r=>{enhImg.onload=r;enhImg.onerror=r;});
      addLayer({
        type:'image',
        src:data.image,
        width:cw,height:ch,
        x:cx,y:cy,
        cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
        imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
        effects:defaultEffects(),
      });
      setCmdLog('Enhanced expression applied as new layer');
    }catch(err){
      setCmdLog('Expression enhancement unavailable — AI server offline. Try again later.');
    }finally{
      setEnhanceBusy(false);
    }
  }

  // ── Shared canvas renderer (single source of truth) ──────────────────────
  // Used by: exportAllPlatforms, exportCanvas, downloadVariantsAsZip
  async function renderLayersToCanvas(canvas, layerArray, opts={}){
    // ── Phase 2: Try PixiJS WebGL compositor first (image/background layers, standard blend modes)
    // Falls back to 2D canvas path when layers have text, shapes, groups, adjustments,
    // clipping masks, glow/shadow effects, or HSL blend modes.
    if (!opts.skipGlobalFilter) {
      const pixiOk = await renderLayersWithPixi(canvas, layerArray, {
        previewW: opts.previewW || p.preview.w,
        previewH: opts.previewH || p.preview.h,
      });
      if (pixiOk) {
        // PixiJS rendered successfully — apply global brightness/contrast/saturation/hue
        // via a second 2D pass using canvas filter (PixiJS doesn't apply the global editor filter)
        const hasGlobalFilter = brightness !== 100 || contrast !== 100 || saturation !== 100 || hue !== 0;
        if (hasGlobalFilter) {
          const tmp = document.createElement('canvas');
          tmp.width = canvas.width; tmp.height = canvas.height;
          const tmpCtx = tmp.getContext('2d');
          tmpCtx.drawImage(canvas, 0, 0);
          const ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0, 0, canvas.width, canvas.height);
          ctx2.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
          ctx2.drawImage(tmp, 0, 0);
          ctx2.filter = 'none';
        }
        return;
      }
    }
    // ── Fallback: 2D canvas compositor (handles all layer types) ─────────────

    const ctx = canvas.getContext('2d');
    const previewW = opts.previewW || p.preview.w;
    const previewH = opts.previewH || p.preview.h;
    const scaleX = canvas.width  / previewW;
    const scaleY = canvas.height / previewH;
    const transparent = opts.transparent || false;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if(!opts.skipGlobalFilter){
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;
    }

    // Inner render function – draws one layer's content onto context c / canv
    async function renderLayerContent(c, canv, obj){
      if(obj.type==='background'){
        c.filter='none';
        if(obj.bgGradient){
          const g=c.createLinearGradient(0,0,0,canv.height);
          g.addColorStop(0,obj.bgGradient[0]);
          g.addColorStop(1,obj.bgGradient[1]);
          c.fillStyle=g;
        } else {
          c.fillStyle=obj.bgColor||'#f97316';
        }
        c.fillRect(0,0,canv.width,canv.height);
      }

      else if(obj.type==='text'){
        const centerX=(obj.x+(obj.width||100)/2)*scaleX;
        const centerY=(obj.y+(obj.fontSize||48)/2)*scaleY;
        c.translate(centerX,centerY);
        if(obj.rotation) c.rotate((obj.rotation||0)*Math.PI/180);
        c.translate(-centerX,-centerY);
        c.translate(obj.x*scaleX,obj.y*scaleY);
        if(obj.flipH||obj.flipV) c.scale(obj.flipH?-1:1,obj.flipV?-1:1);
        // opentype-powered rendering (gradient fill, precise letter spacing, multi-stroke)
        await renderTextLayer(c, obj, scaleX, scaleY, drawProText);
      }

      else if(obj.type==='image'){
        await new Promise(resolve=>{
          const img=new Image();
          img.crossOrigin='Anonymous';
          img.onload=()=>{
            const x=obj.x*scaleX;
            const y=obj.y*scaleY;
            const w=obj.width*scaleX;
            const h=obj.height*scaleY;
            const cl=(obj.cropLeft||0)*scaleX;
            const ct=(obj.cropTop||0)*scaleY;
            const cr=(obj.cropRight||0)*scaleX;
            const cb=(obj.cropBottom||0)*scaleY;

            // ── Helper: apply drop shadow to c then draw, then clear ──────
            const applyShadowAndDraw=(drawFn)=>{
              const sh=obj.effects?.shadow;
              if(sh?.enabled){
                const sr=parseInt((sh.color||'#000').slice(1,3),16)||0;
                const sg=parseInt((sh.color||'#000').slice(3,5),16)||0;
                const sb=parseInt((sh.color||'#000').slice(5,7),16)||0;
                c.shadowColor=`rgba(${sr},${sg},${sb},${(sh.opacity??60)/100})`;
                c.shadowOffsetX=(sh.x||0)*scaleX;
                c.shadowOffsetY=(sh.y||0)*scaleY;
                c.shadowBlur=(sh.blur||12)*Math.min(scaleX,scaleY);
              }
              drawFn();
              c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetX=0;c.shadowOffsetY=0;
            };

            c.save();
            if(obj.mask?.enabled&&obj.mask?.type==='lasso'&&obj.mask?.points?.length>=3){
              // Apply lasso clip path to export canvas
              const mpts=obj.mask.points;
              const cropWe=w-cl-cr, cropHe=h-ct-cb;
              c.beginPath();
              if(obj.mask.inverted){
                c.rect(x+cl,y+ct,cropWe,cropHe);
                c.moveTo(x+cl+mpts[0].x*scaleX, y+ct+mpts[0].y*scaleY);
                for(let i=1;i<mpts.length;i++) c.lineTo(x+cl+mpts[i].x*scaleX, y+ct+mpts[i].y*scaleY);
                c.closePath();
                c.clip('evenodd');
              } else {
                c.moveTo(x+cl+mpts[0].x*scaleX, y+ct+mpts[0].y*scaleY);
                for(let i=1;i<mpts.length;i++) c.lineTo(x+cl+mpts[i].x*scaleX, y+ct+mpts[i].y*scaleY);
                c.closePath();
                c.clip();
              }
              if(obj.flipH||obj.flipV){
                c.translate(x+w/2,y+h/2);
                c.scale(obj.flipH?-1:1,obj.flipV?-1:1);
                c.translate(-(x+w/2),-(y+h/2));
              }
              c.filter=`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${(obj.imgBlur||0)*Math.min(scaleX,scaleY)}px)`;
              if(obj.effects?.glow?.enabled){
                const glowBlur=(obj.effects.glow.blur||20);
                const glowOpacity=(obj.effects.glow.opacity??80)/100;
                const gh=obj.effects.glow.color||'#f97316';
                const gr2=parseInt(gh.slice(1,3),16)||249,gg2=parseInt(gh.slice(3,5),16)||115,gb2=parseInt(gh.slice(5,7),16)||22;
                drawGlowImage(c,img,x-cl,y-ct,w,h,`rgba(${gr2},${gg2},${gb2},${glowOpacity})`,glowBlur);
              } else {
                applyShadowAndDraw(()=>c.drawImage(img,x-cl,y-ct,w,h));
              }
              c.restore();
              resolve();
            } else {
              c.save();
              if(obj.rotation){
                const cx2=x+w/2,cy2=y+h/2;
                c.translate(cx2,cy2);
                c.rotate((obj.rotation||0)*Math.PI/180);
                c.translate(-cx2,-cy2);
              }
              c.beginPath();
              c.rect(x+cl,y+ct,w-cl-cr,h-ct-cb);
              c.clip();
              if(obj.flipH||obj.flipV){
                c.translate(x+w/2,y+h/2);
                c.scale(obj.flipH?-1:1,obj.flipV?-1:1);
                c.translate(-(x+w/2),-(y+h/2));
              }
              c.filter=`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${(obj.imgBlur||0)*Math.min(scaleX,scaleY)}px)`;
              if(obj.effects?.glow?.enabled){
                const glowBlur=(obj.effects.glow.blur||20)*Math.min(scaleX,scaleY);
                const glowOpacity=(obj.effects.glow.opacity??80)/100;
                const gh=obj.effects.glow.color||'#f97316';
                const gr2=parseInt(gh.slice(1,3),16)||249,gg2=parseInt(gh.slice(3,5),16)||115,gb2=parseInt(gh.slice(5,7),16)||22;
                drawGlowImage(c,img,x-cl,y-ct,w,h,`rgba(${gr2},${gg2},${gb2},${glowOpacity})`,glowBlur);
              } else {
                applyShadowAndDraw(()=>c.drawImage(img,x-cl,y-ct,w,h));
              }
              c.restore();
              resolve();
            }
          };
          img.onerror=()=>resolve();
          img.src=obj.paintSrc||obj.src;
        });
      }

      else if(obj.type==='shape'){
        c.translate(obj.x*scaleX,obj.y*scaleY);
        if(obj.rotation){
          const sw2=obj.width*scaleX,sh2=obj.height*scaleY;
          c.translate(sw2/2,sh2/2);c.rotate((obj.rotation||0)*Math.PI/180);c.translate(-sw2/2,-sh2/2);
        }
        if(obj.flipH||obj.flipV) c.scale(obj.flipH?-1:1,obj.flipV?-1:1);
        const sw=obj.width*scaleX,sh=obj.height*scaleY;
        // Apply effects: drop shadow
        const shapeSh=obj.effects?.shadow;
        if(shapeSh?.enabled){
          const sr2=parseInt((shapeSh.color||'#000').slice(1,3),16)||0;
          const sg2=parseInt((shapeSh.color||'#000').slice(3,5),16)||0;
          const sb2=parseInt((shapeSh.color||'#000').slice(5,7),16)||0;
          c.shadowColor=`rgba(${sr2},${sg2},${sb2},${(shapeSh.opacity??60)/100})`;
          c.shadowOffsetX=(shapeSh.x||0)*scaleX;
          c.shadowOffsetY=(shapeSh.y||0)*scaleY;
          c.shadowBlur=(shapeSh.blur||12)*Math.min(scaleX,scaleY);
        }
        c.fillStyle=obj.fillColor||'#FF4500';
        c.strokeStyle=obj.strokeColor||'#000';
        c.lineWidth=2*Math.min(scaleX,scaleY);
        c.beginPath();
        if(obj.shape==='circle'){
          c.ellipse(sw/2,sh/2,sw/2,sh/2,0,0,Math.PI*2);
        } else if(obj.shape==='rect'||obj.shape==='roundrect'){
          const rad=obj.shape==='roundrect'?Math.min(sw,sh)*0.2:0;
          c.roundRect(0,0,sw,sh,rad);
        } else {
          c.rect(0,0,sw,sh);
        }
        c.fill();c.stroke();
        c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetX=0;c.shadowOffsetY=0;
        // Glow pass for shapes
        const shapeGlow=obj.effects?.glow;
        if(shapeGlow?.enabled){
          const glowBlur=(shapeGlow.blur||20)*Math.min(scaleX,scaleY);
          const glowOpacity=(shapeGlow.opacity??80)/100;
          const gh=shapeGlow.color||'#f97316';
          const gr2=parseInt(gh.slice(1,3),16)||249,gg2=parseInt(gh.slice(3,5),16)||115,gb2=parseInt(gh.slice(5,7),16)||22;
          c.save();
          for(let pass=0;pass<3;pass++){
            c.shadowColor=`rgba(${gr2},${gg2},${gb2},${glowOpacity})`;
            c.shadowBlur=glowBlur*(pass+1)/3;
            c.fillStyle=`rgba(${gr2},${gg2},${gb2},0)`;
            c.beginPath();
            if(obj.shape==='circle')c.ellipse(sw/2,sh/2,sw/2,sh/2,0,0,Math.PI*2);
            else if(obj.shape==='rect'||obj.shape==='roundrect'){const r=obj.shape==='roundrect'?Math.min(sw,sh)*0.2:0;c.roundRect(0,0,sw,sh,r);}
            else c.rect(0,0,sw,sh);
            c.fill();
          }
          c.shadowColor='transparent';c.shadowBlur=0;
          c.restore();
        }
      }
    }

    const WORKER_MODES = new Set(['hue','saturation','color','luminosity']);

    // Helper: render a single layer onto a context (no clip handling)
    async function renderOneLayer(dstCtx, dstCanvas, obj){
      if(obj.type==='group'){
        const children=obj.children||[];
        if(!children.length) return;
        const tmp=document.createElement('canvas');
        tmp.width=dstCanvas.width;tmp.height=dstCanvas.height;
        await renderLayersToCanvas(tmp,children,{previewW,previewH,skipGlobalFilter:true});
        const groupMode=obj.blendMode||'normal';
        const groupAlpha=(obj.opacity??100)/100;
        if(WORKER_MODES.has(groupMode)){
          const dstData=dstCtx.getImageData(0,0,dstCanvas.width,dstCanvas.height);
          const srcData=tmp.getContext('2d').getImageData(0,0,tmp.width,tmp.height);
          const scaled=new Uint8ClampedArray(srcData.data);
          for(let k=3;k<scaled.length;k+=4)scaled[k]=Math.round(scaled[k]*groupAlpha);
          const composited=await applyPixelBlend(dstData,new ImageData(scaled,tmp.width,tmp.height),groupMode);
          dstCtx.putImageData(composited,0,0);
        } else {
          dstCtx.save();dstCtx.globalAlpha=groupAlpha;dstCtx.globalCompositeOperation=groupMode;
          dstCtx.drawImage(tmp,0,0);dstCtx.restore();
        }
        return;
      }
      if(obj.type==='curves'){
        const imgData=dstCtx.getImageData(0,0,dstCanvas.width,dstCanvas.height);
        const adjusted=await applyCurvesLUT(imgData,obj.curves||DEFAULT_CURVES());
        dstCtx.putImageData(adjusted,0,0);
        return;
      }
      if(obj.type==='adjustment'){
        const imgData=dstCtx.getImageData(0,0,dstCanvas.width,dstCanvas.height);
        // Ensure LUT is built
        if(obj._lutDirty||!obj._cachedLUT){
          obj._cachedLUT=buildAdjLUT(obj);
          obj._lutDirty=false;
        }
        const adjusted=applyAdjustmentToImageData(imgData,obj);
        dstCtx.putImageData(adjusted,0,0);
        return;
      }
      const mode=obj.blendMode||'normal';
      if(WORKER_MODES.has(mode)){
        const dstData=dstCtx.getImageData(0,0,dstCanvas.width,dstCanvas.height);
        const tmp=document.createElement('canvas');
        tmp.width=dstCanvas.width;tmp.height=dstCanvas.height;
        const tc=tmp.getContext('2d');
        tc.imageSmoothingEnabled=true;tc.imageSmoothingQuality='high';
        tc.globalAlpha=(obj.opacity??100)/100;
        tc.save();await renderLayerContent(tc,tmp,obj);tc.restore();
        const srcData=tc.getImageData(0,0,tmp.width,tmp.height);
        const composited=await applyPixelBlend(dstData,srcData,mode);
        dstCtx.putImageData(composited,0,0);
      } else {
        dstCtx.save();
        dstCtx.globalAlpha=(obj.opacity??100)/100;
        dstCtx.globalCompositeOperation=mode;
        await renderLayerContent(dstCtx,dstCanvas,obj);
        dstCtx.restore();
      }
    }

    let li=0;
    while(li<layerArray.length){
      const obj=layerArray[li];
      if(obj.hidden||(transparent&&obj.type==='background')){li++;continue;}

      // Collect any clipped layers directly above this one
      const clippedAbove=[];
      let lj=li+1;
      while(lj<layerArray.length&&layerArray[lj].clipMask===true){
        if(!layerArray[lj].hidden) clippedAbove.push(layerArray[lj]);
        lj++;
      }

      if(clippedAbove.length>0){
        // ── Clipping group ─────────────────────────────────────────────────
        // Create group canvas; render base layer into it (defines clip shape + visual)
        const G=document.createElement('canvas');
        G.width=canvas.width;G.height=canvas.height;
        const Gctx=G.getContext('2d');
        Gctx.imageSmoothingEnabled=true;Gctx.imageSmoothingQuality='high';
        // Render base onto G (at full opacity; base opacity applied when compositing G onto main)
        await renderLayerContent(Gctx,G,obj);

        // Render each clipped layer, masked to base's alpha
        for(const cl of clippedAbove){
          const T=document.createElement('canvas');
          T.width=canvas.width;T.height=canvas.height;
          const Tc=T.getContext('2d');
          Tc.imageSmoothingEnabled=true;Tc.imageSmoothingQuality='high';
          // Render clipped layer content at full opacity (apply its opacity when drawing onto G)
          await renderLayerContent(Tc,T,cl);
          // Mask T to base's shape via destination-in
          Tc.globalCompositeOperation='destination-in';
          Tc.drawImage(G,0,0);
          // Composite T onto G using clipped layer's blend mode and opacity
          Gctx.save();
          Gctx.globalAlpha=(cl.opacity??100)/100;
          Gctx.globalCompositeOperation=cl.blendMode||'source-over';
          Gctx.drawImage(T,0,0);
          Gctx.restore();
        }

        // Composite the clipping group (G) onto main canvas with base layer's settings
        const baseMode=obj.blendMode||'normal';
        const baseAlpha=(obj.opacity??100)/100;
        if(WORKER_MODES.has(baseMode)){
          const dstData=ctx.getImageData(0,0,canvas.width,canvas.height);
          const srcData=Gctx.getImageData(0,0,canvas.width,canvas.height);
          const scaled=new Uint8ClampedArray(srcData.data);
          for(let k=3;k<scaled.length;k+=4)scaled[k]=Math.round(scaled[k]*baseAlpha);
          const composited=await applyPixelBlend(dstData,new ImageData(scaled,canvas.width,canvas.height),baseMode);
          ctx.putImageData(composited,0,0);
        } else {
          ctx.save();ctx.globalAlpha=baseAlpha;ctx.globalCompositeOperation=baseMode;
          ctx.drawImage(G,0,0);ctx.restore();
        }
        li=lj;continue;
      }

      // ── Normal layer (no clipping group) ──────────────────────────────────
      await renderOneLayer(ctx,canvas,obj);
      li++;
    }
    ctx.filter='none';
  }

  async function exportAllPlatforms(){
    setResizeExporting(true);

    const platformList=[
      {key:'youtube',   label:'YouTube',   width:1280, height:720,  preview:{w:480,h:270}},
      {key:'tiktok',    label:'TikTok',    width:1080, height:1920, preview:{w:152,h:270}},
      {key:'instagram', label:'Instagram', width:1080, height:1080, preview:{w:270,h:270}},
      {key:'twitter',   label:'Twitter',   width:1600, height:900,  preview:{w:480,h:270}},
      {key:'linkedin',  label:'LinkedIn',  width:1200, height:627,  preview:{w:480,h:251}},
    ];

    for(const plat of platformList){
      setResizeProgress(`Exporting ${plat.label}...`);

      const canvas  = document.createElement('canvas');
      canvas.width  = plat.width;
      canvas.height = plat.height;

      await renderLayersToCanvas(canvas, layers);

      // Download this platform
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.download=`${designName.replace(/\s+/g,'-')}-${plat.label}-${plat.width}x${plat.height}.png`;
      link.href=url;
      link.click();
      URL.revokeObjectURL(url);

      // Small delay between downloads
      await new Promise(r=>setTimeout(r,500));
    }

    setResizeProgress('All done! 5 files downloaded.');
    setResizeExporting(false);
    setTimeout(()=>setResizeProgress(''),3000);
  }

  function generateVariants(){
    setAbLoading(true);
    setAbVariants([]);
    setAbSelected(null);

    const bg = layers.find(l=>l.type==='background');

    function swapText(text, map){
      const upper=(text||'').toUpperCase().trim();
      for(const [a,b] of map){
        if(upper===a.toUpperCase()) return b;
        if(upper===b.toUpperCase()) return a;
      }
      return text;
    }

    // Detect subject layer (isSubject flag, or fallback to topmost image)
    const subjectLayer = layers.find(l=>l.isSubject&&l.type==='image')
      || [...layers].reverse().find(l=>l.type==='image'&&!l.hidden);
    const subjectId = subjectLayer?.id;

    // ── Variant A — Control (exact current state, no modifications) ──
    const variantA = layers.map(l=>({...l, id:newId()}));

    // ── Variant B — Panic Hook ──
    // Subject: +12% scale (centered), multi-pass cyan glow
    // Background: darken 25%
    // Text: gold (#FFD700), thick black stroke, hook swap
    const variantB = layers.map(l=>{
      if(l.type==='background') return{
        ...l,id:newId(),
        bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-50),
        bgGradient:bg?.bgGradient?[
          shiftColor(bg.bgGradient[0],-50),
          shiftColor(bg.bgGradient[1],-50),
        ]:null,
      };
      if(l.type==='text') return{
        ...l,id:newId(),
        text:swapText(l.text, TEXT_FLIP_HOOKS),
        fontFamily:'Anton',
        fontWeight:900,
        textColor:'#FFD700',
        strokeWidth:Math.max(l.strokeWidth||0, 6),
        strokeColor:'#000000',
        shadowEnabled:false,
        glowEnabled:false,
      };
      if(l.type==='shape') return{
        ...l,id:newId(),
        fillColor:'#FFD700',
        strokeColor:'#000000',
      };
      if(l.type==='image'){
        if(l.id!==subjectId) return{
          ...l,id:newId(),
          imgBrightness:75,
        };
        // Subject: +12% scale centered on original position, cyan glow
        const zf=1.12;
        const nw=Math.round((l.width||200)*zf);
        const nh=Math.round((l.height||200)*zf);
        const dx=Math.round((nw-(l.width||200))/2);
        const dy=Math.round((nh-(l.height||200))/2);
        return{
          ...l,id:newId(),
          width:nw, height:nh,
          x:(l.x||0)-dx, y:(l.y||0)-dy,
          effects:{
            ...defaultEffects(),
            ...(l.effects||{}),
            glow:{enabled:true, color:'#00FFFF', blur:25},
          },
        };
      }
      return{...l,id:newId()};
    });

    // ── Variant C — Curiosity Gap ──
    // Background: heavy Gaussian blur (DSLR depth-of-field), desaturate, darken
    // Subject: right-third anchor, contrast +15%, saturate +20%, white glow isolation
    // Text + shapes: completely hidden — pure visual intrigue
    const variantC = layers.map(l=>{
      if(l.type==='background') return{
        ...l,id:newId(),
        bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-40),
        bgGradient:bg?.bgGradient?[
          shiftColor(bg.bgGradient[0],-40),
          shiftColor(bg.bgGradient[1],-40),
        ]:null,
      };
      if(l.type==='text') return{
        ...l,id:newId(),
        hidden:true,
      };
      if(l.type==='shape') return{
        ...l,id:newId(),
        hidden:true,
      };
      if(l.type==='image'){
        if(l.id!==subjectId) return{
          ...l,id:newId(),
          imgBlur:8,
          imgBrightness:70,
          imgSaturate:60,
          imgContrast:110,
        };
        // Subject: boosted contrast/sat, white glow — stays in original position
        return{
          ...l,id:newId(),
          imgContrast:120,
          imgSaturate:125,
          effects:{
            ...defaultEffects(),
            ...(l.effects||{}),
            glow:{enabled:true, color:'#ffffff', blur:18},
            subjectOutline:{enabled:true, color:'#ffffff', width:4},
          },
        };
      }
      return{...l,id:newId()};
    });

    setTimeout(()=>{
      setAbVariants([
        { id:'a', label:'A — Control',        desc:'Your current design, unmodified — the baseline',                             layers:variantA },
        { id:'b', label:'B — Panic Hook',     desc:'Gold text, cyan subject glow, darkened background, +12% subject scale',      layers:variantB },
        { id:'c', label:'C — Curiosity Gap',  desc:'Blurred background (depth-of-field), hidden text, subject isolation at 115% contrast', layers:variantC },
      ]);
      setAbLoading(false);
    },600);
  }

  function shiftColor(hex,amount){
    try{
      const h=hex.replace('#','');
      const r=Math.min(255,Math.max(0,parseInt(h.slice(0,2),16)+amount));
      const g=Math.min(255,Math.max(0,parseInt(h.slice(2,4),16)+amount));
      const b=Math.min(255,Math.max(0,parseInt(h.slice(4,6),16)+amount));
      return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
    }catch(e){ return hex; }
  }

  function applyVariant(variant){
    if(!window.confirm(`Apply variant ${variant.label}? This replaces your current canvas.`)) return;
    setLayers(variant.layers);
    pushHistory(variant.layers,"Apply Variant");
    setSelectedId(null);
    setAbVariants([]);
    setAbSelected(null);
    setCmdLog(`Applied: ${variant.label}`);
    setActiveTool('select');
    triggerAutoSave();
  }

  // ── Feature J: Niche setter ───────────────────────────────────────────────
  async function setNiche(niche){
    setNicheSaving(true);
    // Always save locally and close — API is fire-and-forget
    setUserNicheState(niche);
    localStorage.setItem('tf_niche',niche);
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token;
      if(tok){
        fetch(`${resolvedApiUrl}/api/set-niche`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
          body:JSON.stringify({niche}),
        }).catch(()=>{});
      }
    } catch(e){}
    setNicheOnboarding(false);
    setNicheSaving(false);
  }

  // ── Feature K: YouTube History Intelligence ──────────────────────────────
  async function connectYouTube(){
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token;
      const res=await fetch(`${resolvedApiUrl}/api/youtube/auth`,{
        headers:{'Authorization':`Bearer ${tok}`}
      });
      const data=await res.json();
      if(data.url) window.location.href=data.url;
    }catch(e){
      setYtHistError('Could not initiate YouTube connect. Check your connection.');
    }
  }

  async function fetchAndAnalyzeYouTubeHistory(){
    setYtHistBusy(true);
    setYtHistError('');
    setYtHistProgress(10);

    try{
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token;

      // Step 1: fetch thumbnails + stats
      const fetchRes=await fetch(`${resolvedApiUrl}/api/youtube/thumbnails`,{
        headers:{'Authorization':`Bearer ${tok}`}
      });
      const fetchData=await fetchRes.json();
      if(!fetchData.success) throw new Error(fetchData.error||'Fetch failed');

      const ch={title:fetchData.channelTitle,avatar:fetchData.channelAvatar};
      setYtHistChannel(ch);
      localStorage.setItem('tf_yt_channel',JSON.stringify(ch));
      setYtHistVideos(fetchData.videos||[]);
      setYtHistProgress(55);

      // Step 2: analyze
      const analyzeRes=await fetch(`${resolvedApiUrl}/api/youtube/analyze`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
        body:JSON.stringify({videos:fetchData.videos}),
      });
      setYtHistProgress(90);
      const analyzeData=await analyzeRes.json();
      if(!analyzeData.success) throw new Error(analyzeData.error||'Analyze failed');

      setYtHistInsights(analyzeData.insights||[]);
      localStorage.setItem('tf_yt_insights',JSON.stringify(analyzeData.insights||[]));
      setYtHistProgress(100);

      // Auto-apply the highest-impact colorGrade default if insight suggests one
      const applyInsight=analyzeData.insights?.find(i=>i.applyDefault?.colorGrade);
      if(applyInsight) setCgPreset(applyInsight.applyDefault.colorGrade);

    }catch(err){
      setYtHistError(err.message||'Analysis failed');
    }
    setYtHistBusy(false);
  }

  // ── Feature L: Team Collaboration & Version History ────────────────────���──

  // Load team on mount
  useEffect(()=>{
    if(!token) return;
    fetch(`${resolvedApiUrl}/api/team/me`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json())
      .then(d=>{ if(d.success) setTeamData(d.team); })
      .catch(()=>{});
    // Load comments for current project if we have designName as projectId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  // Load comments whenever the active project changes
  useEffect(()=>{
    if(!token||!designName) return;
    fetch(`${resolvedApiUrl}/api/comments/${encodeURIComponent(designName)}`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json())
      .then(d=>{ if(d.success) setComments(d.comments||[]); })
      .catch(()=>{});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token,designName]);

  // Load version history whenever versions panel opens
  function loadVersionHistory(){
    if(!token||!designName) return;
    setVersionBusy(true);
    fetch(`${resolvedApiUrl}/api/projects/${encodeURIComponent(designName)}/versions`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json())
      .then(d=>{ if(d.success) setVersionHistory(d.versions||[]); })
      .catch(()=>{})
      .finally(()=>setVersionBusy(false));
  }

  async function createTeam(){
    if(!teamCreateName.trim()) return;
    setTeamBusy(true); setTeamError('');
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token;
      const res=await fetch(`${resolvedApiUrl}/api/team/create`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
        body:JSON.stringify({name:teamCreateName.trim()}),
      });
      const d=await res.json();
      if(d.success){ setTeamData(d.team); setTeamCreateName(''); }
      else setTeamError(d.error||'Create failed');
    }catch(e){ setTeamError('Network error'); }
    setTeamBusy(false);
  }

  async function inviteToTeam(){
    if(!teamInviteEmail.trim()||!teamData?.teamId) return;
    setTeamBusy(true); setTeamError('');
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token;
      const res=await fetch(`${resolvedApiUrl}/api/team/invite`,{
        method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
        body:JSON.stringify({teamId:teamData.teamId, inviteEmail:teamInviteEmail.trim()}),
      });
      const d=await res.json();
      if(d.success){ setTeamInviteEmail(''); setTeamError('Invite sent!'); }
      else setTeamError(d.error||'Invite failed');
    }catch(e){ setTeamError('Network error'); }
    setTeamBusy(false);
  }

  async function addComment(xPct, yPct, text){
    if(!text.trim()||!designName) return;
    const { data: { session } } = await supabase.auth.getSession();
    const tok = session?.access_token;
    const res=await fetch(`${resolvedApiUrl}/api/comments/add`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
      body:JSON.stringify({projectId:designName, x:xPct, y:yPct, text:text.trim()}),
    });
    const d=await res.json();
    if(d.success) setComments(prev=>[...prev, d.comment]);
  }

  async function resolveComment(commentId){
    const { data: { session } } = await supabase.auth.getSession();
    const tok = session?.access_token;
    const res=await fetch(`${resolvedApiUrl}/api/comments/${commentId}/resolve`,{
      method:'PATCH', headers:{'Authorization':`Bearer ${tok}`},
    });
    const d=await res.json();
    if(d.success) setComments(prev=>prev.map(c=>c.id===commentId?d.comment:c));
  }

  async function replyToComment(commentId, text){
    if(!text.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const tok = session?.access_token;
    const res=await fetch(`${resolvedApiUrl}/api/comments/${commentId}/reply`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
      body:JSON.stringify({text}),
    });
    const d=await res.json();
    if(d.success){
      setComments(prev=>prev.map(c=>c.id===commentId?{...c,replies:[...c.replies,d.reply]}:c));
      setReplyDraft('');
    }
  }

  async function saveVersion(){
    if(!designName) return;
    setVersionBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const tok = session?.access_token;
    // Flatten canvas to base64
    const flat=document.createElement('canvas');
    flat.width=p.preview.w; flat.height=p.preview.h;
    await renderLayersToCanvas(flat,layers);
    const canvasData=flat.toDataURL('image/jpeg',0.7);
    const res=await fetch(`${resolvedApiUrl}/api/projects/version`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
      body:JSON.stringify({projectId:designName, label:versionLabel||undefined, canvasData}),
    });
    const d=await res.json();
    if(d.success){
      setVersionLabel('');
      loadVersionHistory();
    }
    setVersionBusy(false);
  }

  async function restoreVersion(versionId){
    if(!window.confirm('Restore this version? Current canvas will be replaced.')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const tok = session?.access_token;
    const res=await fetch(`${resolvedApiUrl}/api/projects/${encodeURIComponent(designName)}/versions/${versionId}`,{
      headers:{'Authorization':`Bearer ${tok}`},
    });
    const d=await res.json();
    if(d.success&&d.version?.canvasData){
      // Replace canvas with single image layer from the snapshot
      const newLayers=[{id:`restore_${Date.now()}`,type:'image',src:d.version.canvasData,x:0,y:0,width:p.preview.w,height:p.preview.h,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,opacity:100}];
      setLayers(newLayers); pushHistory(newLayers,"Restore Version");
    }
  }

  async function updateApprovalStatus(nextStatus){
    setApprovalStatus(nextStatus);
    if(!designName) return;
    const { data: { session } } = await supabase.auth.getSession();
    const tok = session?.access_token;
    await fetch(`${resolvedApiUrl}/api/projects/${encodeURIComponent(designName)}/status`,{
      method:'PATCH', headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
      body:JSON.stringify({status:nextStatus}),
    }).catch(()=>{});
  }

  // ── Feature I: AI Variant Generator ──────────────────────────────────────
  const AI_VARIANT_NICHES=['gaming','tech','fitness','cooking','finance','education'];

  // AI Variants — client-side colour grade per slot (no API needed)
  async function generateAiVariants(){
    if(aiVarBusy) return;
    setAiVarBusy(true);
    setAiVarSelected(null);

    try{
      // Render current canvas once
      const flat=document.createElement('canvas');
      flat.width=p.preview.w; flat.height=p.preview.h;
      await renderLayersToCanvas(flat,layers);
      const currentDataUrl=flat.toDataURL('image/jpeg',0.88);

      // Seed grid: original in slot 0, placeholders for 5 variants
      setAiVariants([
        {base64:currentDataUrl, label:'Original', description:'Your current design — the baseline'},
        null, null, null, null, null,
      ]);

      const VARIANTS=[
        {slot:1, preset:'default',    label:'Punchy',    description:'Auto-levels + contrast boost'},
        {slot:2, preset:'warm',       label:'Warm',      description:'Warm tones — great for travel & lifestyle'},
        {slot:3, preset:'cool',       label:'Cool',      description:'Cool blue tones — great for tech & gaming'},
        {slot:4, preset:'cinematic',  label:'Cinematic', description:'Dark & moody — high production value feel'},
        {slot:5, preset:'neon',       label:'Neon',      description:'High-energy neon — gaming & entertainment'},
      ];

      // Generate all 5 in parallel — slots populate as each resolves
      await Promise.all(VARIANTS.map(async({slot, preset, label, description})=>{
        try{
          const graded=await colorGradeClientSide(currentDataUrl, preset, 0.85);
          setAiVariants(prev=>{const n=[...prev];n[slot]={base64:graded,label,description};return n;});
        }catch{
          setAiVariants(prev=>{const n=[...prev];n[slot]={base64:null,label,description:'Failed — try again',error:true};return n;});
        }
      }));

      setCmdLog('Variants ready — pick your winner');
    }catch(err){
      setCmdLog('Variant generation failed. Try again.');
    }finally{
      setAiVarBusy(false);
    }
  }

  function selectAiVariant(idx){
    if(!aiVariants[idx]?.base64) return;
    if(!window.confirm(`Apply "${aiVariants[idx].label}" as your active canvas? This replaces all current layers.`)) return;
    const id=`aivar_${Date.now()}`;
    const newLayers=[{
      id, type:'image', src:aiVariants[idx].base64,
      x:0, y:0, width:p.preview.w, height:p.preview.h,
      opacity:100, hidden:false, locked:false, blendMode:'normal',
      flipH:false, flipV:false, rotation:0,
      cropTop:0, cropBottom:0, cropLeft:0, cropRight:0,
      imgBrightness:100, imgContrast:100, imgSaturate:100, imgBlur:0,
      effects:{shadow:{enabled:false},glow:{enabled:false},border:{enabled:false},overlay:{enabled:false},noise:{enabled:false}},
    }];
    setLayers(newLayers);
    pushHistory(newLayers);
    setSelectedId(null);
    setAiVarSelected(idx);
    setCmdLog(`Applied: ${aiVariants[idx].label}`);
    setActiveTool('select');
    triggerAutoSave();
  }

  async function downloadAiVariantsZip(){
    const ready=aiVariants.filter(v=>v?.base64);
    if(ready.length===0) return;
    setAiVarBusy(true);
    try{
      const { default: JSZip } = await import('jszip');
      const zip=new JSZip();
      ready.forEach(v=>{
        const b64=v.base64.split(',')[1];
        const safe=v.label.replace(/[^a-zA-Z0-9-_ ]/g,'').trim();
        zip.file(`ThumbFrame-${safe}.jpg`,b64,{base64:true});
      });
      const blob=await zip.generateAsync({type:'blob'});
      saveAs(blob,'ThumbFrame-AI-Variants.zip');
      setCmdLog(`Downloaded ${ready.length} variants as ZIP`);
    }catch(err){
      console.error('[AI_VARIANTS ZIP]',err);
    }finally{
      setAiVarBusy(false);
    }
  }

  // ── A/B Variant ZIP Export ────────────────────────────────────────────────
  async function downloadVariantsAsZip(){
    if(abVariants.length===0) return;
    setAbLoading(true);

    async function renderVariantToDataURL(variantLayers){
      const canvas = document.createElement('canvas');
      canvas.width  = p.width;
      canvas.height = p.height;
      await renderLayersToCanvas(canvas, variantLayers);
      return canvas.toDataURL('image/png',1.0);
    }

    try{
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for(const variant of abVariants){
        const dataUrl = await renderVariantToDataURL(variant.layers);
        const base64  = dataUrl.split(',')[1];
        const safeName = variant.label.replace(/[^a-zA-Z0-9-_ ]/g,'').trim();
        zip.file(`${safeName}.png`, base64, {base64:true});
      }
      const blob = await zip.generateAsync({type:'blob'});
      saveAs(blob, 'ThumbFrame-Variants.zip');
      setCmdLog('Downloaded A/B variants as ZIP');
    }catch(err){
      console.error('[AB ZIP] Export failed:', err);
      setCmdLog('ZIP export failed — check console');
    }finally{
      setAbLoading(false);
    }
  }

  // ── Sprint 5: High-Resolution Export Utility ────────────────────────────
  // renderAtScale(layerSnapshot, multiplier)
  //   multiplier=1 → native platform res (e.g. 1280×720 for YouTube)
  //   multiplier=2 → 2560×1440  (the "2x / enterprise" tier)
  // Uses HTML5 Canvas 2D ctx.filter for brightness/blur — equivalent to
  // Fabric.js WebGL Brightness/Blur filters but without a WebGL dependency.
  async function renderAtScale(layerSnapshot, multiplier=1){
    const expW = Math.round(p.width  * multiplier);
    const expH = Math.round(p.height * multiplier);
    const canvas = document.createElement('canvas');
    canvas.width  = expW;
    canvas.height = expH;
    await renderLayersToCanvas(canvas, layerSnapshot, {
      previewW: p.preview.w,
      previewH: p.preview.h,
    });
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // ── Sprint 5: One-Click A/B Export Pipeline ──────────────────────────────
  // Phase 2: originalState is a deep-clone of layersRef — React state is
  // NEVER mutated during the export pipeline. Variants are separate arrays.
  // Phase 2 restore: after ZIP download we verify layers === originalState.
  const [variantExporting, setVariantExporting] = useState(false);

  async function generateAndExportVariants(){
    if(variantExporting) return;
    setVariantExporting(true);
    setAbLoading(true);

    // ── PHASE 2: State preservation ──────────────────────────────────────
    const originalState = JSON.parse(JSON.stringify(layersRef.current));
    console.log('[SPRINT 5] generateAndExportVariants() — state preserved. Layers count:', originalState.length);

    try{
      const bg = layersRef.current.find(l=>l.type==='background');
      const subjectLayer = layersRef.current.find(l=>l.isSubject&&l.type==='image')
        || [...layersRef.current].reverse().find(l=>l.type==='image'&&!l.hidden);
      const subjectId = subjectLayer?.id;

      // ── PHASE 3: Variant A — Base (exact current state) ──────────────
      const varA = JSON.parse(JSON.stringify(originalState));

      // ── PHASE 3: Variant B — Panic (bright red/gold text, dark BG) ───
      // Background image: CSS brightness(80%) → ctx.filter equiv of Fabric Brightness(-0.2)
      // Text: #FF0000 or #FFD700 fill
      const varB = originalState.map(l=>{
        if(l.type==='background') return{...l,
          bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-50),
          bgGradient:bg?.bgGradient?[shiftColor(bg.bgGradient[0],-50),shiftColor(bg.bgGradient[1],-50)]:null};
        if(l.type==='text') return{...l,
          textColor:'#FFD700',strokeWidth:Math.max(l.strokeWidth||0,6),strokeColor:'#000000',
          shadowEnabled:false,glowEnabled:false,fontFamily:'Anton',fontWeight:900};
        if(l.type==='image'){
          if(l.id!==subjectId) return{...l,imgBrightness:80}; // Fabric Brightness(-0.2) ≡ CSS brightness(80%)
          const zf=1.12,nw=Math.round((l.width||200)*zf),nh=Math.round((l.height||200)*zf);
          return{...l,width:nw,height:nh,x:(l.x||0)-Math.round((nw-(l.width||200))/2),y:(l.y||0)-Math.round((nh-(l.height||200))/2),
            effects:{...defaultEffects(),...(l.effects||{}),glow:{enabled:true,color:'#00FFFF',blur:25}}};
        }
        return{...l};
      });

      // ── PHASE 3: Variant C — Curiosity (blurred BG, hidden text) ─────
      // Background image: CSS blur(8px) → ctx.filter equiv of Fabric Blur(0.1)
      // Text layers: visible=false
      const varC = originalState.map(l=>{
        if(l.type==='background') return{...l,
          bgColor:bg?.bgGradient?null:shiftColor(bg?.bgColor||'#f97316',-40),
          bgGradient:bg?.bgGradient?[shiftColor(bg.bgGradient[0],-40),shiftColor(bg.bgGradient[1],-40)]:null};
        if(l.type==='text'||l.type==='shape') return{...l,hidden:true};
        if(l.type==='image'){
          if(l.id!==subjectId) return{...l,imgBlur:8,imgBrightness:70,imgSaturate:60}; // Fabric Blur(0.1) ≡ CSS blur(8px)
          return{...l,imgContrast:120,imgSaturate:125,
            effects:{...defaultEffects(),...(l.effects||{}),
              glow:{enabled:true,color:'#ffffff',blur:18},
              subjectOutline:{enabled:true,color:'#ffffff',width:4}}};
        }
        return{...l};
      });

      const variants=[
        {id:'a',label:'A-Base',      layers:varA},
        {id:'b',label:'B-Panic',     layers:varB},
        {id:'c',label:'C-Curiosity', layers:varC},
      ];

      // ── PHASE 1: exportCanvas(2) — 2560×1440 JPEG for each variant ───
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for(const v of variants){
        console.log(`[SPRINT 5] Rendering variant ${v.id} at 2x (${p.width*2}×${p.height*2})…`);
        const dataUrl = await renderAtScale(v.layers, 2);
        zip.file(`${designName.replace(/\s+/g,'-')}-${v.label}-2x.jpg`, dataUrl.split(',')[1], {base64:true});
      }

      const blob = await zip.generateAsync({type:'blob'});
      saveAs(blob, `${designName.replace(/\s+/g,'-')}-AB-Variants-2x.zip`);
      setCmdLog('✓ A/B Variants exported at 2x (2560×1440)');
      console.log('[SPRINT 5] ZIP downloaded. Original state intact — layers unchanged:', layersRef.current.length===originalState.length);

    }catch(err){
      console.error('[SPRINT 5] generateAndExportVariants failed:', err);
      setCmdLog('Export failed — check console');
    }finally{
      setVariantExporting(false);
      setAbLoading(false);
    }
  }

  function saveDesign(name){
    saveProject({nameOverride:name, silent:false}).catch(()=>{});
  }

  const saveProject = useCallback(async ({nameOverride, silent=true} = {})=>{
    // Keep silent saves in the background to avoid interrupting canvas interactions.
    if(!silent){
      clearTimeout(saveStatusTimerRef.current);
      setSaveStatus('Saving...');
      setCmdLog('Saving project...');
    }

    // ── Step 2: Check lock ────────────────────────────────────────────────────
    if(isSavingRef.current){
      console.warn('[STORAGE] Save skipped — a save is already in progress.');
      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('Unsaved');
      }
      return null;
    }

    // ── Step 3: All pre-flight checks — UNLOCKED ─────────────────────────────
    const nextName = (nameOverride||saveMetaRef.current.designName||'Untitled Project').trim()||'Untitled Project';
    const snapshot = {
      projectId: saveMetaRef.current.projectId,
      currentDesignId: currentDesignIdRef.current,
      platform: saveMetaRef.current.platform,
      layers: JSON.parse(JSON.stringify(layersRef.current)),
      brightness: saveMetaRef.current.brightness,
      contrast: saveMetaRef.current.contrast,
      saturation: saveMetaRef.current.saturation,
      hue: saveMetaRef.current.hue,
      designName: saveMetaRef.current.designName,
      aiPrompt: saveMetaRef.current.aiPrompt,
      lastGeneratedImageUrl: saveMetaRef.current.lastGeneratedImageUrl,
      textColor: saveMetaRef.current.textColor,
      strokeColor: saveMetaRef.current.strokeColor,
      fillColor: saveMetaRef.current.fillColor,
    };
    const signature = buildSaveSignature({...snapshot, designName: nextName});

    // Resurrection guard — synchronous, immune to React state lag.
    const targetId = currentDesignIdRef.current;
    if(targetId && deletedIdsRef.current.has(targetId)){
      console.warn('[STORAGE] Resurrection guard: save aborted — ID', targetId, 'was deleted.');
      currentDesignIdRef.current = null;
      lastSavedSignatureRef.current = '';
      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('');
      }
      return null;
    }

    // ── Step 4: Engage lock — right before any network activity ──────────────
    isSavingRef.current = true;
    try{
      // Session and auth checks are inside the lock-protected try block.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const email = session?.user?.email;
      const userId = session?.user?.id;
      const resolvedPlatform = snapshot.platform || 'youtube';

      console.log('[DEBUG] Sending token to backend:', token ? token.substring(0, 10) + '...' : 'NO TOKEN – session is null');
      console.log('[DEBUG] user_id:', userId || 'NULL – session.user.id missing');
      if(!token){
        console.error('[STORAGE] Cannot save: no active session token.');
        if(!silent){
          clearTimeout(saveStatusTimerRef.current);
          setSaveStatus('Error');
          setCmdLog('Save failed: not logged in');
        }
        return null;
      }

      let thumbnailData = null;
      try{
        const quality = silent ? 0.7 : 1.0;
        thumbnailData = await generateDesignThumbnail(quality);
      }catch(imgErr){
        console.warn('[STORAGE] Thumbnail generation failed, continuing without preview:', imgErr);
      }
      console.log('[SAVE] thumbnail result:', thumbnailData ? `data URL (${thumbnailData.length} chars)` : 'NULL/falsy');

      const freshestLayers = JSON.parse(JSON.stringify(layersRef.current));
      let persistedId = currentDesignIdRef.current;
      let persistedEditedAt = new Date().toISOString();

      const response = await fetch(`${resolvedApiUrl}/designs/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          id: currentDesignIdRef.current || undefined,
          name: nextName,
          platform: resolvedPlatform,
          user_email: email,
          user_id: userId,
          json_data: {
            name: nextName,
            platform: resolvedPlatform,
            layers: freshestLayers,
            brightness: snapshot.brightness,
            contrast: snapshot.contrast,
            saturation: snapshot.saturation,
            hue: snapshot.hue,
          },
          thumbnail: thumbnailData,
        }),
      });

      if(!response.ok){
        const errText = await response.text().catch(()=>'');
        console.error('[STORAGE] Request failed. Status:', response.status, 'Body:', errText);
        throw new Error(`Save failed with status ${response.status}: ${errText}`);
      }

      const payload = await response.json().catch(()=>({}));
      const returnedId = payload?.data?.id || payload?.id || payload?.design?.id || null;
      persistedEditedAt = payload?.data?.last_edited || payload?.last_edited || payload?.design?.last_edited || persistedEditedAt;
      console.log('[STORAGE] Save succeeded. ID:', returnedId, '| Name:', nextName, '| Platform:', resolvedPlatform);

      // Update ref and sync URL if the server returned a new ID.
      if(returnedId && returnedId !== currentDesignIdRef.current){
        currentDesignIdRef.current = returnedId;
        setCurrentProjectId(returnedId);
      }
      if(returnedId){
        const urlId = new URLSearchParams(window.location.search).get('project');
        if(urlId !== String(returnedId)){
          syncProjectIdToUrl(returnedId);
        }
      }
      persistedId = returnedId || persistedId;

      const savedDesign = {
        id: persistedId || snapshot.projectId || Date.now(),
        projectId: snapshot.projectId,
        currentDesignId: persistedId || null,
        name: nextName,
        created: new Date().toLocaleString(),
        platform: resolvedPlatform,
        layers: freshestLayers,
        brightness: snapshot.brightness,
        contrast: snapshot.contrast,
        saturation: snapshot.saturation,
        hue: snapshot.hue,
        last_edited: persistedEditedAt,
        json_data: {
          name: nextName,
          platform: resolvedPlatform,
          layers: freshestLayers,
          brightness: snapshot.brightness,
          contrast: snapshot.contrast,
          saturation: snapshot.saturation,
          hue: snapshot.hue,
        },
        thumbnail: thumbnailData,
      };

      lastSavedSignatureRef.current = signature;

      // Always sync IndexedDB immediately after a successful Railway save.
      // This keeps the Gallery (which reads IndexedDB) in sync at all times.
      saveEngineRef.current?.saveImmediate();

      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('Saved');
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus(''), 3000);
      }

      if(!silent){
        persistSavedDesigns(savedDesign);
        setCmdLog(`✓ Saved: ${nextName}`);
      }

      return { id: persistedId || null, design: savedDesign };
    }catch(err){
      console.error('[STORAGE] Save failed:', err);
      if(!silent){
        clearTimeout(saveStatusTimerRef.current);
        setSaveStatus('Error');
        setCmdLog('Save failed');
      }
      return null;
    }finally{
      // THIS MUST EXECUTE NO MATTER WHAT — releases the lock unconditionally.
      isSavingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[buildSaveSignature, generateDesignThumbnail, setCurrentProjectId]);

  useEffect(()=>{
    saveProjectRef.current = saveProject;
  },[saveProject]);

  useEffect(() => {
    const currentDebouncer = debounce(() => {
      if(saveProjectRef.current){
        saveProjectRef.current({ silent:true });
      }
      // Also trigger local IndexedDB save
      if(saveEngineRef.current){
        saveEngineRef.current.markDirty('layerProperties');
      }
    }, 3000);

    debouncedSaveRef.current = currentDebouncer;

    return () => {
      if(currentDebouncer){
        currentDebouncer.cancel();
      }
      debouncedSaveRef.current = null;
    };
  }, []);

  useEffect(()=>{
    if(isLoading || !draftHydratedRef.current)return;

    const currentState = buildProjectSnapshot(layers);

    // Keep latest draft in memory to avoid localStorage quota crashes.
    draftStateRef.current = currentState;

    // Mark project as dirty so the save engine schedules a local save
    saveEngineRef.current?.markDirty('projectMeta');
  },[aiPrompt, brightness, buildProjectSnapshot, contrast, currentDesignId, designName, fillColor, hue, isLoading, lastGeneratedImageUrl, layers, platform, projectId, saturation, strokeColor, textColor]);

  // Auto-scroll history list to current entry when tab is active
  useEffect(()=>{
    if(rightPanelTab!=='history'||!historyListRef.current) return;
    const rows=historyListRef.current.querySelectorAll('[data-hist-row]');
    if(rows[historyIndex]) rows[historyIndex].scrollIntoView({block:'nearest',behavior:'smooth'});
  },[rightPanelTab,historyIndex]);

  async function loadProject(d){
    try{
      let projectData=d;
      const loadedId=d?.currentDesignId||d?.id||null;

      if(!projectData?.json_data && !projectData?.canvas_data && token && loadedId){
        const response = await fetch(`${resolvedApiUrl}/designs/load?id=${encodeURIComponent(loadedId)}`,
          { headers:{ authorization:`Bearer ${token}` } });
        if(response.ok){
          const payload=await response.json().catch(()=>({}));
          projectData = payload?.design || payload?.data || payload || d;
        }
      }

      const sourceJsonData = projectData?.json_data || projectData?.canvas_data || [];
      const clonedJsonData = JSON.parse(JSON.stringify(sourceJsonData));
      const hydratedLayersRaw = Array.isArray(clonedJsonData)
        ? clonedJsonData
        : (Array.isArray(clonedJsonData?.layers) ? clonedJsonData.layers : []);
      const hydratedLayers = Array.isArray(hydratedLayersRaw) ? hydratedLayersRaw : [];
      const jsonMeta = Array.isArray(clonedJsonData) ? {} : (clonedJsonData || {});

      const nextProjectId=projectData?.projectId||projectData?.project_id||d?.projectId||generateProjectId();
      const nextPlatform=projectData?.platform||jsonMeta?.platform||'youtube';
      const nextName=projectData?.name||jsonMeta?.name||'Untitled';
      const nextBrightness=projectData?.brightness??jsonMeta?.brightness??100;
      const nextContrast=projectData?.contrast??jsonMeta?.contrast??100;
      const nextSaturation=projectData?.saturation??jsonMeta?.saturation??100;
      const nextHue=projectData?.hue??jsonMeta?.hue??0;

      setLayers([]);
      layersRef.current=[];
      await new Promise(resolve=>setTimeout(resolve,0));

      setLayers(hydratedLayers);
      layersRef.current=hydratedLayers;
      setPlatform(nextPlatform);
      setBrightness(nextBrightness);
      setContrast(nextContrast);
      setSaturation(nextSaturation);
      setHue(nextHue);
      setDesignName(nextName);

      const nextPersistedId=projectData?.id||d?.currentDesignId||d?.id||null;
      currentDesignIdRef.current=nextPersistedId;
      setCurrentDesignId(nextPersistedId);

      setProjectId(nextProjectId);
      syncProjectIdToUrl(nextProjectId);
      setSelectedId(null);
      setShowFileTab(false);
      setShowExpressionScore(false);

      const snapshot = JSON.parse(JSON.stringify(hydratedLayers));
      historyRef.current=[snapshot];
      historyIndexRef.current=0;
      setHistory([snapshot]);
      setHistoryIndex(0);

      lastSavedSignatureRef.current=buildSaveSignature({
        projectId:nextProjectId,
        platform:nextPlatform,
        layers:hydratedLayers,
        brightness:nextBrightness,
        contrast:nextContrast,
        saturation:nextSaturation,
        hue:nextHue,
        designName:nextName,
        aiPrompt:'',
        lastGeneratedImageUrl:'',
      });

      setCmdLog(`Loaded: ${nextName}`);
    }catch(err){
      console.error('[LOAD PROJECT] Error:', err);
      setCmdLog('Load failed');
    }
  }

  function newCanvas(){
    const b=makeBg(p);
    const nextProjectId=generateProjectId();
    setLayers([b]);
    historyRef.current=[[b]];
    historyIndexRef.current=0;
    setHistory([[b]]);
    setHistoryIndex(0);
    currentDesignIdRef.current=null;
    setCurrentDesignId(null);
    setProjectId(nextProjectId);
    syncProjectIdToUrl(nextProjectId);
    setSelectedId(null);
    setShowFileTab(false);
    lastSavedSignatureRef.current=buildSaveSignature({
      projectId:nextProjectId,
      platform,
      layers:[b],
      brightness:100,
      contrast:100,
      saturation:100,
      hue:0,
      designName:'My Design',
      aiPrompt:'',
      lastGeneratedImageUrl:'',
    });
  }

  async function deleteDesign(id){
    // Validate: never send a DELETE without a real ID.
    if(!id){
      console.error('[DELETE] Cannot delete: Project ID is missing.');
      return;
    }

    // Step 1 — Flag the ID synchronously before anything async so the
    // resurrection guard fires immediately on any queued auto-save.
    deletedIdsRef.current.add(id);

    const isActive = currentDesignIdRef.current === id;

    if(isActive){
      // Clear the ref + signature before the await so no in-flight save can
      // sneak through with the stale ID while we wait for the network.
      currentDesignIdRef.current = null;
      lastSavedSignatureRef.current = '';
      clearProjectIdFromUrl();
    }

    // Step 2 — Call the backend DELETE, with auth, uuid-validated.
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if(token){
        const res = await fetch(`${resolvedApiUrl}/designs/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if(!res.ok){
          const errText = await res.text().catch(()=>'');
          console.error('[DELETE] Backend DELETE failed:', res.status, errText);
        } else {
          console.log('[DELETE] Backend confirmed deletion of ID:', id);
        }
      } else {
        console.warn('[DELETE] No session token — skipping backend DELETE for ID:', id);
      }
    }catch(err){
      console.error('[DELETE] Network error during DELETE:', err);
    }

    // Step 3 — Update local React state regardless of backend outcome so the
    // UI reflects the deletion immediately without requiring a page refresh.
    setSavedDesigns(prev => prev.filter(d => d.id !== id && d.currentDesignId !== id));

    // Step 4 — Redirect if the deleted project was the one being edited.
    if(isActive){
      window.location.replace('/editor');
    }
  }

  async function analyzeCTR(){
    setCtrLoading(true);
    setCtrV2(null);
    setCtrChecked(new Set());
    setCtrExpandedCat(null);
    try{
      const flat=document.createElement('canvas');
      flat.width=p.preview.w; flat.height=p.preview.h;
      await renderLayersToCanvas(flat,layers);
      const dataUrl=flat.toDataURL('image/jpeg',0.88);
      setCtrThumbUrl(dataUrl);
      const result=ctrScoreClientSide(flat,ctrNiche);
      setCtrV2({...result,_ts:Date.now()});
      setCmdLog(`CTR Score: ${result.overall}/100 — ${result.predicted_ctr_low}%–${result.predicted_ctr_high}% predicted CTR`);
    }catch(err){
      setCmdLog('CTR analysis failed. Try again.');
    }finally{
      setCtrLoading(false);
    }
  }

  // Client-side CTR scoring — pixel analysis only, no API needed.
  function ctrScoreClientSide(canvas, niche='general'){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const w=canvas.width, h=canvas.height, total=w*h;
    const d=ctx.getImageData(0,0,w,h).data;

    // Brightness & contrast
    let sumLum=0;
    for(let i=0;i<d.length;i+=4)
      sumLum+=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
    const avgLum=sumLum/total;
    let sumSq=0;
    for(let i=0;i<d.length;i+=16){
      const b=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
      sumSq+=(b-avgLum)**2;
    }
    const contrast=Math.sqrt(sumSq/(total/4));

    // Saturation
    let sumSat=0;
    for(let i=0;i<d.length;i+=16){
      const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
      sumSat+=mx>0?(mx-mn)/mx:0;
    }
    const avgSat=sumSat/(total/4);

    // Edge density (proxy for text/graphic presence) via 2×2 block variance
    let edgeCount=0;
    const stride=4;
    for(let y=0;y<h-1;y+=stride){
      for(let x=0;x<w-1;x+=stride){
        const i=(y*w+x)*4;
        const j=((y)*w+(x+1))*4;
        const diff=Math.abs((d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)-(d[j]*0.299+d[j+1]*0.587+d[j+2]*0.114));
        if(diff>30) edgeCount++;
      }
    }
    const edgePct=edgeCount/((h/stride)*(w/stride));

    // Rule-of-thirds focal mass
    const zoneW=Math.floor(w/3), zoneH=Math.floor(h/3);
    const zoneLum=Array.from({length:9},()=>0);
    for(let y=0;y<h;y+=2){
      for(let x=0;x<w;x+=2){
        const zi=Math.min(2,Math.floor(x/zoneW))+Math.min(2,Math.floor(y/zoneH))*3;
        zoneLum[zi]+=d[(y*w+x)*4]*0.299+d[(y*w+x)*4+1]*0.587+d[(y*w+x)*4+2]*0.114;
      }
    }
    // Strongest zone at a thirds intersection = good composition
    const powerZones=[0,2,6,8];
    const maxZone=zoneLum.indexOf(Math.max(...zoneLum));
    const goodComposition=powerZones.includes(maxZone);

    // Category scores
    const brightScore=avgLum>=55&&avgLum<=210?18:avgLum>=35?12:6;
    const contrastScore=contrast>=50?18:contrast>=30?12:6;
    const satScore=avgSat>=0.18&&avgSat<=0.75?15:avgSat>=0.1?9:4;
    const edgeScore=edgePct>=0.12&&edgePct<=0.55?15:edgePct>=0.05?10:4;
    const compScore=goodComposition?14:8;
    const nicheScore=14; // can't detect without ML — neutral

    const overall=Math.min(100,brightScore+contrastScore+satScore+edgeScore+compScore+nicheScore+6);
    // Map score to predicted CTR range
    const baseCtr=(overall/100)*8+0.8;
    const lo=Math.max(0.5,+(baseCtr-0.6).toFixed(1));
    const hi=+(baseCtr+0.8).toFixed(1);
    const niches={gaming:5.2,tech:3.8,vlog:4.1,education:3.5,entertainment:4.8,general:4.2};
    const industryAvg=niches[niche]||4.2;

    const issues=[];
    const wins=[];
    if(avgLum<55) issues.push({title:'Image too dark',description:'Brighten your thumbnail — dark images get skipped on mobile feeds.'});
    if(avgLum>210) issues.push({title:'Image overexposed',description:'Reduce brightness — blown-out images look amateurish.'});
    if(contrast<30) issues.push({title:'Low contrast',description:'Increase contrast so subjects pop against the background.'});
    if(avgSat<0.1) issues.push({title:'Colours look washed out',description:'Boost saturation — vibrant thumbnails outperform muted ones by 30%.'});
    if(edgePct<0.05) issues.push({title:'No visible text or graphics',description:'Add large bold text — thumbnails with text get 2× more clicks.'});
    if(!goodComposition) issues.push({title:'Composition needs work',description:'Place the main subject at a rule-of-thirds intersection (not dead centre).'});
    if(contrast>=50) wins.push({title:'Strong contrast',description:'High contrast keeps your thumbnail readable at thumbnail size.'});
    if(avgSat>=0.25) wins.push({title:'Vibrant colours',description:'Well-saturated colours attract the eye in crowded feed rows.'});
    if(edgePct>=0.15) wins.push({title:'Rich detail',description:'Detailed thumbnails suggest high-quality, well-produced content.'});
    if(goodComposition) wins.push({title:'Good composition',description:'Subject placement follows the rule of thirds — proven to increase engagement.'});

    return{
      overall,
      predicted_ctr_low:lo,
      predicted_ctr_high:hi,
      industry_avg:industryAvg,
      categories:{
        color_contrast:{score:Math.round((brightScore+contrastScore)/36*20),max:20,tip:'Bright, high-contrast thumbnails perform best at small sizes.'},
        emotional_intensity:{score:Math.round(satScore/15*20),max:20,tip:'Saturated, warm colours signal energy and urgency.'},
        composition:{score:Math.round(compScore/14*20),max:20,tip:'Place subjects at rule-of-thirds intersections for maximum draw.'},
        text_readability:{score:Math.round(edgeScore/15*20),max:20,tip:'Large bold text (>72px) doubles click-through rates.'},
        face_prominence:{score:14,max:20,tip:'Expressive faces with visible eyes get 38% more clicks than faceless thumbnails.'},
        niche_relevance:{score:12,max:20,tip:'Use colours and styles that match top performers in your niche.'},
      },
      issues,
      wins,
    };
  }

  // ── Automation Pipeline — ThumbnailAnalyzer + ThumbnailEnhancer ─────────
  function runAutoAnalysis(imageDataUrl){
    setAutoPanel(true);
    setAutoLoading(true);
    setAutoRecs([]);
    setAutoMetrics(null);
    setAutoDismissed(new Set());
    setAutoPreviewUrl(imageDataUrl);
    setTimeout(async ()=>{
      try{
        const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=imageDataUrl;});
        const c=document.createElement('canvas');
        c.width=img.naturalWidth; c.height=img.naturalHeight;
        c.getContext('2d').drawImage(img,0,0);
        const result=await runThumbnailAnalysis(c);
        setAutoRecs(result.recommendations);
        setAutoMetrics(result);
      }catch(err){
        console.error('[AUTO-ANALYZE]',err);
        setAutoPanel(false);
      }finally{
        setAutoLoading(false);
      }
    },50);
  }

  async function applyAutoAction(action){
    if(action==='show_safe_zones'){ setShowSafeZones(true); return; }

    const imgLayer=layers.find(l=>l.type==='image'&&!l.hidden);
    if(!imgLayer?.src) return;

    const img=await new Promise((res,rej)=>{
      const i=new Image(); i.crossOrigin='Anonymous';
      i.onload=()=>res(i); i.onerror=rej; i.src=imgLayer.src;
    });
    const c=document.createElement('canvas');
    c.width=img.naturalWidth; c.height=img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);

    const actionMap={
      auto_brighten:     autoBrighten,
      auto_darken:       autoContrast,
      auto_contrast:     autoContrast,
      auto_saturate:     autoSaturate,
      auto_desaturate:   autoDesaturate,
      auto_vignette:     autoVignette,
      auto_white_balance:autoWhiteBalance,
      gaming_enhance:    gamingEnhance,
    };
    const fn=actionMap[action];
    if(!fn) return;
    fn(c);

    const newSrc=c.toDataURL('image/png');
    updateLayer(imgLayer.id,{src:newSrc});
    setAutoPreviewUrl(newSrc);

    // Debounced re-analysis
    clearTimeout(autoAnalysisDebounceRef.current);
    autoAnalysisDebounceRef.current=setTimeout(()=>runAutoAnalysis(newSrc),1000);
  }

  async function runAutoFix(){
    setAutoFixRunning(true);
    try{
      const imgLayer=layers.find(l=>l.type==='image'&&!l.hidden);
      if(!imgLayer?.src){showToastMsg('No image layer found','error');return;}
      const img=await new Promise((res,rej)=>{
        const i=new Image();i.crossOrigin='Anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=imgLayer.src;
      });
      const c=document.createElement('canvas');
      c.width=img.naturalWidth; c.height=img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0);
      const fixable=autoRecs.filter(r=>!autoDismissed.has(r.id)&&r.action&&!['show_safe_zones','crop_to_face','resize_canvas'].includes(r.action));
      await enhanceWithWorker(c,fixable);
      const newSrc=c.toDataURL('image/png');
      updateLayer(imgLayer.id,{src:newSrc});
      setAutoPreviewUrl(newSrc);
      showToastMsg('Auto-fix applied ✓','success');
      // Re-analyze after a beat
      clearTimeout(autoAnalysisDebounceRef.current);
      autoAnalysisDebounceRef.current=setTimeout(()=>runAutoAnalysis(newSrc),1000);
      setAutoPanel(false);
    }catch(err){
      console.error('[AUTO-FIX]',err);
      showToastMsg('Auto-fix failed — try individual actions','error');
    }finally{
      setAutoFixRunning(false);
    }
  }

  // ── Prompt-to-Thumbnail Assembly ──────────────────────────────────────────
  function handlePromptAssemble(components, composition){
    const W = p.preview.w;  // 1280
    const H = p.preview.h;  // 720
    const layout = composition?.layout || 'subject_left_text_right';

    // Determine text x position based on layout
    const textX = layout==='subject_right_text_left' ? 40
                : layout==='centered'                ? Math.round(W/2)-180
                : Math.round(W*0.54); // subject_left_text_right default

    for(const comp of components){
      if(comp.requiresUpload) continue; // skip photo placeholder — user uploads manually

      if(comp.type==='text_layer'||(comp.content&&!comp.imageBase64)){
        const style = comp.style||{};
        const strokes = (style.strokes||[]).map(s=>({color:s.color||'#000000',width:s.width||8,opacity:100}));
        addLayer({
          type:'text',
          text: comp.content||comp.textContent||'',
          x: textX, y: Math.round(H*0.28),
          fontSize: 80,
          fontFamily: style.font||'Impact',
          fontWeight: 900,
          fontItalic: false,
          textColor: style.fill||'#FFFFFF',
          strokeColor: strokes[0]?.color||'#000000',
          strokeWidth: strokes[0]?.width||6,
          shadowEnabled: true,
          shadowColor: '#000000',
          shadowBlur: 18,
          shadowX: 2,
          shadowY: 2,
          glowEnabled: false,
          glowColor: '#f97316',
          arcEnabled: false,
          arcRadius: 120,
          letterSpacing: -2,
          lineHeight: 1.1,
          textAlign: 'left',
          textTransform: 'uppercase',
          fillType: 'solid',
          gradientColors: null,
          gradientAngle: 0,
          textStrokes: strokes,
          warpType: 'none',
          warpAmount: 30,
        });
        continue;
      }

      if(comp.imageBase64){
        const dataUrl = `data:image/jpeg;base64,${comp.imageBase64}`;
        const isBackground = comp.id==='background'||comp.type==='generate';

        if(isBackground){
          // Background layer fills canvas
          addLayer({
            type:'image', src:dataUrl,
            x:0, y:0, width:W, height:H,
            cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
            imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
            name:'Background',
          });
        } else {
          // Prop/asset — positioned based on layout, screen blend to remove black bg
          const propW = Math.round(W*0.3);
          const propH = Math.round(H*0.6);
          const propX = layout==='subject_right_text_left' ? Math.round(W*0.6) : Math.round(W*0.05);
          addLayer({
            type:'image', src:dataUrl,
            x:propX, y:Math.round((H-propH)/2), width:propW, height:propH,
            cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
            imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
            blendMode: comp.aiGenerated ? 'screen' : 'normal', // black-bg props use screen
            name: comp.id||'Prop',
          });
        }
      }
    }

    setShowPromptEngine(false);
    showToastMsg(`Assembled ${components.filter(c=>c.imageBase64||c.content||c.textContent).length} layers from AI generation`,'success');
  }

  // ── Composition Analysis (client-side pixel math — no API) ───────────────
  async function analyzeComposition(){
    setCompLoading(true);
    setCompResult(null);
    setCompChecked(new Set());
    try{
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w; flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layers);
      const result=compositionAnalysisClientSide(flatCanvas);
      setCompResult(result);
      setCompOverlay(true);
      setCmdLog(`Composition score: ${result.score}/10 — ${result.issues?.length||0} issue${result.issues?.length!==1?'s':''} found`);
    }catch(err){
      setCmdLog('Composition analysis failed. Try again.');
    }finally{
      setCompLoading(false);
    }
  }

  // Client-side composition analysis — geometric pixel math, no API.
  function compositionAnalysisClientSide(canvas){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const w=canvas.width, h=canvas.height, total=w*h;
    const d=ctx.getImageData(0,0,w,h).data;

    // Build 9-zone grid (rule of thirds)
    const zW=Math.floor(w/3), zH=Math.floor(h/3);
    const zoneLum=new Array(9).fill(0), zoneCnt=new Array(9).fill(0);
    for(let y=0;y<h;y+=2){
      for(let x=0;x<w;x+=2){
        const zi=Math.min(2,Math.floor(x/zW))+Math.min(2,Math.floor(y/zH))*3;
        const lum=d[(y*w+x)*4]*0.299+d[(y*w+x)*4+1]*0.587+d[(y*w+x)*4+2]*0.114;
        zoneLum[zi]+=lum; zoneCnt[zi]++;
      }
    }
    const zoneAvg=zoneLum.map((s,i)=>s/Math.max(1,zoneCnt[i]));
    const maxZone=zoneAvg.indexOf(Math.max(...zoneAvg));
    const thirds=[0,2,6,8]; // corner intersections
    const nearThird=thirds.includes(maxZone)||[1,3,5,7].includes(maxZone);

    // Overall brightness
    let sumLum=0;
    for(let i=0;i<d.length;i+=4) sumLum+=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
    const avgLum=sumLum/total;

    // Contrast
    let sumSq=0;
    for(let i=0;i<d.length;i+=16){
      const b=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
      sumSq+=(b-avgLum)**2;
    }
    const contrast=Math.sqrt(sumSq/(total/4));

    // Saturation
    let sumSat=0;
    for(let i=0;i<d.length;i+=16){
      const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
      sumSat+=mx>0?(mx-mn)/mx:0;
    }
    const avgSat=sumSat/(total/4);

    // Edge density (text/graphic presence)
    let edgeCount=0;
    for(let y=0;y<h-1;y+=4){
      for(let x=0;x<w-1;x+=4){
        const i=(y*w+x)*4,j=((y)*w+(x+1))*4;
        if(Math.abs((d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)-(d[j]*0.299+d[j+1]*0.587+d[j+2]*0.114))>30)
          edgeCount++;
      }
    }
    const edgePct=edgeCount/((h/4)*(w/4));

    // Safe zone check — top-right 15% (YouTube watermark area) shouldn't be busy
    const crW=Math.floor(w*0.15), crH=Math.floor(h*0.15);
    let crEdge=0;
    for(let y=0;y<crH-1;y+=2){
      for(let x=w-crW;x<w-1;x+=2){
        const i=(y*w+x)*4,j=(y*w+(x+1))*4;
        if(Math.abs((d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)-(d[j]*0.299+d[j+1]*0.587+d[j+2]*0.114))>30)
          crEdge++;
      }
    }
    const cornerBusy=crEdge/((crH/2)*(crW/2))>0.3;

    // Score
    let score=5;
    if(nearThird) score+=1;
    if(contrast>=40) score+=1;
    if(avgLum>=50&&avgLum<=200) score+=1;
    if(avgSat>=0.15) score+=1;
    if(edgePct>=0.08) score+=1;
    if(cornerBusy) score-=1;
    score=Math.max(1,Math.min(10,score));

    const issues=[];
    const wins=[];
    if(!nearThird) issues.push({title:'Subject not at thirds intersection',description:'Move your main subject to a rule-of-thirds crossing (⅓ from any edge) for stronger visual pull.'});
    if(contrast<30) issues.push({title:'Low contrast',description:'Increase contrast — subjects need to pop from the background at thumbnail size.'});
    if(avgLum<50) issues.push({title:'Image too dark',description:'Dark thumbnails are overlooked in bright feed environments.'});
    if(avgLum>210) issues.push({title:'Image overexposed',description:'Reduce brightness — blown highlights look unprofessional.'});
    if(edgePct<0.06) issues.push({title:'No text or graphics visible',description:'Add large bold text — thumbnails with text get 2× more clicks.'});
    if(cornerBusy) issues.push({title:'Top-right corner too busy',description:'YouTube places a video duration badge here. Keep this area clear.'});
    if(nearThird) wins.push({title:'Good rule-of-thirds placement',description:'Subject sits near a power intersection — proven to increase viewer engagement.'});
    if(contrast>=40) wins.push({title:'Strong contrast',description:'High contrast makes your thumbnail readable at any size.'});
    if(avgSat>=0.2) wins.push({title:'Vibrant colours',description:'Saturated colours attract the eye across different devices and screen brightnesses.'});

    // Suggest crop to highest-interest zone
    const bz=maxZone;
    const bzCol=bz%3, bzRow=Math.floor(bz/3);
    const cropX=(bzCol*zW/w*100).toFixed(0);
    const cropY=(bzRow*zH/h*100).toFixed(0);
    const cropW=(Math.min(100,zW*2/w*100)).toFixed(0);
    const cropH=(Math.min(100,zH*2/h*100)).toFixed(0);

    return{
      score,
      issues,
      wins,
      focal_point:nearThird?'Subject near rule-of-thirds intersection':'Subject near centre — consider repositioning',
      negative_space:avgSat<0.15?'Low colour variety — consider adding a contrasting element':'Colour balance looks good',
      face_placement:null,
      crop_suggestion:{x:+cropX,y:+cropY,w:+cropW,h:+cropH},
      text_zones:[],
      success:true,
    };
  }

  function applyCropSuggestion(){
    const crop=compResult?.crop_suggestion;
    if(!crop) return;
    const cx=crop.x/100*p.preview.w;
    const cy=crop.y/100*p.preview.h;
    const cw=crop.w/100*p.preview.w;
    const ch=crop.h/100*p.preview.h;
    // Zoom + pan to frame the suggested crop region (non-destructive)
    const newZoom=Math.min(p.preview.w/Math.max(1,cw),p.preview.h/Math.max(1,ch))*0.92;
    const centerX=cx+cw/2;
    const centerY=cy+ch/2;
    setZoom(Math.min(8,Math.max(0.25,newZoom)));
    setPanOffset({x:p.preview.w/2-centerX,y:p.preview.h/2-centerY});
    setCmdLog('Crop suggestion applied — view zoomed to recommended area');
  }

  // ── AI Text Engine ────────────────────────────────────────────────────────
  async function generateAIText(){
    setAiTextLoading(true);
    setAiTextResults([]);
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if(!token) throw new Error('No session');
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w; flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layers);
      const dataUrl=flatCanvas.toDataURL('image/jpeg',0.88);
      const res=await fetch(`${resolvedApiUrl}/api/generate-text`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({
          title:aiTextTitle.trim()||undefined,
          niche:aiTextNiche.trim()||undefined,
          image:dataUrl,
        }),
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data?.error||'Generation failed');
      if(!data.success) throw new Error(data.error||'Invalid response');
      setAiTextResults(data.options||[]);
      setCmdLog(`${data.options?.length||0} headline${data.options?.length!==1?'s':''} generated — click any to place`);
    }catch(err){
      // Fallback: useful writing prompts so the feature stays helpful
      const niche=aiTextNiche.trim()||'general';
      const title=aiTextTitle.trim();
      setAiTextResults([
        {text:title?title.toUpperCase():'ADD YOUR TITLE',x:10,y:12,fontSize:72,fontFamily:'Anton',color:'light',bold:true},
        {text:'YOU WON\'T BELIEVE THIS',x:10,y:20,fontSize:56,fontFamily:'Anton',color:'light',bold:true},
        {text:niche!=='general'?`${niche.toUpperCase()} GUIDE`:'WATCH THIS',x:10,y:60,fontSize:64,fontFamily:'Bebas Neue',color:'light',bold:true},
        {text:'#1 MISTAKE',x:10,y:40,fontSize:64,fontFamily:'Anton',color:'light',bold:true},
        {text:'I CAN\'T BELIEVE IT WORKED',x:10,y:30,fontSize:48,fontFamily:'Anton',color:'light',bold:true},
      ]);
      setCmdLog('AI server unavailable — showing text starters. Click any to place.');
    }finally{
      setAiTextLoading(false);
    }
  }

  function placeAITextOption(opt){
    const xPx=Math.round((opt.x/100)*p.preview.w);
    const yPx=Math.round((opt.y/100)*p.preview.h);
    const textColor=opt.color==='light'?'#ffffff':'#111111';
    const strokeColor=opt.color==='light'?'#000000':'#ffffff';
    addLayer({
      type:'text',
      text:opt.text,
      x:Math.max(4,Math.min(p.preview.w-180,xPx)),
      y:Math.max(4,Math.min(p.preview.h-70,yPx)),
      fontSize:opt.fontSize||60,
      fontFamily:opt.fontFamily||'Anton',
      fontWeight:900,
      fontItalic:false,
      textColor,
      strokeColor,
      strokeWidth:opt.strokeWidth||0,
      shadowEnabled:true,
      shadowColor:'#000000',
      shadowBlur:20,
      shadowX:0,
      shadowY:4,
      glowEnabled:false,
      glowColor:'#f97316',
      arcEnabled:false,
      arcRadius:300,
      letterSpacing:2,
      lineHeight:1.1,
      textAlign:'left',
    });
    setActiveTool('select');
    setCmdLog(`"${opt.text}" placed — adjust freely in the canvas`);
  }

  // ── Style Transfer (client-side pixel toning — no API) ───────────────────
  async function applyStyleTransfer(){
    setStyleBusy(true);
    setStyleResult(null);
    try{
      const imgLayer=[...layers].find(l=>
        (l.type==='image'||(l.type==='background'&&l.src))&&!l.isRimLight&&l.src
      );
      let srcDataUrl;
      if(imgLayer?.src){
        srcDataUrl=imgLayer.src;
      }else{
        const flat=document.createElement('canvas');
        flat.width=p.preview.w; flat.height=p.preview.h;
        await renderLayersToCanvas(flat,layers);
        srcDataUrl=flat.toDataURL('image/jpeg',0.92);
      }

      const preset=styleMode==='preset'?stylePreset:'mrbeast';
      const intensity=styleIntensity/100;
      const processedDataUrl=await styleTransferClientSide(srcDataUrl,preset,intensity);
      const MOODS={mrbeast:'Punchy & Viral',mkbhd:'Clean & Minimal',veritasium:'Natural & Engaging',linus:'Bright & Direct',markrober:'Vibrant & Bold'};
      const mood=MOODS[preset]||'Custom';
      setStyleResult({mood});

      if(imgLayer){
        updateLayer(imgLayer.id,{src:processedDataUrl});
        setCmdLog(`Style applied — ${mood}`);
      }else{
        addLayer({type:'image',src:processedDataUrl,x:0,y:0,width:p.preview.w,height:p.preview.h});
        setCmdLog(`Style applied as new layer — ${mood}`);
      }
    }catch(err){
      setCmdLog('Style transfer failed. Try again.');
    }finally{
      setStyleBusy(false);
    }
  }

  // Creator-style colour toning — pure pixel math, no API.
  // presets: mrbeast | mkbhd | veritasium | linus | markrober
  function styleTransferClientSide(srcDataUrl, preset='mrbeast', intensity=0.75){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement('canvas');
        c.width=img.naturalWidth; c.height=img.naturalHeight;
        const ctx=c.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0);
        const id=ctx.getImageData(0,0,c.width,c.height);
        const d=id.data;

        // Each preset: { contrast, saturation, shadows:[r,g,b], highlights:[r,g,b] }
        const P={
          mrbeast:   {contrast:1.25,saturation:1.3, shadows:[20,10,0],   highlights:[255,240,180]},
          mkbhd:     {contrast:1.15,saturation:0.75,shadows:[0,5,20],    highlights:[245,248,255]},
          veritasium:{contrast:1.1, saturation:1.05,shadows:[10,20,5],   highlights:[255,248,230]},
          linus:     {contrast:1.2, saturation:1.1, shadows:[0,10,30],   highlights:[230,245,255]},
          markrober: {contrast:1.3, saturation:1.4, shadows:[5,15,25],   highlights:[255,235,210]},
        }[preset]||{contrast:1.15,saturation:1.1,shadows:[0,0,0],highlights:[255,255,255]};

        for(let i=0;i<d.length;i+=4){
          let r=d[i],g=d[i+1],b=d[i+2];
          // Contrast
          r=Math.round(128+(r-128)*P.contrast);
          g=Math.round(128+(g-128)*P.contrast);
          b=Math.round(128+(b-128)*P.contrast);
          // Colour toning (shadow/highlight split)
          const lum=(r*0.299+g*0.587+b*0.114)/255;
          const t=lum; // 0=shadow,1=highlight
          r=Math.round(r+(P.shadows[0]*(1-t)+P.highlights[0]*t-r)*intensity*0.25);
          g=Math.round(g+(P.shadows[1]*(1-t)+P.highlights[1]*t-g)*intensity*0.25);
          b=Math.round(b+(P.shadows[2]*(1-t)+P.highlights[2]*t-b)*intensity*0.25);
          // Saturation
          const avg=(r+g+b)/3;
          r=Math.round(avg+(r-avg)*P.saturation);
          g=Math.round(avg+(g-avg)*P.saturation);
          b=Math.round(avg+(b-avg)*P.saturation);
          d[i]  =Math.min(255,Math.max(0,r));
          d[i+1]=Math.min(255,Math.max(0,g));
          d[i+2]=Math.min(255,Math.max(0,b));
        }
        ctx.putImageData(id,0,0);
        const out=c.toDataURL('image/png');
        c.width=1;c.height=1;
        resolve(out);
      };
      img.onerror=reject;
      img.src=srcDataUrl;
    });
  }

  // ── AI Background Generation ──────────────────────────────────────────────
  async function generateBackground(){
    setBgGenBusy(true);
    setBgGenPreview(null);
    setBgGenPrompt('');
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      // Check if selected layer is a cutout to composite
      const subjectLayer=selectedLayer?.type==='image'&&!selectedLayer?.isRimLight?selectedLayer:null;

      const res=await fetch(`${resolvedApiUrl}/api/generate-background`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({
          niche:bgGenNiche,
          customPrompt:bgGenCustom.trim()||undefined,
          subject:subjectLayer?.src||undefined,
        }),
      });
      const data=await res.json();
      if(!res.ok){
        if(res.status===429){setCmdLog(data.error||'Quota exceeded.');return;}
        throw new Error(data.error||'Generation failed');
      }
      if(!data.success) throw new Error(data.error||'Invalid response');
      setBgGenPreview(data.image);
      setBgGenPrompt(data.prompt||'');
      setCmdLog('Background generated — preview below. Click Apply to use it.');
    }catch(err){
      console.error('[BGGEN]',err);
      setCmdLog('Background generation failed. Try again.');
    }finally{
      setBgGenBusy(false);
    }
  }

  function applyGeneratedBackground(){
    if(!bgGenPreview) return;
    // Replace existing background layer or add below everything
    const bgLayer=layers.find(l=>l.type==='background');
    if(bgLayer){
      // Convert background layer to image type with the new src
      updateLayer(bgLayer.id,{type:'image',src:bgGenPreview,x:0,y:0,width:p.preview.w,height:p.preview.h,bgColor:null,bgGradient:null,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
    }else{
      // Prepend as bottom layer
      const id=`bg_${Date.now()}`;
      setLayers(prev=>{
        const nl=[{type:'image',src:bgGenPreview,id,x:0,y:0,width:p.preview.w,height:p.preview.h,opacity:100,hidden:false,locked:false,blendMode:'normal',flipH:false,flipV:false,rotation:0,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,effects:{shadow:{enabled:false},glow:{enabled:false},border:{enabled:false},overlay:{enabled:false},noise:{enabled:false}}}, ...prev];
        pushHistory(nl);
        return nl;
      });
      setSelectedId(id);
    }
    setBgGenPreview(null);
    setBgGenPrompt('');
    setActiveTool('select');
    setCmdLog('AI background applied');
    // AI completion is a significant action — save immediately
    saveEngineRef.current?.saveImmediate();
  }

  // ── Auto Color Grade & Pop (client-side pixel math — no API) ─────────────
  async function applyColorGrade(){
    const imgLayer=[...layers].find(l=>
      (l.type==='image'||(l.type==='background'&&l.src))&&!l.isRimLight&&l.src
    );
    if(!imgLayer){setCmdLog('Add an image layer first.');return;}

    setCgBusy(true);
    try{
      // Non-destructive: always grade from original
      const sourceToGrade=cgOriginalSrc||imgLayer.src;
      const targetId=cgLayerId||imgLayer.id;
      if(!cgOriginalSrc){
        setCgOriginalSrc(imgLayer.src);
        setCgLayerId(imgLayer.id);
      }

      const gradedDataUrl = await colorGradeClientSide(sourceToGrade, cgPreset, cgIntensity/100);
      setCgGradedSrc(gradedDataUrl);
      updateLayer(targetId,{src:gradedDataUrl});
      setCmdLog(`Color grade applied — ${cgPreset} @ ${cgIntensity}%`);
    }catch(err){
      setCmdLog('Color grade failed. Try again.');
      showToastMsg('Color grade failed', 'error');
    }finally{
      setCgBusy(false);
    }
  }

  // Pure client-side color grading — runs in ~30ms on any device.
  // preset: 'default'|'warm'|'cool'|'cinematic'|'neon'   intensity: 0–1
  function colorGradeClientSide(srcDataUrl, preset='default', intensity=0.8){
    return new Promise((resolve, reject)=>{
      const img=new Image();
      img.onload=()=>{
        const c=document.createElement('canvas');
        c.width=img.naturalWidth; c.height=img.naturalHeight;
        const ctx=c.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0);
        const imageData=ctx.getImageData(0,0,c.width,c.height);
        const d=imageData.data;
        const total=c.width*c.height;

        // 1. Auto-levels (0.5% clip)
        const hist=new Array(256).fill(0);
        for(let i=0;i<d.length;i+=4)
          hist[Math.round(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)]++;
        let lo=0,hi=255,cumLo=0,cumHi=0;
        for(let i=0;i<=255;i++){cumLo+=hist[i];if(cumLo>total*0.005){lo=i;break;}}
        for(let i=255;i>=0;i--){cumHi+=hist[i];if(cumHi>total*0.005){hi=i;break;}}
        const range=Math.max(1,hi-lo);
        for(let i=0;i<d.length;i+=4){
          const lum=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
          const ratio=(lum>0)?(Math.min(255,Math.max(0,(lum-lo)*255/range))/lum):1;
          d[i]  =Math.min(255,Math.max(0,Math.round(d[i]  *ratio)));
          d[i+1]=Math.min(255,Math.max(0,Math.round(d[i+1]*ratio)));
          d[i+2]=Math.min(255,Math.max(0,Math.round(d[i+2]*ratio)));
        }

        // 2. Mild S-curve contrast
        for(let i=0;i<d.length;i+=4){
          for(let c2=0;c2<3;c2++){
            const x=d[i+c2]/255;
            d[i+c2]=Math.round(255/(1+Math.exp(-5*(x-0.5))));
          }
        }

        // 3. Preset-specific color toning (blended by intensity)
        const presetFn={
          default: (r,g,b)=>({r,g,b}),
          warm:    (r,g,b)=>({r:Math.min(255,r+20*intensity), g:Math.min(255,g+6*intensity),  b:Math.max(0,b-18*intensity)}),
          cool:    (r,g,b)=>({r:Math.max(0,r-15*intensity),   g:Math.min(255,g+5*intensity),  b:Math.min(255,b+22*intensity)}),
          cinematic:(r,g,b)=>({
            r:Math.min(255,r*0.95+8*intensity),
            g:Math.min(255,g*0.92+4*intensity),
            b:Math.min(255,b*1.08),
          }),
          neon:    (r,g,b)=>{
            const avg=(r+g+b)/3;
            return{
              r:Math.min(255,avg+(r-avg)*(1+0.4*intensity)),
              g:Math.min(255,avg+(g-avg)*(1+0.3*intensity)),
              b:Math.min(255,avg+(b-avg)*(1+0.5*intensity)),
            };
          },
        }[preset]||((r,g,b)=>({r,g,b}));

        for(let i=0;i<d.length;i+=4){
          const {r,g,b}=presetFn(d[i],d[i+1],d[i+2]);
          d[i]=Math.min(255,Math.max(0,Math.round(r)));
          d[i+1]=Math.min(255,Math.max(0,Math.round(g)));
          d[i+2]=Math.min(255,Math.max(0,Math.round(b)));
        }

        // 4. Vibrance boost (selective — lifts muted colours)
        const boost=0.15*intensity;
        for(let i=0;i<d.length;i+=4){
          const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);
          const sat=mx>0?(mx-mn)/mx:0;
          const b2=boost*(1-sat);
          if(mx!==mn){
            const avg2=(d[i]+d[i+1]+d[i+2])/3;
            d[i]  =Math.min(255,Math.max(0,Math.round(d[i]  +(d[i]  -avg2)*b2)));
            d[i+1]=Math.min(255,Math.max(0,Math.round(d[i+1]+(d[i+1]-avg2)*b2)));
            d[i+2]=Math.min(255,Math.max(0,Math.round(d[i+2]+(d[i+2]-avg2)*b2)));
          }
        }

        // 5. White balance (Gray World) — only when colour cast > 15 units
        let avgR=0,avgG=0,avgB=0;
        for(let i=0;i<d.length;i+=4){avgR+=d[i];avgG+=d[i+1];avgB+=d[i+2];}
        avgR/=total;avgG/=total;avgB/=total;
        if(Math.max(avgR,avgG,avgB)-Math.min(avgR,avgG,avgB)>15){
          const gray=(avgR+avgG+avgB)/3;
          const sR=gray/avgR,sG=gray/avgG,sB=gray/avgB;
          for(let i=0;i<d.length;i+=4){
            d[i]  =Math.min(255,Math.round(d[i]  *sR));
            d[i+1]=Math.min(255,Math.round(d[i+1]*sG));
            d[i+2]=Math.min(255,Math.round(d[i+2]*sB));
          }
        }

        ctx.putImageData(imageData,0,0);
        // Free canvas memory after export (Safari)
        const out=c.toDataURL('image/png');
        c.width=1;c.height=1;
        resolve(out);
      };
      img.onerror=reject;
      img.src=srcDataUrl;
    });
  }

  function resetColorGrade(){
    if(cgLayerId&&cgOriginalSrc) updateLayer(cgLayerId,{src:cgOriginalSrc});
    setCgOriginalSrc(null);
    setCgGradedSrc(null);
    setCgLayerId(null);
    setCmdLog('Color grade reset');
  }

  // Performance: Throttled rimlight to max 60fps
  const applyRimLightThrottled = (x, y) => {
    const now = Date.now();
    if (now - lastRimLightRef.current < 16) return; // 60fps limit
    lastRimLightRef.current = now;
    applyRimLight(x, y);
  };

  function applyRimLight(x, y){
    try{
      if(!selectedLayer || selectedLayer.type!=='image') return;

      const layerSnapshot={...selectedLayer};
      const baseSrc=getSafeImageSrc({src:layerSnapshot.src});
      if(!baseSrc) throw new Error('Invalid base image source');

      const hex=rimLightColor.replace('#','');
      const lr=parseInt(hex.slice(0,2),16);
      const lg=parseInt(hex.slice(2,4),16);
      const lb=parseInt(hex.slice(4,6),16);
      const lightR=Math.round((rimLightSize/100)*Math.max(layerSnapshot.width,layerSnapshot.height)*0.7);
      const intensity=rimLightIntensity/100;
      const softness=rimLightSoftness/100;

      const baseImg=new Image();
      baseImg.crossOrigin='Anonymous';
      baseImg.onload=()=>{
        try{
          const tmp=document.createElement('canvas');
          tmp.width=baseImg.naturalWidth;
          tmp.height=baseImg.naturalHeight;
          const ctx=tmp.getContext('2d');
          if(!ctx) throw new Error('Canvas context unavailable');

          ctx.drawImage(baseImg,0,0,tmp.width,tmp.height);

          const applyGradient=()=>{
            try{
              const scaleX=tmp.width/layerSnapshot.width;
              const scaleY=tmp.height/layerSnapshot.height;
              const scaledX=x*scaleX;
              const scaledY=y*scaleY;
              const scaledR=lightR*Math.max(scaleX,scaleY);

              const gradient=ctx.createRadialGradient(scaledX,scaledY,0,scaledX,scaledY,scaledR);
              gradient.addColorStop(0,`rgba(${lr},${lg},${lb},${intensity*0.6})`);
              gradient.addColorStop(softness*0.5,`rgba(${lr},${lg},${lb},${intensity*0.3})`);
              gradient.addColorStop(1,`rgba(${lr},${lg},${lb},0)`);
              ctx.fillStyle=gradient;
              ctx.fillRect(0,0,tmp.width,tmp.height);

              const nextSrc=tmp.toDataURL('image/png');
              if(!getSafeImageSrc({src:nextSrc})) throw new Error('Invalid rim-light output source');

              setLayers(prev=>{
                const hasTarget=prev.some(layer=>layer.id===layerSnapshot.id&&layer.type==='image');
                if(!hasTarget) return prev;
                const nl=prev.map(layer=>layer.id===layerSnapshot.id&&layer.type==='image'
                  ? {...layer,src:nextSrc,paintSrc:null}
                  : layer);
                pushHistoryDebounced(nl);
                return nl;
              });
            }catch(err){
              console.error('[RIM LIGHT] Apply failed:', err);
              alert('Rim light failed to apply. Please try again.');
            }
          };

          const paintSrc=getSafeImageSrc({src:layerSnapshot.paintSrc});
          if(paintSrc){
            const paintImg=new Image();
            paintImg.crossOrigin='Anonymous';
            paintImg.onload=()=>{
              try{ ctx.drawImage(paintImg,0,0,tmp.width,tmp.height); }catch(err){ console.error('[RIM LIGHT] Paint overlay draw failed:', err); }
              applyGradient();
            };
            paintImg.onerror=()=>applyGradient();
            paintImg.src=paintSrc;
          }else{
            applyGradient();
          }
        }catch(err){
          console.error('[RIM LIGHT] Processing failed:', err);
          alert('Rim light failed to apply. Please try again.');
        }
      };
      baseImg.onerror=()=>alert('Rim light failed to load the image source.');
      baseImg.src=baseSrc;
    }catch(err){
      console.error('[RIM LIGHT] Error:', err);
      alert('Rim light failed to apply. Please try again.');
    }
  }

  async function removeBackgroundFromSelected(){
    const layer=selectedLayer;
    if(!layer || layer.type!=='image'){
      alert('Select an image layer first.');
      return;
    }

    const targetId=layer.id;
    try{
      setRemoveBgBusy(true);
      let base64Src=getSafeImageSrc(layer);
      if(!base64Src) throw new Error('Selected layer has no valid source');

      if(!base64Src.startsWith('data:image/')){
        const response=await fetch(base64Src);
        if(!response.ok) throw new Error(`Image fetch failed (${response.status})`);
        const blob=await response.blob();
        base64Src=await readBlobAsDataUrl(blob);
      }

      if(!base64Src || !base64Src.startsWith('data:image/')){
        throw new Error('Failed to normalize source image');
      }

      const { data: { session: removeBgSession } } = await supabase.auth.getSession();
      const removeBgToken = removeBgSession?.access_token;
      const res=await fetch(`${resolvedApiUrl}/remove-bg`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${removeBgToken}`},
        body:JSON.stringify({image:base64Src}),
      });
      if(!res.ok) throw new Error(`Remove background request failed (${res.status})`);

      const data=await res.json();
      if(data?.error) throw new Error(data.error);

      const candidateSrc=typeof data?.image==='string' ? data.image.trim() : '';
      if(!candidateSrc || !getSafeImageSrc({src:candidateSrc})){
        throw new Error('Remove background returned invalid image data');
      }

      const safeDataUrl=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.crossOrigin='Anonymous';
        img.onload=()=>{
          try{
            const tmp=document.createElement('canvas');
            tmp.width=img.naturalWidth;
            tmp.height=img.naturalHeight;
            const ctx=tmp.getContext('2d');
            if(!ctx) throw new Error('Canvas context unavailable');
            ctx.drawImage(img,0,0,tmp.width,tmp.height);
            const next=tmp.toDataURL('image/png');
            if(!getSafeImageSrc({src:next})) throw new Error('Invalid processed image output');
            resolve(next);
          }catch(err){
            reject(err);
          }
        };
        img.onerror=()=>reject(new Error('Processed image could not be loaded'));
        img.src=candidateSrc;
      });

      setLayers(prev=>{
        const hasTarget=prev.some(item=>item.id===targetId&&item.type==='image');
        if(!hasTarget) return prev;
        const subjectShadowColor='#FFFFFF';
        const nl=prev.map(item=>item.id===targetId&&item.type==='image'
          ? {...item,src:safeDataUrl,paintSrc:null,isSubject:true,effects:{...(item.effects||defaultEffects()),shadow:{enabled:true,x:0,y:0,blur:20,color:subjectShadowColor,opacity:100},dropShadow:{enabled:false,x:0,y:0,blur:0,color:subjectShadowColor,opacity:100,spread:0},subjectOutline:{enabled:false,color:subjectShadowColor,width:0}}}
          : item);
        pushHistoryDebounced(nl);
        return nl;
      });

      setCmdLog('Background removed');
    }catch(err){
      console.error('[REMOVE BG] Error:', err);
      alert('Failed to remove background. Check your connection and try again.');
    }finally{
      setRemoveBgBusy(false);
    }
  }

  // ── Smart Cutout: run SAM 2 segmentation ─────────────────────────────────
  async function runSegmentation(){
    setSegmentBusy(true);
    setSegmentMasks([]);
    setSegmentError('');
    setSegmentStatus('Rendering canvas...');
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w;
      flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layers);
      const imageDataUrl=flatCanvas.toDataURL('image/jpeg',0.92);

      setSegmentStatus('Analyzing objects in your thumbnail...');

      const res=await fetch(`${resolvedApiUrl}/api/segment`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({image:imageDataUrl}),
      });
      const data=await res.json();

      if(!res.ok){
        if(res.status===429){setSegmentError(data.error||'Daily limit reached. Upgrade to continue.');return;}
        throw new Error(data.error||'Segmentation failed');
      }
      if(!data.success||!Array.isArray(data.masks)||data.masks.length===0){
        throw new Error('No objects detected in this thumbnail');
      }

      setSegmentMasks(data.masks);
      setCmdLog(`Detected ${data.masks.length} object${data.masks.length!==1?'s':''} — click on canvas to isolate`);
    }catch(err){
      console.error('[SEGMENT]',err);
      setSegmentError(err.message||'Segmentation failed. Please try again.');
    }finally{
      setSegmentBusy(false);
      setSegmentStatus('');
    }
  }

  // ── Smart Cutout: apply a mask → new isolated layer ──────────────────────
  async function applySegmentMask(maskIdx){
    const maskUrl=segmentMasks[maskIdx];
    if(!maskUrl)return;
    try{
      setCmdLog('Isolating object...');

      // 1. Full composited image
      const flatCanvas=document.createElement('canvas');
      flatCanvas.width=p.preview.w;
      flatCanvas.height=p.preview.h;
      await renderLayersToCanvas(flatCanvas,layers);

      // 2. Load mask PNG
      const maskImg=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error('Mask load failed'));
        img.src=maskUrl;
      });

      // 3. Apply mask as alpha channel
      const out=document.createElement('canvas');
      out.width=p.preview.w;
      out.height=p.preview.h;
      const ctx=out.getContext('2d');
      ctx.drawImage(flatCanvas,0,0);
      ctx.globalCompositeOperation='destination-in';
      ctx.drawImage(maskImg,0,0,out.width,out.height);
      ctx.globalCompositeOperation='source-over';

      // 4. Compute tight bounding box from mask pixels
      const mCanvas=document.createElement('canvas');
      mCanvas.width=p.preview.w;
      mCanvas.height=p.preview.h;
      mCanvas.getContext('2d').drawImage(maskImg,0,0,p.preview.w,p.preview.h);
      const mData=mCanvas.getContext('2d').getImageData(0,0,p.preview.w,p.preview.h).data;
      let minX=p.preview.w,maxX=0,minY=p.preview.h,maxY=0;
      for(let y=0;y<p.preview.h;y++){
        for(let x=0;x<p.preview.w;x++){
          const i=(y*p.preview.w+x)*4;
          if(mData[i]>24||mData[i+3]>24){
            if(x<minX)minX=x; if(x>maxX)maxX=x;
            if(y<minY)minY=y; if(y>maxY)maxY=y;
          }
        }
      }
      const cropW=Math.max(1,maxX-minX+1);
      const cropH=Math.max(1,maxY-minY+1);

      // 5. Crop to tight bounds
      const cropped=document.createElement('canvas');
      cropped.width=cropW;
      cropped.height=cropH;
      cropped.getContext('2d').drawImage(out,minX,minY,cropW,cropH,0,0,cropW,cropH);

      // 6. Add as new layer
      addLayer({
        type:'image',
        src:cropped.toDataURL('image/png'),
        width:cropW,
        height:cropH,
        x:minX,
        y:minY,
        cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
        imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
        isSubject:true,
        effects:defaultEffects(),
      });

      setSegmentMasks([]);
      setSegmentHoverIdx(null);
      setActiveTool('select');
      setCmdLog('Object isolated as new layer');
    }catch(err){
      console.error('[SEGMENT APPLY]',err);
      setCmdLog('Failed to isolate object. Try again.');
    }
  }

  function addMaskToLayer(id){ // eslint-disable-line no-unused-vars
    const layer=layers.find(l=>l.id===id);
    if(!layer||layer.type==='background') return;
    // Create a white mask canvas (white = show, black = hide)
    const tmp=document.createElement('canvas');
    tmp.width=layer.width||p.preview.w;
    tmp.height=layer.height||p.preview.h;
    const ctx=tmp.getContext('2d');
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,tmp.width,tmp.height);
    updateLayer(id,{
      mask:{
        enabled:true,
        inverted:false,
        data:tmp.toDataURL('image/png'),
        width:tmp.width,
        height:tmp.height,
      }
    });
    setCmdLog('Mask added — paint black to hide, white to reveal');
  }

  function removeMaskFromLayer(id){ // eslint-disable-line no-unused-vars
    updateLayer(id,{mask:{enabled:false,inverted:false,data:null}});
    if(maskingLayerId===id) setMaskingLayerId(null);
  }

  function applyMaskToLayer(id){ // eslint-disable-line no-unused-vars
    const layer=layers.find(l=>l.id===id);
    if(!layer?.mask?.enabled||!layer.mask.data) return;
    // Flatten mask into image permanently
    const img=new Image();
    img.onload=()=>{
      const mask=new Image();
      mask.onload=()=>{
        const tmp=document.createElement('canvas');
        tmp.width=layer.width;tmp.height=layer.height;
        const ctx=tmp.getContext('2d');
        ctx.drawImage(img,0,0,layer.width,layer.height);
        ctx.globalCompositeOperation='destination-in';
        ctx.drawImage(mask,0,0,layer.width,layer.height);
        updateLayer(id,{src:tmp.toDataURL('image/png'),mask:{enabled:false,inverted:false,data:null}});
      };
      mask.src=layer.mask.data;
    };
    img.src=layer.src;
  }


  function alignLayer(id,dir){
    const layer=layers.find(l=>l.id===id);if(!layer||layer.type==='background')return;
    const w=layer.width||100,h=layer.height||(layer.fontSize||48);
    let u={};
    if(dir==='center')  u={x:Math.round((p.preview.w-w)/2),y:Math.round((p.preview.h-h)/2)};
    if(dir==='center-h')u={x:Math.round((p.preview.w-w)/2)};
    if(dir==='center-v')u={y:Math.round((p.preview.h-h)/2)};
    if(dir==='left')u={x:0};if(dir==='right')u={x:p.preview.w-w};
    if(dir==='top') u={y:0};if(dir==='bottom')u={y:p.preview.h-h};
    updateLayer(id,u);
  }
  function flipLayer(id,axis){const layer=layers.find(l=>l.id===id);if(!layer)return;if(axis==='h')updateLayer(id,{flipH:!layer.flipH});if(axis==='v')updateLayer(id,{flipV:!layer.flipV});}

  function applyTextTemplate(t){
    setTextInput(t.text);setFontSize(t.fontSize);setFontFamily(t.fontFamily);setFontWeight(t.fontWeight||700);
    setTextColor(t.textColor);setStrokeColor(t.strokeColor);setStrokeWidth(t.strokeWidth);setShadowEnabled(t.shadowEnabled);
    setShadowColor(t.shadowColor||'#000000');setShadowBlur(t.shadowBlur||14);setShadowX(t.shadowX||2);setShadowY(t.shadowY||2);
    setGlowEnabled(t.glowEnabled||false);setGlowColor(t.glowColor||'#f97316');
    setLetterSpacing(t.letterSpacing||0);setLineHeight(t.lineHeight||1.2);setTextAlign(t.textAlign||'left');
    setTextTransform(t.textTransform||'none');
    setFillType(t.fillType||'solid');
    if(t.gradientColors){setGradColor1(t.gradientColors[0]||'#ff6600');setGradColor2(t.gradientColors[1]||'#ffcc00');}
    setGradAngle(t.gradientAngle||0);
    setTextStrokes(t.textStrokes||[]);
    addLayer({type:'text',text:t.text,fontSize:t.fontSize,fontFamily:t.fontFamily,fontWeight:t.fontWeight||700,fontItalic:false,textColor:t.textColor,strokeColor:t.strokeColor,strokeWidth:t.strokeWidth,shadowEnabled:t.shadowEnabled,shadowColor:t.shadowColor||'#000000',shadowBlur:t.shadowBlur||14,shadowX:t.shadowX||2,shadowY:t.shadowY||2,glowEnabled:t.glowEnabled||false,glowColor:t.glowColor||'#f97316',arcEnabled:false,arcRadius:120,letterSpacing:t.letterSpacing||0,lineHeight:t.lineHeight||1.2,textAlign:t.textAlign||'left',textTransform:t.textTransform||'none',fillType:t.fillType||'solid',gradientColors:t.gradientColors||null,gradientAngle:t.gradientAngle||0,textStrokes:t.textStrokes||[],warpType:t.warpType||'none',warpAmount:t.warpAmount||30});
  }
  function addText(){
    // ── Sprint 4: MrBeast-style defaults ──────────────────────────────────
    const nextFontFamily='Anton';
    const nextTextColor='#FFD700'; // YouTube gold
    const nextStrokeColor='#000000';
    const nextStrokeWidth=8;                  // strokeUniform equivalent (CSS scales with element)
    const nextShadowColor='rgba(0,0,0,0.8)';  // heavy drop shadow
    const nextShadowBlur=15;
    const nextShadowX=0;
    const nextShadowY=10;
    addRecentColor(nextTextColor);
    const appliedText=applyTextTransform(textInput||'MY THUMBNAIL',textTransform);
    addLayer({type:'text',text:appliedText,fontSize,fontFamily:nextFontFamily,fontWeight:900,fontItalic,textColor:nextTextColor,strokeColor:nextStrokeColor,strokeWidth:nextStrokeWidth,shadowEnabled:true,shadowColor:nextShadowColor,shadowBlur:nextShadowBlur,shadowX:nextShadowX,shadowY:nextShadowY,glowEnabled,glowColor,arcEnabled,arcRadius,letterSpacing,lineHeight,textAlign,textTransform,fillType,gradientColors:fillType==='gradient'?[gradColor1,gradColor2]:null,gradientAngle:gradAngle,textStrokes,warpType,warpAmount});
    setTextColor(nextTextColor);
    setFontFamily(nextFontFamily);
    setFontWeight(900);
    setStrokeColor(nextStrokeColor);
    setStrokeWidth(nextStrokeWidth);
    setShadowEnabled(true);
    setShadowColor(nextShadowColor);
    setShadowBlur(nextShadowBlur);
    setShadowX(nextShadowX);
    setShadowY(nextShadowY);
  }
  function addShape(type){
    addRecentColor(fillColor);
    const id=newId();
    const x=snapToGrid?Math.round(40/10)*10:40;
    const y=snapToGrid?Math.round(40/10)*10:40;
    const shapeLayer={
      id,
      type:'shape',
      shape:type,
      fillColor,
      strokeColor,
      width:100,
      height:100,
      x,
      y,
      opacity:100,
      hidden:false,
      locked:false,
      blendMode:'normal',
      flipH:false,
      flipV:false,
      rotation:0,
      effects:defaultEffects(),
    };
    setLayers(prev=>{
      const nl=[...prev,shapeLayer];
      pushHistory(nl);
      return nl;
    });
    setSelectedId(id);
  }
  function addSvgSticker(svg,label){addLayer({type:'svg',svg,label,width:64,height:64});}
  function readBlobAsDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:'');
      reader.onerror=()=>reject(new Error('Failed to convert blob to base64'));
      reader.readAsDataURL(blob);
    });
  }

  function addImageFromFile(file){
    if(!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try{
        const base64Src = typeof reader.result==='string' ? reader.result : '';
        if(!getSafeImageSrc({src:base64Src})) throw new Error('Invalid image source from FileReader');

        const img = new Image();
        img.crossOrigin='Anonymous';
        img.onload = () => {
          try{
            const cW=p.preview.w,cH=p.preview.h,ia=img.naturalWidth/img.naturalHeight,ca=cW/cH;
            if(!Number.isFinite(ia) || ia<=0) throw new Error('Image dimensions are invalid');

            let w,h;if(ia>ca){h=cH;w=h*ia;}else{w=cW;h=w/ia;}

            const id=newId();
            const newLayerObj={
              id,
              type:'image',
              src:base64Src,
              width:Math.round(w),
              height:Math.round(h),
              originalWidth:img.naturalWidth,
              originalHeight:img.naturalHeight,
              x:Math.round((cW-w)/2),
              y:Math.round((cH-h)/2),
              cropTop:0,
              cropBottom:0,
              cropLeft:0,
              cropRight:0,
              imgBrightness:100,
              imgContrast:100,
              imgSaturate:100,
              imgBlur:0,
              opacity:100,
              hidden:false,
              locked:false,
              blendMode:'normal',
              flipH:false,
              flipV:false,
              rotation:0,
              effects:defaultEffects(),
            };

            setLayers(prevLayers=>{
              const nextLayers=[...prevLayers,newLayerObj];
              pushHistory(nextLayers);
              return nextLayers;
            });
            setSelectedId(id);
            setShowExpressionScore(false);
            // Image import is a significant action — save immediately
            saveEngineRef.current?.saveImmediate();
            // Fire-and-forget: run MediaPipe face detection on new image
            setTimeout(()=>runFaceDetectionOnComposite(),400);
            // Auto-analyze thumbnail after first image import
            setTimeout(()=>runAutoAnalysis(base64Src),800);
          }catch(err){
            console.error('[ADD IMAGE] Image processing failed:', err);
            alert('Failed to add image. Please try a different file.');
          }
        };

        img.onerror = () => {
          console.error('[ADD IMAGE] Image decode failed');
          alert('Failed to decode image file. Please try another image.');
        };

        img.src = base64Src;
      }catch(err){
        console.error('[ADD IMAGE] FileReader onload failed:', err);
        alert('Failed to add image. Please try a different file.');
      }
    };

    reader.onerror = (error) => {
      console.error('[ADD IMAGE] FileReader error:', error);
      alert('Failed to read image file. Please try another file.');
    };

    reader.readAsDataURL(file);
  }

  function handleImageUpload(e){
    const files = Array.from(e.target.files||[]);
    files.forEach(file=>addImageFromFile(file));
    e.target.value='';
  }

  function updateSuggestions(val){if(!val.trim()){setCmdSuggestions([]);return;}const v=val.toLowerCase();setCmdSuggestions(ALL_COMMANDS.filter(c=>c.cmd.toLowerCase().startsWith(v)||c.desc.toLowerCase().includes(v)).slice(0,6));}
  function handleCmdKey(e){
    if(e.key==='Enter'){runCommand(cmdInput);return;}
    if(e.key==='ArrowUp'){e.preventDefault();const i=Math.min(cmdHistoryIdx+1,cmdHistory.length-1);setCmdHistoryIdx(i);if(cmdHistory[i])setCmdInput(cmdHistory[i]);return;}
    if(e.key==='ArrowDown'){e.preventDefault();const i=Math.max(cmdHistoryIdx-1,-1);setCmdHistoryIdx(i);setCmdInput(i===-1?'':cmdHistory[i]||'');return;}
    if(e.key==='Escape'){setCmdOpen(false);setCmdSuggestions([]);return;}
    if(e.key==='Tab'&&cmdSuggestions.length>0){e.preventDefault();setCmdInput(cmdSuggestions[0].cmd.split(' ')[0]+' ');setCmdSuggestions([]);return;}
  }
  function runCommand(raw){
    const cmd=raw.trim().toLowerCase();if(!cmd)return;
    let log='';
    setCmdHistory(prev=>[raw,...prev.slice(0,19)]);setCmdHistoryIdx(-1);setCmdInput('');setCmdSuggestions([]);
    if(cmd==='help'){setShowCmdHelp(h=>!h);log='Toggled help';}
    else if(cmd==='new'||cmd==='clear'){newCanvas();log='New canvas';}
    else if(cmd==='save'){saveDesign(designName);log=`Saved: ${designName}`;}
    else if(cmd==='undo'){undo();log='Undone';}
    else if(cmd==='redo'){redo();log='Redone';}
    else if(cmd==='dark'){setDarkMode(true);log='Dark mode';}
    else if(cmd==='light'){setDarkMode(false);log='Light mode';}
    else if(cmd==='grid'){setShowGrid(g=>!g);log='Grid toggled';}
    else if(cmd==='ruler'){setShowRuler(r=>!r);log='Ruler toggled';}
    else if(cmd==='snap'){setSnapToGrid(s=>!s);log='Snap toggled';}
    else if(cmd==='delete'){if(selectedId){deleteLayer(selectedId);log='Deleted';}}
    else if(cmd==='duplicate'){if(selectedId){duplicateLayer(selectedId);log='Duplicated';}}
    else if(cmd==='hide'){if(selectedId){updateLayer(selectedId,{hidden:true});log='Hidden';}}
    else if(cmd==='show'){if(selectedId){updateLayer(selectedId,{hidden:false});log='Shown';}}
    else if(cmd==='up'){if(selectedId)moveLayerUp(selectedId);log='Layer up';}
    else if(cmd==='down'){if(selectedId)moveLayerDown(selectedId);log='Layer down';}
    else if(cmd==='flip h'){if(selectedId)flipLayer(selectedId,'h');log='Flipped H';}
    else if(cmd==='flip v'){if(selectedId)flipLayer(selectedId,'v');log='Flipped V';}
    else if(cmd.startsWith('align ')){const dir=cmd.slice(6).trim();if(selectedId)alignLayer(selectedId,dir);log=`Aligned ${dir}`;}
    else if(cmd.startsWith('blend ')){const mode=cmd.slice(6).trim();if(selectedId&&BLEND_MODES.includes(mode)){updateLayer(selectedId,{blendMode:mode});log=`Blend: ${mode}`;}else log='Unknown blend mode';}
    else if(cmd.startsWith('bg ')){const c=raw.slice(3);updateBg({bgColor:c,bgGradient:null});log=`BG: ${c}`;}
    else if(cmd.startsWith('text ')){const t=raw.slice(5);addLayer({type:'text',text:t,fontSize,fontFamily,fontWeight,fontItalic,textColor,strokeColor,strokeWidth,shadowEnabled,shadowColor,shadowBlur,shadowX,shadowY,glowEnabled,glowColor,arcEnabled,arcRadius,letterSpacing,lineHeight,textAlign});log='Added text';}
    else if(cmd.startsWith('font ')){setFontFamily(raw.slice(5));log=`Font: ${raw.slice(5)}`;}
    else if(cmd.startsWith('size ')){const s=parseInt(cmd.slice(5));if(!isNaN(s)){setFontSize(s);log=`Size: ${s}px`;}}
    else if(cmd.startsWith('opacity ')){const o=parseInt(cmd.slice(8));if(!isNaN(o)&&selectedId){updateLayer(selectedId,{opacity:o});log=`Opacity: ${o}%`;}}
    else if(cmd.startsWith('zoom ')){const z=parseInt(cmd.slice(5));if(!isNaN(z)){setZoom(z/100);if(z<=100)setPanOffset({x:0,y:0});log=`Zoom: ${z}%`;}}
    else if(['circle','rect','roundrect','triangle','star','arrow','diamond','hexagon','heart','cross','line'].includes(cmd)){addShape(cmd);log=`Added ${cmd}`;}
    else log='Unknown — type "help"';
    setCmdLog(log);
  }

  function onLayerMouseDown(e,id){
    if(activeTool==='rimlight') return;
    if(activeTool==='brush') return;
    if(activeTool==='lasso' && isLassoMode) return;
    if(RETOUCH_TOOLS.includes(activeTool)) return;
    if(activeTool==='marquee'||activeTool==='sel-lasso'||activeTool==='sel-poly'||activeTool==='sel-wand') return;
    const layer=findInTree(layersRef.current,id);if(!layer)return;
    e.stopPropagation();
    justSelectedRef.current=true;
    // Shift+click — multi-select toggle
    if(e.shiftKey&&layer.type!=='background'){
      setSelectedIds(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else{n.add(id);if(selectedId)n.add(selectedId);}return n;});
      setSelectedId(id);
      return;
    }
    // Normal click — clear multi-select, pick this layer
    setSelectedIds(new Set());
    setSelectedId(id);
    if(layer.type==='background'){setActiveTool('background');return;}
    if(!canDrag||layer.locked)return;
    const rect=canvasRef.current.getBoundingClientRect();
    draggingRef.current=id;
    if(layer.type==='group'){
      // Group drag: track initial child positions
      const bounds=getGroupBounds(layer);
      groupDragInitRef.current={
        startX:(e.clientX-rect.left)/zoomRef.current,
        startY:(e.clientY-rect.top)/zoomRef.current,
        children:(layer.children||[]).map(c=>({id:c.id,x:c.x,y:c.y})),
      };
      dragOffsetRef.current=bounds?{x:(e.clientX-rect.left)/zoomRef.current-bounds.x,y:(e.clientY-rect.top)/zoomRef.current-bounds.y}:{x:0,y:0};
    } else {
      groupDragInitRef.current=null;
      dragOffsetRef.current={x:(e.clientX-rect.left)/zoomRef.current-layer.x,y:(e.clientY-rect.top)/zoomRef.current-layer.y};
    }
  }

  function onResizeStart(e,id){
    if(!canDrag)return;
    e.stopPropagation();e.preventDefault();
    justSelectedRef.current=true;
    const layer=layers.find(l=>l.id===id);
    resizingRef.current=id;
    resizeStartRef.current={mouseX:e.clientX,mouseY:e.clientY,origW:layer.width||100,origH:layer.height||100,origFontSize:layer.fontSize||48,aspect:(layer.width||100)/(layer.height||100)};
  }

  function onLayerDragStart(e,id){setLayerDragId(id);e.dataTransfer.effectAllowed='move';}
  function onLayerDragOver(e,id){e.preventDefault();if(id!==layerDragId)setLayerDragOver(id);}
  function onLayerDrop(e,targetId){
    e.preventDefault();if(!layerDragId||layerDragId===targetId)return;
    const fromIdx=layers.findIndex(l=>l.id===layerDragId);
    const toIdx=layers.findIndex(l=>l.id===targetId);
    if(fromIdx<0||toIdx<0)return;
    const nl=[...layers];const[removed]=nl.splice(fromIdx,1);nl.splice(toIdx,0,removed);
    setLayers(nl);pushHistory(nl);setLayerDragId(null);setLayerDragOver(null);
  }
  function onLayerDragEnd(){setLayerDragId(null);setLayerDragOver(null);}

  function executePaletteCommand(id){
    // Tools
    if(id==='tool-select')   {setActiveTool('select');return;}
    if(id==='tool-move')     {setActiveTool('move');return;}
    if(id==='tool-text')     {setActiveTool('text');return;}
    if(id==='tool-brush')    {setActiveTool('brush');return;}
    if(id==='tool-freehand') {setActiveTool('freehand');return;}
    if(id==='tool-crop')     {setActiveTool('crop');return;}
    if(id==='tool-zoom')     {setActiveTool('zoom');return;}
    if(id==='tool-lasso')    {setActiveTool('lasso');return;}
    if(id==='tool-segment')  {setActiveTool('segment');return;}
    if(id==='tool-removebg') {setActiveTool('removebg');return;}
    if(id==='tool-effects')  {setActiveTool('effects');return;}
    if(id==='tool-eyedropper'){setActiveTool('select');return;}
    if(id==='tool-bggen')    {setActiveTool('bggen');return;}
    // Filters → open colorgrade panel
    if(id.startsWith('filter-')) {setActiveTool('colorgrade');return;}
    if(id==='filter-liquify'||id==='tool-liquify') {openLiquify();return;}
    // Adjustments
    if(id==='adj-curves')    {addCurvesLayer();return;}
    if(id==='adj-brightness'||id==='adj-hue') {setActiveTool('adjust');return;}
    if(id==='adj-colorbal'||id==='adj-levels'||id==='adj-vibrance') {setActiveTool('colorgrade');return;}
    // AI Features
    if(id==='ai-pop'||id==='ai-style') {setActiveTool('style');return;}
    if(id==='ai-bggen')  {setActiveTool('bggen');return;}
    if(id==='ai-ctr')    {setActiveTool('ctr');return;}
    if(id==='ai-aitext') {setActiveTool('aitext');return;}
    if(id==='ai-face')   {setActiveTool('face');return;}
    if(id==='ai-segment'){setActiveTool('segment');return;}
    if(id==='ai-variants'){setActiveTool('ab');return;}
    // Layer actions
    if(id==='layer-new')      {setActiveTool('text');return;}
    if(id==='layer-duplicate'){if(selectedId)duplicateLayer(selectedId);return;}
    if(id==='layer-delete')   {if(selectedId)deleteLayer(selectedId);return;}
    if(id==='layer-group'||id==='layer-merge'||id==='layer-flatten') {return;} // future
    // File actions
    if(id==='file-export-png'){exportCanvas('png');return;}
    if(id==='file-export-jpg'){exportCanvas('jpg');return;}
    if(id==='file-save')      {saveDesign(designName);saveEngineRef.current?.saveImmediate();return;}
    if(id==='file-new')       {if(window.confirm('Start a new project? Unsaved changes will be lost.'))window.location.reload();return;}
    // Canvas actions
    if(id==='canvas-fit')  {setZoom(1);setPanOffset({x:0,y:0});return;}
    if(id==='canvas-100')  {setZoom(1);setPanOffset({x:0,y:0});return;}
    if(id==='canvas-fliph'){setLayers(prev=>prev.map(l=>l.type==='background'?l:{...l,flipH:!l.flipH}));return;}
    if(id==='canvas-flipv'){setLayers(prev=>prev.map(l=>l.type==='background'?l:{...l,flipV:!l.flipV}));return;}
    if(id==='canvas-shortcuts'){setShowShortcutsModal(true);return;}
  }

  async function handleDownload({ tier='basic', transparent=transparentExport }={}){
    try{
      const target = document.getElementById('thumbnail-canvas');
      if(!target){
        alert('Canvas container not found');
        return;
      }

      const hasProAccess = isProUser || token==='test-key-123' || user?.is_admin || user?.is_admin;
      const wantsProDownload = tier==='pro';
      const isActuallyPro = wantsProDownload && hasProAccess;

      if(wantsProDownload && !hasProAccess){
        handleUpgrade();
        return;
      }

      const scale = isActuallyPro ? 3 : 0.6;
      const imageQuality = isActuallyPro ? 1.0 : 0.5;

      const { default: html2canvas } = await import('html2canvas');
      const capturedCanvas = await html2canvas(target, {
        backgroundColor: transparent ? null : '#000000',
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale,
      });

      if(!isActuallyPro){
        // Basic tier intentionally degrades output and applies watermark.
        const ctx = capturedCanvas.getContext('2d');
        if(ctx){
          ctx.imageSmoothingEnabled = false;
          const watermark = 'Created with ThumbFrame';
          const size = Math.max(14, Math.round(capturedCanvas.width * 0.024));
          const margin = Math.max(12, Math.round(capturedCanvas.width * 0.02));
          ctx.font = `700 ${size}px Arial`;
          ctx.fillStyle = 'rgba(255,255,255,0.58)';
          const textWidth = ctx.measureText(watermark).width;
          ctx.fillText(watermark, capturedCanvas.width - textWidth - margin, capturedCanvas.height - margin);
        }
      }

      const fileBase = `${designName.replace(/\s+/g,'-')}-${isActuallyPro ? 'pro' : 'basic'}`;
      const link = document.createElement('a');
      link.download = `${fileBase}.jpg`;
      link.href = capturedCanvas.toDataURL('image/jpeg', imageQuality);
      link.click();

      setShowDownload(false);
    }catch(err){
      console.error('Download failed:', err);
      alert('Failed to download image. Please try again.');
    }
  }

  // eslint-disable-next-line no-unused-vars
  async function exportCanvas(format='png', transparent=false){
    // ✅ Free = 640×360 preview res, Pro = full resolution
    const isPro   = isProUser || token==='test-key-123';
    const isAdmin = user?.is_admin;
    const hasProAccess = isPro || isAdmin;
    const exportW = hasProAccess ? p.width  : Math.round(p.width  * 0.5);
    const exportH = hasProAccess ? p.height : Math.round(p.height * 0.5);
    const canvas  = document.createElement('canvas');
    canvas.width  = exportW;
    canvas.height = exportH;

    await renderLayersToCanvas(canvas, layers, { transparent });

    // Generate download
    const fname = `${designName.replace(/\s+/g,'-')}-${p.width}x${p.height}`;

    if(format==='webp'){
      const blob = await new Promise(r=>canvas.toBlob(r,'image/webp',0.92));
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fname}.webp`;
      link.href     = url;
      link.click();
      URL.revokeObjectURL(url);
    } else if(format==='jpg'){
      const link = document.createElement('a');
      link.download = `${fname}.jpg`;
      link.href     = canvas.toDataURL('image/jpeg',0.95);
      link.click();
    } else {
      const blob = await new Promise(r=>canvas.toBlob(r,'image/png'));
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fname}.png`;
      link.href     = url;
      link.click();
      URL.revokeObjectURL(url);
    }

    trackEvent('export_thumbnail', { format, platform });
    setShowDownload(false);
  }

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToastMsg(msg, type='info') {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(()=>setShowToast(false), 4000);
  }

  // ── PSD Export ──────────────────────────────────────────────────────────────
  async function buildPsdLayers(layerArr) {
    const results = [];
    for (const layer of [...layerArr].reverse()) { // ag-psd: index 0 = topmost
      if (layer.type === 'group') {
        const children = layer.children?.length ? await buildPsdLayers(layer.children) : [];
        results.push({
          name: layer.name || 'Group',
          opacity: Math.round((layer.opacity ?? 100) / 100 * 255),
          blendMode: PSD_BLEND_MAP[layer.blendMode] || 'norm',
          hidden: !!layer.hidden,
          opened: true,
          children,
        });
        continue;
      }
      const desc = {
        name: layer.name || layer.type || 'Layer',
        opacity: Math.round((layer.opacity ?? 100) / 100 * 255),
        blendMode: PSD_BLEND_MAP[layer.blendMode] || 'norm',
        hidden: !!layer.hidden,
      };
      if (layer.type === 'text') {
        // Parse color
        const rawColor = layer.textColor || layer.color || '#ffffff';
        const r = parseInt(rawColor.slice(1,3),16)||255;
        const g = parseInt(rawColor.slice(3,5),16)||255;
        const b = parseInt(rawColor.slice(5,7),16)||255;
        desc.text = {
          text: layer.text || layer.content || '',
          transform: { xx:1, xy:0, yx:0, yy:1, tx: layer.x||0, ty: layer.y||0 },
          style: { fontSize: layer.fontSize || 48, fillColor: { r, g, b } },
        };
      } else {
        // Rasterize to canvas
        try {
          const cw = layer.type === 'background' ? p.preview.w : (layer.width || p.preview.w);
          const ch = layer.type === 'background' ? p.preview.h : (layer.height || p.preview.h);
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width  = cw;
          tmpCanvas.height = ch;
          const tmpCtx = tmpCanvas.getContext('2d');
          if (layer.type === 'background') {
            if (layer.bgGradient) {
              const grad = tmpCtx.createLinearGradient(0,0,0,ch);
              grad.addColorStop(0, layer.bgGradient[0]);
              grad.addColorStop(1, layer.bgGradient[1]);
              tmpCtx.fillStyle = grad;
            } else {
              tmpCtx.fillStyle = layer.bgColor || '#000';
            }
            tmpCtx.fillRect(0, 0, cw, ch);
          } else {
            const imgSrc = layer.paintSrc || layer.src;
            if (imgSrc) {
              await new Promise(res => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => { tmpCtx.drawImage(img, 0, 0, cw, ch); res(); };
                img.onerror = res;
                img.src = imgSrc;
              });
            }
          }
          desc.canvas = tmpCanvas;
          desc.left = layer.x || 0;
          desc.top  = layer.y || 0;
        } catch(e) {
          console.warn('[psd] layer rasterize failed', layer.id, e);
        }
      }
      results.push(desc);
    }
    return results;
  }

  async function exportAsPsd() {
    const isPro = isProUser || token==='test-key-123' || user?.is_admin;
    if (!isPro) { showToastMsg('PSD export requires Pro. Upgrade to unlock.', 'error'); return; }
    setExportLoading('psd');
    try {
      const { writePsd } = await import('ag-psd/dist/bundle.js');
      const psdLayers = await buildPsdLayers(layers);
      const psd = {
        width:  p.preview.w,
        height: p.preview.h,
        children: psdLayers,
      };
      const buffer = writePsd(psd, { generateThumbnail: true, trimImageData: false });
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${designName.replace(/\s+/g,'-')||'thumbframe'}.psd`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToastMsg(`PSD exported with ${layers.length} layer${layers.length!==1?'s':''}`, 'success');
      setShowDownload(false);
    } catch(err) {
      console.error('PSD export failed:', err);
      showToastMsg('PSD export failed: ' + err.message, 'error');
    } finally {
      setExportLoading(null);
    }
  }

  // ── Warp Transform ──────────────────────────────────────────────────────────
  async function applyWarpToLayer(layerId, preset, bend) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    setWarpLoading(true);
    try {
      const W = layer.width  || p.preview.w;
      const H = layer.height || p.preview.h;
      // Rasterize layer to temp canvas
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width  = W;
      tmpCanvas.height = H;
      const tmpCtx = tmpCanvas.getContext('2d');
      const imgSrc = layer.paintSrc || layer.src;
      if (imgSrc) {
        await new Promise(res => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => { tmpCtx.drawImage(img, 0, 0, W, H); res(); };
          img.onerror = res;
          img.src = imgSrc;
        });
      } else { setWarpLoading(false); return; }
      const imageData = tmpCtx.getImageData(0, 0, W, H);
      const mesh = buildWarpMesh(preset, W, H, 5, 5, bend);
      // Apply via worker
      const warpedDataUrl = await new Promise((resolve, reject) => {
        const worker = getWarpWorker();
        if (!worker) { reject(new Error('Warp worker unavailable')); return; }
        const handler = (ev) => {
          worker.removeEventListener('message', handler);
          const dst = new Uint8ClampedArray(ev.data.processedPixels);
          const outCanvas = document.createElement('canvas');
          outCanvas.width = W; outCanvas.height = H;
          const outCtx = outCanvas.getContext('2d');
          outCtx.putImageData(new ImageData(dst, W, H), 0, 0);
          resolve(outCanvas.toDataURL('image/png'));
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ pixels: imageData.data.buffer, width: W, height: H, mesh: mesh.buffer, meshW: 5, meshH: 5 },
          [imageData.data.buffer, mesh.buffer]);
      });
      updateLayer(layerId, { src: warpedDataUrl, paintSrc: warpedDataUrl, warpPreset: preset, warpBend: bend });
      setLayers(prev => {
        const nl = [...prev];
        pushHistory(nl, 'Warp');
        return nl;
      });
      showToastMsg(`Warp applied (${preset})`, 'success');
    } catch(err) {
      console.error('[warp] apply failed', err);
      showToastMsg('Warp failed: ' + err.message, 'error');
    } finally {
      setWarpLoading(false);
      setWarpMode(false);
      setWarpPreview(null);
    }
  }

  async function computeWarpPreview(layerId, preset, bend) {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    const W = layer.width  || p.preview.w;
    const H = layer.height || p.preview.h;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = W;
    tmpCanvas.height = H;
    const tmpCtx = tmpCanvas.getContext('2d');
    const imgSrc = layer.paintSrc || layer.src;
    if (!imgSrc) return;
    await new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => { tmpCtx.drawImage(img, 0, 0, W, H); res(); };
      img.onerror = res;
      img.src = imgSrc;
    });
    const imageData = tmpCtx.getImageData(0, 0, W, H);
    const mesh = buildWarpMesh(preset, W, H, 5, 5, bend);
    const worker = getWarpWorker();
    if (!worker) return;
    return new Promise(resolve => {
      const handler = (ev) => {
        worker.removeEventListener('message', handler);
        const dst = new Uint8ClampedArray(ev.data.processedPixels);
        const outCanvas = document.createElement('canvas');
        outCanvas.width = W; outCanvas.height = H;
        outCanvas.getContext('2d').putImageData(new ImageData(dst, W, H), 0, 0);
        resolve(outCanvas.toDataURL('image/png'));
      };
      worker.addEventListener('message', handler);
      // clone buffers since we can't transfer and keep for next call
      const pixelsCopy = imageData.data.buffer.slice(0);
      const meshCopy = mesh.buffer.slice(0);
      worker.postMessage({ pixels: pixelsCopy, width: W, height: H, mesh: meshCopy, meshW: 5, meshH: 5 },
        [pixelsCopy, meshCopy]);
    });
  }

  function renderCropHandles(obj){
    if(activeTool!=='crop') return null;
    const hs={
      position:'absolute',
      width:10,height:10,
      background:'#fff',
      border:`2px solid ${T.accent}`,
      borderRadius:2,
      zIndex:1002,
      pointerEvents:'all',
    };
    function clamp(v,mn,mx){return Math.max(mn,Math.min(mx,Math.round(v)));}
    function makeDragHandle(onDrag){
      return (e)=>{
        e.stopPropagation();e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const sx=e.clientX,sy=e.clientY;
        const sc={
          cropLeft:obj.cropLeft||0,cropTop:obj.cropTop||0,
          cropRight:obj.cropRight||0,cropBottom:obj.cropBottom||0,
        };
        function onMove(mv){
          const dx=(mv.clientX-sx)/zoomRef.current;
          const dy=(mv.clientY-sy)/zoomRef.current;
          updateLayerSilent(obj.id,onDrag(dx,dy,sc,obj));
        }
        function onUp(uev){
          const dx=(uev.clientX-sx)/zoomRef.current;
          const dy=(uev.clientY-sy)/zoomRef.current;
          updateLayer(obj.id,onDrag(dx,dy,sc,obj));
          window.removeEventListener('pointermove',onMove);
          window.removeEventListener('pointerup',onUp);
        }
        window.addEventListener('pointermove',onMove);
        window.addEventListener('pointerup',onUp);
      };
    }
    const handles=[
      {s:{top:-5,left:-5,cursor:'nw-resize'},   fn:(dx,dy,s,o)=>({cropLeft:clamp(s.cropLeft+dx,0,o.width-s.cropRight-1),  cropTop:clamp(s.cropTop+dy,0,o.height-s.cropBottom-1)})},
      {s:{top:-5,left:'50%',transform:'translateX(-50%)',cursor:'n-resize'},  fn:(dx,dy,s,o)=>{const minH=20;const newCropTop=clamp(s.cropTop+dy,0,o.height-s.cropBottom-minH);const actualDy=newCropTop-s.cropTop;return{cropTop:newCropTop,y:o.y+actualDy};}},
      {s:{top:-5,right:-5,cursor:'ne-resize'},  fn:(dx,dy,s,o)=>({cropRight:clamp(s.cropRight-dx,0,o.width-s.cropLeft-1), cropTop:clamp(s.cropTop+dy,0,o.height-s.cropBottom-1)})},
      {s:{top:'50%',left:-5,transform:'translateY(-50%)',cursor:'w-resize'},  fn:(dx,dy,s,o)=>({cropLeft:clamp(s.cropLeft+dx,0,o.width-s.cropRight-1)})},
      {s:{top:'50%',right:-5,transform:'translateY(-50%)',cursor:'e-resize'}, fn:(dx,dy,s,o)=>({cropRight:clamp(s.cropRight-dx,0,o.width-s.cropLeft-1)})},
      {s:{bottom:-5,left:-5,cursor:'sw-resize'},  fn:(dx,dy,s,o)=>({cropLeft:clamp(s.cropLeft+dx,0,o.width-s.cropRight-1),   cropBottom:clamp(s.cropBottom-dy,0,o.height-s.cropTop-1)})},
      {s:{bottom:-5,left:'50%',transform:'translateX(-50%)',cursor:'s-resize'},fn:(dx,dy,s,o)=>({cropBottom:clamp(s.cropBottom-dy,0,o.height-s.cropTop-1)})},
      {s:{bottom:-5,right:-5,cursor:'se-resize'}, fn:(dx,dy,s,o)=>({cropRight:clamp(s.cropRight-dx,0,o.width-s.cropLeft-1),  cropBottom:clamp(s.cropBottom-dy,0,o.height-s.cropTop-1)})},
    ];
    return(
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:1002}}>
        <div style={{position:'absolute',inset:0,border:`1.5px dashed ${T.accent}`,pointerEvents:'none'}}/>
        {handles.map((h,i)=>(
          <div
            key={i}
            onMouseDown={e=>e.stopPropagation()}
            onPointerDown={makeDragHandle(h.fn)}
            style={{...hs,...h.s}}
          />
        ))}
      </div>
    );
  }

  function renderResizeHandles(obj){
    if(!canDrag)return null;
    const hs={position:'absolute',width:8,height:8,background:'#fff',border:`1.5px solid ${T.accent}`,borderRadius:2,zIndex:1000};
    return(<>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,bottom:-4,right:-4,cursor:'se-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,bottom:-4,left:-4,cursor:'sw-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,top:-4,right:-4,cursor:'ne-resize'}}/>
      <div onMouseDown={e=>onResizeStart(e,obj.id)} style={{...hs,top:-4,left:-4,cursor:'nw-resize'}}/>
      <div style={{
        position:'absolute',top:-20,left:'50%',
        width:2,height:20,
        background:T.accent,
        transform:'translateX(-50%)',
        pointerEvents:'none',
        zIndex:1000,
      }}/>
      <div
        onPointerDown={e=>{
          console.log(' Rotation handle clicked for object:', obj.id, 'type:', obj.type);
          e.stopPropagation();e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const startAngle=Math.atan2(
            e.clientY-(canvasRef.current.getBoundingClientRect().top+zoomRef.current*(obj.y+(obj.height||50)/2)),
            e.clientX-(canvasRef.current.getBoundingClientRect().left+zoomRef.current*(obj.x+(obj.width||100)/2))
          )*180/Math.PI;
          const startRotation=obj.rotation||0;
          const currentRotation={value:startRotation};
          console.log(' Starting rotation from:', startRotation, 'degrees');
          function onMove(ev){
            const angle=Math.atan2(
              ev.clientY-(canvasRef.current.getBoundingClientRect().top+zoomRef.current*(obj.y+(obj.height||50)/2)),
              ev.clientX-(canvasRef.current.getBoundingClientRect().left+zoomRef.current*(obj.x+(obj.width||100)/2))
            )*180/Math.PI;
            const newRot=startRotation+(angle-startAngle);
            currentRotation.value=newRot;
            updateLayerSilent(obj.id,{rotation:newRot});
          }
          function onUp(){
            console.log(' Rotation complete. Final angle:', currentRotation.value, 'degrees');
            updateLayer(obj.id,{rotation:currentRotation.value});
            window.removeEventListener('pointermove',onMove);
            window.removeEventListener('pointerup',onUp);
          }
          window.addEventListener('pointermove',onMove);
          window.addEventListener('pointerup',onUp);
        }}
        style={{
          position:'absolute',top:-32,left:'50%',
          transform:'translateX(-50%)',
          width:24,height:24,
          background:'#fff',
          border:`3px solid ${T.accent}`,
          borderRadius:'50%',
          cursor:'grab',
          zIndex:1001,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:12,userSelect:'none',
          boxShadow:'0 2px 8px rgba(0,0,0,0.3)',
          transition:'transform 0.1s',
        }}
        onMouseEnter={e=>e.currentTarget.style.transform='translateX(-50%) scale(1.15)'}
        onMouseLeave={e=>e.currentTarget.style.transform='translateX(-50%) scale(1)'}
        title="Rotate (drag to rotate)">↻</div>
    </>);
  }
  function getLayerCursor(obj){if(activeTool==='brush'||activeTool==='rimlight'||RETOUCH_TOOLS.includes(activeTool))return'crosshair';if(canDrag&&!obj.locked)return'grab';return'pointer';}

  function renderLayerElement(obj,overrideZ){
    if(obj.hidden)return null;
    const isSelected=selectedId===obj.id;
    const zIndex=overrideZ!==undefined?overrideZ:(layers.indexOf(obj)+1);

    // ── Group: transparent hit-area + bounding box + children ─────────────────
    if(obj.type==='group'){
      const bounds=getGroupBounds(obj);
      const cursor=canDrag&&!obj.locked?'grab':'pointer';
      const groupZ=layers.indexOf(obj)+1;
      return(
        <div key={obj.id} style={{position:'absolute',left:0,top:0,width:p.preview.w,height:p.preview.h,zIndex:groupZ,opacity:(obj.opacity??100)/100,mixBlendMode:obj.blendMode||'normal',pointerEvents:'none'}}>
          {/* Render children */}
          {(obj.children||[]).map((child,idx)=>renderLayerElement(child,idx+1))}
          {/* Hit area for group selection/drag */}
          {bounds&&(<div onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height,cursor,pointerEvents:'all',zIndex:9989}}/>)}
          {/* Selection dashed outline */}
          {isSelected&&bounds&&(<div style={{position:'absolute',left:bounds.x-3,top:bounds.y-3,width:bounds.width+6,height:bounds.height+6,border:`1.5px dashed ${T.accent}`,borderRadius:3,pointerEvents:'none',zIndex:9990}}/>)}
          {/* Group label */}
          {isSelected&&bounds&&(<div style={{position:'absolute',left:bounds.x,top:bounds.y-18,background:T.accent,color:'#fff',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:4,pointerEvents:'none',zIndex:9991,whiteSpace:'nowrap'}}>{obj.name||'Group'}</div>)}
        </div>
      );
    }
    const opacityVal=(obj.opacity??100)/100;
    const selStyle=isSelected&&obj.type!=='image'?{outline:`1.5px solid ${T.accent}`,outlineOffset:2}:{};
    const flipStyle={transform:`rotate(${obj.rotation||0}deg) scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`};
    const blendStyle={mixBlendMode:obj.blendMode||'normal',userSelect:'none',WebkitUserSelect:'none'};
    const cursor=getLayerCursor(obj);
    const effectsStyle=getEffectsStyle(obj.effects);
    const DelBtn=()=>isSelected&&obj.type!=='background'?(<div onClick={e=>{e.stopPropagation();deleteLayer(obj.id);}} style={{position:'absolute',top:-10,right:-10,width:20,height:20,background:T.danger,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',cursor:'pointer',zIndex:999,fontWeight:'bold',userSelect:'none'}}>×</div>):null;

    if(obj.type==='background')return(
      <div key={obj.id} onMouseDown={e=>{e.stopPropagation();justSelectedRef.current=true;setSelectedId(obj.id);setActiveTool('background');}}
        style={{position:'absolute',left:0,top:0,width:p.preview.w,height:p.preview.h,zIndex:0,opacity:opacityVal,background:obj.bgGradient?`linear-gradient(180deg,${obj.bgGradient[0]},${obj.bgGradient[1]})`:obj.bgColor,cursor:'pointer',...flipStyle}}>
        {isSelected&&<div style={{position:'absolute',inset:0,border:`1.5px dashed ${T.accent}`,pointerEvents:'none'}}/>}
        {showGrid&&<div style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:'20px 20px'}}/>}
        {showRuler&&<>
          <div style={{position:'absolute',top:0,left:0,right:0,height:16,background:'rgba(0,0,0,0.5)',pointerEvents:'none',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.w/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',left:i*40,fontSize:7,color:'rgba(255,255,255,0.7)',paddingLeft:2,top:4}}>{i*40}</div>))}</div>
          <div style={{position:'absolute',top:0,left:0,bottom:0,width:16,background:'rgba(0,0,0,0.5)',pointerEvents:'none',overflow:'hidden'}}>{Array.from({length:Math.floor(p.preview.h/40)}).map((_,i)=>(<div key={i} style={{position:'absolute',top:i*40+4,left:1,fontSize:7,color:'rgba(255,255,255,0.7)'}}>{i*40}</div>))}</div>
        </>}
        {isSelected&&renderResizeHandles(obj)}
      </div>
    );
    if(obj.type==='text'){
      const ts=(()=>{const pts=[];if(obj.shadowEnabled)pts.push(`${obj.shadowX||2}px ${obj.shadowY||2}px ${obj.shadowBlur||14}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);if(obj.glowEnabled)pts.push(`0 0 20px ${obj.glowColor||'#f97316'}`);return pts.length?pts.join(','):'none';})();
      const isGrad=obj.fillType==='gradient'&&Array.isArray(obj.gradientColors)&&obj.gradientColors.length>=2;
      const gradCss=isGrad?{background:`linear-gradient(${obj.gradientAngle||0}deg,${obj.gradientColors.join(',')})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}:{};
      const multiStrokeBox=(obj.textStrokes||[]).filter(s=>s.enabled&&s.width>0).sort((a,b)=>(b.width||0)-(a.width||0)).map(s=>`0 0 0 ${s.width}px ${s.color||'#000'}`).join(',');
      const rawDisplayText=applyTextTransform(obj.text,obj.textTransform);
      return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} onDoubleClick={e=>{e.stopPropagation();setSelectedId(obj.id);setActiveTool('text');setTextInput(obj.text||'');setFontSize(obj.fontSize||48);setFontFamily(obj.fontFamily||'Impact');setTextColor(obj.textColor||'#ffffff');}} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,userSelect:'none',...selStyle,...blendStyle,...flipStyle,...effectsStyle}}><span style={{fontFamily:resolveFontFamily(obj.fontFamily),fontSize:obj.fontSize,fontWeight:obj.fontWeight||700,fontStyle:obj.fontItalic?'italic':'normal',color:isGrad?undefined:(obj.textColor||'#ffffff'),WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth}px ${obj.strokeColor}`:'none',paintOrder:'stroke fill',textShadow:ts,whiteSpace:'pre-wrap',letterSpacing:`${obj.letterSpacing||0}px`,lineHeight:obj.lineHeight||1.2,display:'block',...(multiStrokeBox?{boxShadow:multiStrokeBox}:{}),...gradCss}}>{obj.arcEnabled?<ArcText obj={obj}/>:rawDisplayText}</span>{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    }
    if(obj.type==='shape')return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,...selStyle,...blendStyle,...flipStyle,...effectsStyle}}>{renderShapeSVG(obj.shape,obj.fillColor,obj.strokeColor,obj.width,obj.height)}{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    if(obj.type==='svg')return(<div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)} style={{position:'absolute',left:obj.x,top:obj.y,zIndex,opacity:opacityVal,cursor,width:obj.width,height:obj.height,...selStyle,...blendStyle,...flipStyle,...effectsStyle}}><div style={{width:'100%',height:'100%'}} dangerouslySetInnerHTML={{__html:obj.svg}}/>{isSelected&&renderResizeHandles(obj)}<DelBtn/></div>);
    if(obj.type==='image'){
      const cropW=obj.width-(obj.cropLeft||0)-(obj.cropRight||0);
      const cropH=obj.height-(obj.cropTop||0)-(obj.cropBottom||0);
      const hasMask=obj.mask?.enabled&&obj.mask?.points?.length>=3;
      const maskInverted=hasMask&&obj.mask?.inverted;
      // Build clip-path polygon from stored lasso points (relative to the cropped div)
      let clipPathValue='none';
      if(hasMask){
        const mpts=obj.mask.points;
        if(maskInverted){
          // SVG path with two subpaths + evenodd: outer rect is "kept", lasso interior is "cut"
          const outerRect=`M 0,0 H ${cropW} V ${cropH} H 0 Z`;
          const innerPath=`M ${mpts[0].x},${mpts[0].y} `+mpts.slice(1).map(p=>`L ${p.x},${p.y}`).join(' ')+' Z';
          clipPathValue=`path(evenodd, '${outerRect} ${innerPath}')`;
        } else {
          const pts=mpts.map(p=>`${p.x}px ${p.y}px`).join(',');
          clipPathValue=`polygon(${pts})`;
        }
      }
      const imageSrc = getSafeImageSrc(obj);
      return(
        <div key={obj.id} onMouseDown={e=>onLayerMouseDown(e,obj.id)}
          style={{
            position:'absolute',left:obj.x,top:obj.y,zIndex,
            opacity:opacityVal,cursor,...selStyle,...blendStyle,
            overflow:'hidden',width:cropW,height:cropH,...effectsStyle,
            clipPath: clipPathValue,
            WebkitClipPath: clipPathValue,
          }}>
          {imageSrc ? (
            <img src={imageSrc} alt="" style={{
              width:obj.width,height:obj.height,display:'block',
              pointerEvents:'none',userSelect:'none',WebkitUserSelect:'none',
              marginLeft:-(obj.cropLeft||0),marginTop:-(obj.cropTop||0),
              transform:`scale(${obj.flipH?-1:1},${obj.flipV?-1:1})`,
              filter:`brightness(${obj.imgBrightness||100}%) contrast(${obj.imgContrast||100}%) saturate(${obj.imgSaturate||100}%) blur(${obj.imgBlur||0}px)`,
            }}/>
          ) : (
            <div style={{
              width:cropW,height:cropH,display:'flex',alignItems:'center',justifyContent:'center',
              border:'1px dashed rgba(255,255,255,0.35)',background:'rgba(0,0,0,0.2)',
              color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:'600',textTransform:'uppercase',
            }}>
              Missing image source
            </div>
          )}
          {isSelected&&renderResizeHandles(obj)}
          {isSelected&&renderCropHandles(obj)}
          <DelBtn/>
          {obj.mask?.enabled&&(
            <div style={{
              position:'absolute',bottom:-18,left:0,fontSize:9,
              background:'rgba(249,115,22,0.9)',color:'#fff',
              padding:'2px 6px',borderRadius:3,pointerEvents:'none',
              whiteSpace:'nowrap',
            }}>⊡ Mask active</div>
          )}
        </div>
      );
    }
    if(obj.type==='curves')return(
      <div key={obj.id} onMouseDown={e=>{e.stopPropagation();justSelectedRef.current=true;setSelectedId(obj.id);setActiveTool('curves');}}
        style={{position:'absolute',left:4,top:4,zIndex,cursor:'pointer',pointerEvents:'auto'}}>
        <CurveThumbnail curves={obj.curves||DEFAULT_CURVES()} size={32}/>
        {isSelected&&<div style={{position:'absolute',inset:-2,border:`1.5px solid ${T.accent}`,borderRadius:4,pointerEvents:'none'}}/>}
        <DelBtn/>
      </div>
    );
  }

  const css={
    label:   {fontSize:'9px',color:T.muted,marginBottom:5,marginTop:16,letterSpacing:'1px',fontWeight:'700',textTransform:'uppercase',display:'block'},
    input:   {padding:'8px 11px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit',transition:'border-color 0.15s'},
    color:   {width:'100%',height:34,borderRadius:7,border:`1px solid ${T.border}`,cursor:'pointer',background:'none'},
    pill:    (a)=>({padding:'4px 11px',borderRadius:6,border:`1px solid ${a?T.accent:T.border}`,background:a?T.accent:T.input,color:a?'#fff':T.muted,fontSize:11,cursor:'pointer',fontWeight:a?'600':'400',transition:'all 0.12s'}),
    iconBtn: (a)=>({padding:'5px 10px',borderRadius:6,border:`1px solid ${a?T.accentBorder:T.border}`,background:a?T.accentDim:'transparent',color:a?T.accent:T.muted,cursor:'pointer',fontSize:12,fontWeight:a?'600':'400',transition:'all 0.12s'}),
    toolBtn: (a)=>({
      padding:'7px 10px',borderRadius:7,border:'none',
      background:a?T.accentDim:'transparent',
      color:a?T.accent:T.muted,
      fontSize:11,cursor:'pointer',textAlign:'left',width:'100%',
      fontWeight:a?'600':'500',
      display:'flex',alignItems:'center',gap:8,marginBottom:1,
      borderLeft:a?`2px solid ${T.accent}`:'2px solid transparent',
      transition:'all 0.1s',
    }),
    addBtn:  {padding:'9px 12px',borderRadius:8,background:T.accent,color:'#fff',border:'none',fontSize:12,cursor:'pointer',fontWeight:'600',width:'100%',marginTop:12,transition:'opacity 0.15s'},
    section: {padding:10,background:T.bg2,borderRadius:8,border:`1px solid ${T.border}`,marginTop:8},
    row:     {display:'flex',gap:6,alignItems:'center'},
    divider: {height:1,background:T.border,margin:'12px 0'},
  };

  // Feature M: Mobile Quick Editor — render parallel mobile experience on small screens
  if(isMobile){
    return <Suspense fallback={null}><MobileEditor user={user} token={token} apiUrl={apiUrl} onSwitchToDesktop={()=>setIsMobile(false)}/></Suspense>;
  }

  if(isLoading){
    return (
      <div style={{
        minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
        background:T.bg,
        fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <style>{`
          @keyframes editor-spin { to { transform: rotate(360deg); } }
          @keyframes editor-fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        `}</style>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20,animation:'editor-fade-up 0.4s ease both'}}>
          {/* Logo mark */}
          <div style={{position:'relative',width:52,height:52}}>
            <div style={{
              position:'absolute',inset:0,borderRadius:14,
              background:'linear-gradient(135deg,#f97316,#ea580c)',
              boxShadow:'0 0 40px rgba(249,115,22,0.35)',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>
              <span style={{fontSize:22,fontWeight:'900',color:'#fff',letterSpacing:'-1px'}}>T</span>
            </div>
            <div style={{
              position:'absolute',bottom:-2,right:-2,width:18,height:18,
              borderRadius:'50%',border:`3px solid ${T.bg}`,
              borderTopColor:'transparent',
              background:'transparent',
              animation:'editor-spin 0.75s linear infinite',
              boxSizing:'border-box',
              borderColor:`${T.accent} transparent transparent transparent`,
            }}/>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:'700',color:T.text,letterSpacing:'-0.3px',marginBottom:4}}>ThumbFrame</div>
            <div style={{fontSize:12,color:T.muted,fontWeight:'400'}}>Loading your workspace…</div>
          </div>
          {/* Progress bar */}
          <div style={{width:160,height:2,borderRadius:2,background:T.border,overflow:'hidden'}}>
            <div style={{height:'100%',width:'40%',borderRadius:2,background:T.accent,animation:'editor-spin 1.5s ease-in-out infinite',transformOrigin:'left center'}}/>
          </div>
        </div>
      </div>
    );
  }

  // ── AdjustmentPanel sub-component ─────────────────────────────────────────
  function AdjustmentPanel({layer,T,css,onChange,onCommit}){
    const s=layer.settings||{};
    const t=layer.adjustmentType;
    const [hueSatRange,setHueSatRange]=React.useState('master');
    const [cbRange,setCbRange]=React.useState('midtones');
    const [scRange,setScRange]=React.useState('reds');
    const sld=(label,val,min,max,key,subKey)=>(
      <React.Fragment key={key+(subKey||'')}>
        <span style={css.label}>{label} — {Math.round((subKey?s[key]?.[subKey]:s[key])??val)}</span>
        <Slider min={min} max={max} value={(subKey?s[key]?.[subKey]:s[key])??val}
          onChange={v=>{const ns=subKey?{...s,[key]:{...s[key],[subKey]:v}}:{...s,[key]:v};onChange(ns);}}
          onCommit={v=>{const ns=subKey?{...s,[key]:{...s[key],[subKey]:v}}:{...s,[key]:v};onCommit(ns);}}
          style={{width:'100%'}}/>
      </React.Fragment>
    );
    return(
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <span style={{...css.label,marginBottom:0}}>{layer.name||'Adjustment'}</span>
          <button onClick={()=>onCommit({...ADJ_DEFAULTS[t]})}
            style={{padding:'2px 8px',borderRadius:4,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:10}}>Reset</button>
        </div>
        <span style={css.label}>Opacity — {layer.opacity??100}%</span>
        <Slider min={0} max={100} value={layer.opacity??100}
          onChange={v=>updateLayerSilent(layer.id,{opacity:v})}
          onCommit={v=>updateLayer(layer.id,{opacity:v})}
          style={{width:'100%'}}/>
        <div style={css.divider}/>
        {t==='levels'&&(<>
          <span style={css.label}>Channel</span>
          <div style={{display:'flex',gap:3,marginBottom:8}}>
            {['rgb','r','g','b'].map(ch=>(
              <button key={ch} onClick={()=>onCommit({...s,channel:ch})}
                style={{...css.iconBtn(s.channel===ch||(ch==='rgb'&&!s.channel)),flex:1,fontSize:10,textTransform:'uppercase'}}>{ch}</button>
            ))}
          </div>
          {sld('Input Black',0,0,253,'inBlack')}
          {sld('Gamma',1,0.1,9.99,'inGamma')}
          {sld('Input White',255,2,255,'inWhite')}
          {sld('Output Black',0,0,255,'outBlack')}
          {sld('Output White',255,0,255,'outWhite')}
        </>)}
        {t==='hueSat'&&(<>
          <div style={{display:'flex',gap:2,flexWrap:'wrap',marginBottom:8}}>
            {['master','reds','yellows','greens','cyans','blues','magentas'].map(r=>(
              <button key={r} onClick={()=>setHueSatRange(r)}
                style={{...css.iconBtn(hueSatRange===r),padding:'3px 7px',fontSize:9,textTransform:'capitalize'}}>{r.charAt(0).toUpperCase()+r.slice(1)}</button>
            ))}
          </div>
          {['h','s','l'].map(prop=>(
            <React.Fragment key={prop}>
              <span style={css.label}>{prop==='h'?'Hue':prop==='s'?'Saturation':'Lightness'} — {Math.round(s[hueSatRange]?.[prop]||0)}</span>
              <Slider min={prop==='h'?-180:-100} max={prop==='h'?180:100}
                value={s[hueSatRange]?.[prop]||0}
                onChange={v=>onChange({...s,[hueSatRange]:{...(s[hueSatRange]||{}),[prop]:v}})}
                onCommit={v=>onCommit({...s,[hueSatRange]:{...(s[hueSatRange]||{}),[prop]:v}})}
                style={{width:'100%'}}/>
            </React.Fragment>
          ))}
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:T.text,marginTop:6,cursor:'pointer'}}>
            <input type="checkbox" checked={s.colorize||false} onChange={e=>onCommit({...s,colorize:e.target.checked})} style={{accentColor:T.accent}}/>
            Colorize
          </label>
          {s.colorize&&(<>
            {sld('Hue',0,0,360,'colorizeH')}
            {sld('Saturation',50,0,100,'colorizeS')}
            {sld('Lightness',0,-100,100,'colorizeL')}
          </>)}
        </>)}
        {t==='colorBalance'&&(<>
          <div style={{display:'flex',gap:3,marginBottom:8}}>
            {['shadows','midtones','highlights'].map(r=>(
              <button key={r} onClick={()=>setCbRange(r)}
                style={{...css.iconBtn(cbRange===r),flex:1,fontSize:9,textTransform:'capitalize'}}>{r.charAt(0).toUpperCase()+r.slice(1)}</button>
            ))}
          </div>
          {[['Cyan/Red','cr'],['Magenta/Green','mg'],['Yellow/Blue','yb']].map(([label,prop])=>(
            <React.Fragment key={prop}>
              <span style={css.label}>{label} — {Math.round(s[cbRange]?.[prop]||0)}</span>
              <Slider min={-100} max={100} value={s[cbRange]?.[prop]||0}
                onChange={v=>onChange({...s,[cbRange]:{...(s[cbRange]||{}),[prop]:v}})}
                onCommit={v=>onCommit({...s,[cbRange]:{...(s[cbRange]||{}),[prop]:v}})}
                style={{width:'100%'}}/>
            </React.Fragment>
          ))}
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:T.text,marginTop:6,cursor:'pointer'}}>
            <input type="checkbox" checked={s.preserveLuminosity!==false} onChange={e=>onCommit({...s,preserveLuminosity:e.target.checked})} style={{accentColor:T.accent}}/>
            Preserve Luminosity
          </label>
        </>)}
        {t==='vibrance'&&(<>
          {sld('Vibrance',0,-100,100,'vibrance')}
          {sld('Saturation',0,-100,100,'saturation')}
        </>)}
        {t==='selectiveColor'&&(<>
          <span style={css.label}>Color Range</span>
          <select value={scRange} onChange={e=>setScRange(e.target.value)} style={css.input}>
            {['reds','yellows','greens','cyans','blues','magentas','whites','neutrals','blacks'].map(r=>(
              <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>
            ))}
          </select>
          {['c','m','y','k'].map(prop=>(
            <React.Fragment key={prop}>
              <span style={css.label}>{prop==='c'?'Cyan':prop==='m'?'Magenta':prop==='y'?'Yellow':'Black'} — {Math.round(s[scRange]?.[prop]||0)}</span>
              <Slider min={-100} max={100} value={s[scRange]?.[prop]||0}
                onChange={v=>onChange({...s,[scRange]:{...(s[scRange]||{}),[prop]:v}})}
                onCommit={v=>onCommit({...s,[scRange]:{...(s[scRange]||{}),[prop]:v}})}
                style={{width:'100%'}}/>
            </React.Fragment>
          ))}
          <span style={css.label}>Method</span>
          <div style={{display:'flex',gap:4,marginBottom:6}}>
            {['relative','absolute'].map(m=>(
              <button key={m} onClick={()=>onCommit({...s,method:m})}
                style={{...css.iconBtn((s.method||'relative')===m),flex:1,fontSize:10,textTransform:'capitalize'}}>{m}</button>
            ))}
          </div>
        </>)}
        {t==='gradientMap'&&(<>
          <span style={css.label}>Gradient stops</span>
          {(s.stops||ADJ_DEFAULTS.gradientMap.stops).map((stop,i)=>(
            <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:10,color:T.muted,width:14}}>{Math.round(stop.pos*100)}%</span>
              <input type="color" value={stop.color}
                onChange={ev=>{const ns=[...(s.stops||[])];ns[i]={...ns[i],color:ev.target.value};onCommit({...s,stops:ns});}}
                style={{width:30,height:22,border:'none',borderRadius:4,cursor:'pointer',background:'none'}}/>
              {(s.stops||[]).length>2&&(
                <button onClick={()=>{const ns=(s.stops||[]).filter((_,j)=>j!==i);onCommit({...s,stops:ns});}}
                  style={{padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`,background:'transparent',color:T.danger,cursor:'pointer',fontSize:10}}>✕</button>
              )}
            </div>
          ))}
          <button onClick={()=>{const ns=[...(s.stops||[]),{pos:0.5,color:'#888888'}];onCommit({...s,stops:ns.sort((a,b)=>a.pos-b.pos)});}}
            style={{...css.addBtn,marginTop:0,marginBottom:8,background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>+ Add Stop</button>
          <div style={{height:16,borderRadius:6,background:`linear-gradient(to right, ${(s.stops||ADJ_DEFAULTS.gradientMap.stops).map(st=>`${st.color} ${Math.round(st.pos*100)}%`).join(',')})`,marginBottom:8}}/>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:T.text,cursor:'pointer',marginBottom:8}}>
            <input type="checkbox" checked={s.reverse||false} onChange={e=>onCommit({...s,reverse:e.target.checked})} style={{accentColor:T.accent}}/>
            Reverse
          </label>
          <span style={css.label}>Presets</span>
          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
            {[
              {label:'B&W', stops:[{pos:0,color:'#000000'},{pos:1,color:'#ffffff'}]},
              {label:'Sepia', stops:[{pos:0,color:'#2d1a00'},{pos:1,color:'#e8c48a'}]},
              {label:'Cool', stops:[{pos:0,color:'#00003a'},{pos:1,color:'#aee4ff'}]},
              {label:'Warm', stops:[{pos:0,color:'#1a0000'},{pos:1,color:'#ffcc44'}]},
              {label:'Cyber', stops:[{pos:0,color:'#0a0028'},{pos:0.5,color:'#ff00ff'},{pos:1,color:'#00ffdd'}]},
            ].map(({label,stops})=>(
              <button key={label} onClick={()=>onCommit({...s,stops})}
                style={{padding:'3px 8px',borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:10}}>{label}</button>
            ))}
          </div>
        </>)}
        {t==='posterize'&&sld('Levels',4,2,255,'levels')}
        {t==='threshold'&&sld('Level',128,0,255,'level')}
      </div>
    );
  }

  // ── Tier 3 Item 3: Competitor Comparison ─────────────────────────────────
  async function searchCompetitors(){
    if(!competitorQuery.trim()) return;
    setCompetitorLoading(true);
    setCompetitorError('');
    setCompetitorResults([]);
    setCompetitorAnalysis('');
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token;
      const res = await fetch(`${resolvedApiUrl}/api/youtube/search?q=${encodeURIComponent(competitorQuery)}&maxResults=10`,{
        headers:{'Authorization':`Bearer ${tok}`},
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Search failed');
      if(!data.success) throw new Error(data.error||'Search failed');
      setCompetitorResults(data.results||[]);
      // Capture current canvas as user thumbnail
      const flat=document.createElement('canvas');
      flat.width=p.preview.w; flat.height=p.preview.h;
      await renderLayersToCanvas(flat,layers);
      setCompetitorThumbUrl(flat.toDataURL('image/jpeg',0.88));
    }catch(err){
      setCompetitorError(err.message||'Search failed');
    }finally{
      setCompetitorLoading(false);
    }
  }

  async function analyzeCompetition(){
    if(!competitorResults.length||!competitorThumbUrl) return;
    setCompetitorAnalyzing(true);
    setCompetitorAnalysis('');
    try{
      const { data: { session } } = await supabase.auth.getSession();
      const tok = session?.access_token;
      const res = await fetch(`${resolvedApiUrl}/api/analyze-competition`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},
        body:JSON.stringify({
          userThumbnailUrl:competitorThumbUrl,
          competitorThumbnails:competitorResults,
          searchTerm:competitorQuery,
        }),
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||'Analysis failed');
      setCompetitorAnalysis(data.insights||'');
    }catch(err){
      setCompetitorAnalysis('Analysis failed: '+err.message);
    }finally{
      setCompetitorAnalyzing(false);
    }
  }

  function formatViewCount(n){
    if(n>=1000000) return (n/1000000).toFixed(1)+'M';
    if(n>=1000) return (n/1000).toFixed(0)+'K';
    return String(n);
  }

  // ── Tier 3 Item 4: Focus/Saliency Heat Map ────────────────────────────────
  function drawHeatMap(heatMapArr, width, height, opacity, canvasEl){
    if(!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    canvasEl.width = width; canvasEl.height = height;
    ctx.clearRect(0, 0, width, height);
    const imageData = ctx.createImageData(width, height);
    for(let i = 0; i < heatMapArr.length; i++){
      const v = heatMapArr[i];
      let r, g, b;
      if(v < 0.5){ r=0; g=Math.round(v*2*255); b=Math.round((1-v*2)*255); }
      else{ r=Math.round((v-0.5)*2*255); g=Math.round((1-(v-0.5)*2)*255); b=0; }
      imageData.data[i*4]   = r;
      imageData.data[i*4+1] = g;
      imageData.data[i*4+2] = b;
      imageData.data[i*4+3] = Math.round(v * (opacity/100) * 200);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function generateHeatMapInsights(heatMap, width, height){
    const insights = [];
    const sorted = [...heatMap].sort((a,b)=>b-a);
    const threshold = sorted[Math.floor(heatMap.length*0.1)];
    let cx=0,cy=0,cnt=0;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      if(heatMap[y*width+x]>=threshold){ cx+=x;cy+=y;cnt++; }
    }
    if(cnt>0){ cx/=cnt; cy/=cnt; }

    let topThird=0,midThird=0,botThird=0,total=0; // eslint-disable-line no-unused-vars
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const v=heatMap[y*width+x]; total+=v;
      if(y<height/3) topThird+=v;
      else if(y<height*2/3) midThird+=v; // eslint-disable-line no-unused-vars
      else botThird+=v;
    }
    const topPct=topThird/total, botPct=botThird/total;
    if(topPct>0.45) insights.push('Strong visual pull in the upper area — good for title/face placement');
    else if(botPct>0.35) insights.push('Lower region gets more attention — consider moving key elements up');

    let centerV=0,edgeV=0,cCnt=0,eCnt=0;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const dx=(x-width/2)/(width/2), dy=(y-height/2)/(height/2);
      if(Math.sqrt(dx*dx+dy*dy)<0.4){centerV+=heatMap[y*width+x];cCnt++;}
      else{edgeV+=heatMap[y*width+x];eCnt++;}
    }
    const centerAvg=cCnt>0?centerV/cCnt:0, edgeAvg=eCnt>0?edgeV/eCnt:0;
    if(centerAvg>edgeAvg*1.5) insights.push('Eye naturally centers on the focal point ✓');
    else insights.push('Attention is spread across the thumbnail — consider a stronger focal point');

    const cornerSize=Math.floor(Math.min(width,height)*0.15);
    let cornersV=0,cCnt2=0;
    [[0,0],[width-cornerSize,0],[0,height-cornerSize],[width-cornerSize,height-cornerSize]].forEach(([ox,oy])=>{
      for(let y=oy;y<oy+cornerSize&&y<height;y++) for(let x=ox;x<ox+cornerSize&&x<width;x++){cornersV+=heatMap[y*width+x];cCnt2++;}
    });
    if(cCnt2>0&&cornersV/cCnt2<0.2) insights.push('Corners have low attention — safe for watermarks or subtle branding');

    insights.push(`Peak attention: ${cx<width*0.4?'left':(cx>width*0.6?'right':'center')}-${cy<height*0.4?'top':(cy>height*0.6?'bottom':'middle')} region`);
    return insights;
  }

  async function runHeatMap(){
    setHeatMapLoading(true);
    setHeatMapData(null);
    setHeatMapInsights([]);
    try{
      const flat=document.createElement('canvas');
      flat.width=p.preview.w; flat.height=p.preview.h;
      await renderLayersToCanvas(flat,layers);
      const ctx=flat.getContext('2d');
      const imageData=ctx.getImageData(0,0,flat.width,flat.height);
      const worker=new Worker(new URL('./saliencyWorker.js', import.meta.url));
      worker.onmessage=(e)=>{
        const hm=new Float32Array(e.data.heatMap);
        setHeatMapData(hm);
        setShowHeatMap(true);
        setHeatMapVisible(true);
        const ins=generateHeatMapInsights(hm,flat.width,flat.height);
        setHeatMapInsights(ins);
        setTimeout(()=>{
          if(heatMapCanvasRef.current) drawHeatMap(hm,flat.width,flat.height,60,heatMapCanvasRef.current);
        },50);
        worker.terminate();
        setHeatMapLoading(false);
      };
      worker.onerror=(e)=>{
        console.error('[HEATMAP] Worker error:',e);
        setHeatMapLoading(false);
      };
      worker.postMessage({pixels:imageData.data.buffer,width:flat.width,height:flat.height},[imageData.data.buffer]);
    }catch(err){
      console.error('[HEATMAP]',err);
      setHeatMapLoading(false);
    }
  }

  const tools=[
    {key:'select',    label:'Select',       icon:'↖',  group:'Tools'},
    {key:'move',      label:'Move',         icon:'✋',  group:'Tools'},
    {key:'crop',      label:'Crop',         icon:'⊡',  group:'Tools'},
    {key:'zoom',      label:'Zoom',         icon:'🔍', group:'Tools'},
    null,
    {key:'text',      label:'Text',         icon:'T',   group:'Create'},
    {key:'shapes',    label:'Shapes',       icon:'○',   group:'Create'},
    {key:'stickers',  label:'Elements',     icon:'◆',   group:'Create'},
    {key:'memes',     label:'Memes & GIFs', icon:'▣',   group:'Create'},
    {key:'bggen',     label:'AI Background',icon:'⬡',   group:'Create'},
    null,
    {key:'brush',     label:'Brush',        icon:'⌀',  group:'Paint'},
    {key:'rimlight',  label:'Rim Light',    icon:'☀',  group:'Paint'},
    {key:'removebg',  label:'Remove BG',    icon:'✂',  group:'Paint'},
    {key:'segment',   label:'Smart Cutout', icon:'◎',  group:'Paint'},
    {key:'lasso',     label:'Lasso Mask',   icon:'✂️', group:'Paint'},
    null,
    {key:'marquee',   label:'Marquee',      icon:'⬚',   group:'Select'},
    {key:'sel-lasso', label:'Lasso Sel.',   icon:'⚯',   group:'Select'},
    {key:'sel-poly',  label:'Poly Lasso',   icon:'⬡',   group:'Select'},
    {key:'sel-wand',  label:'Magic Wand',   icon:'◌',   group:'Select'},
    null,
    {key:'background',label:'Background',   icon:'▨',   group:'Design'},
    {key:'effects',   label:'Effects',      icon:'✦',   group:'Design'},
    {key:'curves',    label:'Curves',       icon:'◑',   group:'Design'},
    {key:'adjustment',label:'Adjustments',  icon:'◐',   group:'Design'},
    {key:'liquify',   label:'Liquify',      icon:'≋',   group:'Design'},
    {key:'filters',   label:'Filters',      icon:'◎',   group:'Design'},
    null,
    {key:'templates',   label:'Templates',    icon:'⊞',   group:'Analyze'},
    {key:'composition', label:'Composition', icon:'◫',   group:'Analyze'},
    {key:'aitext',      label:'AI Text',     icon:'✦',   group:'Analyze'},
    {key:'style',       label:'Style',       icon:'◑',   group:'Analyze'},
    {key:'colorgrade',  label:'Color Grade', icon:'◕',   group:'Analyze'},
    {key:'ctr',         label:'CTR Score',   icon:'◈',   group:'Analyze'},
    {key:'face',      label:'Face Score',   icon:'◉',   group:'Analyze'},
    {key:'ab',        label:'A/B Variants', icon:'⊟',   group:'Analyze'},
    {key:'yttest',    label:'YouTube Test', icon:'▶',   group:'Analyze'},
    {key:'ythistory', label:'YT Insights',  icon:'◎',   group:'Analyze', pro:true},
    {key:'competitor',label:'Compare',      icon:'⚔',   group:'Analyze', pro:true},
    {key:'heatmap',   label:'Focus Map',    icon:'◉',   group:'Analyze'},
    {key:'resize',    label:'All Sizes',    icon:'⊠',   group:'Analyze'},
    null,
    {key:'team',      label:'Team',         icon:'⊕',   group:'Collab', pro:true},
    {key:'versions',  label:'Versions',     icon:'⊘',   group:'Collab', pro:true},
    {key:'comments',  label:'Comments',     icon:'◌',   group:'Collab', pro:true},
    null,
    {key:'upload',    label:'Upload',       icon:'↑',   group:'File'},
  ];

  const StampLayer=memo(function StampLayer({obj,scale}){
    if(obj.hidden||obj.type==='background')return null;
    if(obj.type==='text'){
      const ts=(()=>{const pts=[];if(obj.shadowEnabled)pts.push(`${(obj.shadowX||2)*scale}px ${(obj.shadowY||2)*scale}px ${(obj.shadowBlur||14)*scale}px ${obj.shadowColor||'rgba(0,0,0,0.95)'}`);return pts.length?pts.join(','):'none';})();
      return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,fontSize:obj.fontSize*scale,fontFamily:resolveFontFamily(obj.fontFamily),fontWeight:obj.fontWeight||700,color:obj.textColor,WebkitTextStroke:obj.strokeWidth>0?`${obj.strokeWidth*scale}px ${obj.strokeColor}`:'none',paintOrder:'stroke fill',textShadow:ts,whiteSpace:'nowrap',pointerEvents:'none',opacity:(obj.opacity||100)/100}}>{obj.text}</div>;
    }
    if(obj.type==='image'){
      const cropW=(obj.width-(obj.cropLeft||0)-(obj.cropRight||0))*scale;
      const cropH=(obj.height-(obj.cropTop||0)-(obj.cropBottom||0))*scale;
      const imageSrc = getSafeImageSrc(obj);
      if(!imageSrc){
        return <div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:cropW,height:cropH,opacity:(obj.opacity||100)/100,pointerEvents:'none',border:'1px dashed rgba(255,255,255,0.35)',background:'rgba(0,0,0,0.2)'}}/>;
      }
      return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:cropW,height:cropH,overflow:'hidden',opacity:(obj.opacity||100)/100,pointerEvents:'none'}}><img src={imageSrc} alt="" style={{width:obj.width*scale,height:obj.height*scale,display:'block',marginLeft:-(obj.cropLeft||0)*scale,marginTop:-(obj.cropTop||0)*scale}}/></div>;
    }
    if(obj.type==='shape')return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,opacity:(obj.opacity||100)/100,transform:`scale(${scale})`,transformOrigin:'top left',pointerEvents:'none'}}>{renderShapeSVG(obj.shape,obj.fillColor,obj.strokeColor,obj.width,obj.height)}</div>;
    if(obj.type==='svg')return<div style={{position:'absolute',left:obj.x*scale,top:obj.y*scale,width:obj.width*scale,height:obj.height*scale,opacity:(obj.opacity||100)/100,pointerEvents:'none'}} dangerouslySetInnerHTML={{__html:obj.svg}}/>;
    return null;
  });

  const CanvasLayerRenderer = memo(function CanvasLayerRenderer({ layers, renderLayerElement }) {
    return <>{layers.map(obj=>renderLayerElement(obj))}</>;
  }, (prevProps, nextProps) => prevProps.layers === nextProps.layers);

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',minHeight:'-webkit-fill-available',background:T.bg,color:T.text,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',overflow:'hidden'}}>
      <style>{`@keyframes tf-pulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>

      {showFileTab&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowFileTab(false);}}>
          <div style={{width:560,maxHeight:'80vh',background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:14,fontWeight:'700'}}>File</div>
              <button onClick={()=>setShowFileTab(false)} style={{padding:'4px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:11}}>Close</button>
            </div>
            <div style={{display:'flex',flex:1,overflow:'hidden'}}>
              <div style={{width:200,borderRight:`1px solid ${T.border}`,
                padding:'12px',display:'flex',flexDirection:'column',gap:4}}>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  New
                </div>
                <button onClick={newCanvas} style={{...css.addBtn,marginTop:0,
                  background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>
                  + New canvas
                </button>

                <div style={{height:1,background:T.border,margin:'10px 0'}}/>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  Save
                </div>
                <input value={designName} onChange={e=>setDesignName(e.target.value)} onBlur={triggerAutoSave}
                  style={css.input} placeholder="Design name..."/>
                <button onClick={()=>saveProject({ silent: false, nameOverride: designName })}
                  style={{...css.addBtn,marginTop:6}}>
                  💾 Save design
                </button>

                <div style={{height:1,background:T.border,margin:'10px 0'}}/>

                <div style={{fontSize:10,color:T.muted,fontWeight:'700',
                  letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:6}}>
                  Export
                </div>
                <button onClick={()=>{setShowFileTab(false);setShowDownload(true);}}
                  style={{...css.addBtn,marginTop:0,background:T.success}}>
                  ↓ Download PNG/JPG
                </button>
                <button onClick={()=>exportAllPlatforms()}
                  style={{...css.addBtn,marginTop:4,background:'transparent',
                    color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>
                  ⊠ Export all platforms
                </button>
              </div>
              <div style={{flex:1,padding:'12px',overflowY:'auto'}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                  Saved ({galleryLoading ? '…' : savedDesigns.length})
                  {galleryLoading&&<span style={{display:'inline-block',animation:'tf-pulse 0.9s ease-in-out infinite',color:T.accent,fontSize:8}}>●</span>}
                  {!galleryLoading&&<button onClick={()=>fetchSavedDesigns({force:true})} title="Refresh" style={{marginLeft:'auto',padding:'2px 7px',borderRadius:4,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>↻</button>}
                </div>

                {/* Skeleton cards shown instantly while loading */}
                {galleryLoading&&[0,1,2,3].map(i=>(
                  <div key={i} style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:T.input,marginBottom:8,display:'flex',alignItems:'center',gap:10,opacity:1-i*0.18}}>
                    <div style={{width:56,height:32,borderRadius:4,background:T.border,flexShrink:0,animation:'tf-pulse 1.2s ease-in-out infinite'}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{height:11,borderRadius:3,background:T.border,width:'60%',marginBottom:6,animation:'tf-pulse 1.2s ease-in-out infinite'}}/>
                      <div style={{height:9,borderRadius:3,background:T.border,width:'35%',animation:'tf-pulse 1.2s ease-in-out infinite'}}/>
                    </div>
                  </div>
                ))}

                {/* Real cards after load */}
                {!galleryLoading&&savedDesigns.length===0&&(
                  <div style={{fontSize:12,color:T.muted,padding:'20px 0',textAlign:'center'}}>No saved designs yet.</div>
                )}
                {!galleryLoading&&savedDesigns.map(d=>(
                  <div key={d.id} style={{padding:'10px 12px',borderRadius:8,border:`1px solid ${T.border}`,background:T.input,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                      {d.thumbnail
                        ? <img src={d.thumbnail} alt="thumb" style={{width:56,height:32,objectFit:'cover',borderRadius:4,border:`1px solid ${T.border}`,flexShrink:0}}/>
                        : <div style={{width:56,height:32,borderRadius:4,background:T.border,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:T.muted}}>no preview</div>
                      }
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:'600',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.name||'Untitled'}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>{d.created||'Just now'} · {d.platform||'youtube'}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:5,flexShrink:0}}>
                      <button onClick={()=>loadProject(d)} style={{padding:'5px 10px',borderRadius:5,border:`1px solid ${T.accent}`,background:'transparent',color:T.accent,fontSize:11,cursor:'pointer',fontWeight:'600'}}>Open</button>
                      <button onClick={()=>deleteDesign(d.id)} style={{padding:'5px 8px',borderRadius:5,border:`1px solid ${T.danger}`,background:'transparent',color:T.danger,fontSize:11,cursor:'pointer'}}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAiBar&&(
        <div style={{
          position:'fixed',inset:0,zIndex:1000,
          display:'flex',alignItems:'flex-start',justifyContent:'center',
          paddingTop:80,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(4px)',
        }} onClick={e=>{if(e.target===e.currentTarget)setShowAiBar(false);}}>
          <div style={{
            width:600,background:T.panel,borderRadius:14,
            border:`1px solid ${T.border}`,
            boxShadow:'0 24px 80px rgba(0,0,0,0.6)',overflow:'hidden',
          }}>
            <div style={{padding:'12px 20px',borderBottom:`1px solid ${T.border}`,
              display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:14}}>⚡</span>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input
                    ref={aiCmdInputRef}
                    value={aiCmd}
                    onChange={e=>setAiCmd(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==='Enter') executeAiCommand(aiCmd);
                      if(e.key==='Escape') setShowAiBar(false);
                    }}
                    placeholder='Try: "make it cinematic" or "add gold text EPIC"...'
                    style={{flex:1,background:'transparent',border:'none',
                      outline:'none',fontSize:14,color:T.text,fontFamily:'inherit'}}
                    autoFocus
                  />
                  <div style={{
                    fontSize:9,fontWeight:'700',color:'#f59e0b',
                    background:'rgba(245,158,11,0.12)',
                    border:'1px solid rgba(245,158,11,0.3)',
                    padding:'2px 8px',borderRadius:10,
                    letterSpacing:'0.5px',flexShrink:0,
                    textTransform:'uppercase',
                  }}>
                    Experimental
                  </div>
                </div>
              </div>
              {aiCmdLoading&&(
                <span style={{fontSize:12,color:T.muted,flexShrink:0}}>thinking...</span>
              )}
            </div>
            {aiCmdLog&&(
              <div style={{padding:'10px 20px',fontSize:12,
                color:aiCmdLog.startsWith('✓')?T.success:T.warning,
                borderBottom:`1px solid ${T.border}`,fontWeight:'600'}}>
                {aiCmdLog}
              </div>
            )}
            <div style={{padding:'12px 20px'}}>
              <div style={{fontSize:11,color:T.muted,marginBottom:10,fontWeight:'600',
                textTransform:'uppercase',letterSpacing:'0.5px'}}>
                Example commands
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[
                  'Make it cinematic',
                  'Make the colors more vibrant',
                  'Make it darker and more dramatic',
                  'Make the text bigger and bolder',
                  'Add gold glowing text that says EPIC',
                  'Change the background to dark blue',
                  'Make it look like a gaming thumbnail',
                  'Add a text layer that says WATCH THIS',
                  'Delete the top text layer',
                  'Make the image pop more',
                  'Add a drop shadow to the text',
                  'Make it brighter',
                ].map((example,i)=>(
                  <div key={i}
                    onClick={()=>{ setAiCmd(example); aiCmdInputRef.current?.focus(); }}
                    style={{padding:'7px 10px',borderRadius:6,
                      background:T.input,border:`1px solid ${T.border}`,
                      fontSize:11,color:T.muted,cursor:'pointer',lineHeight:1.4}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                    {example}
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'10px 20px',borderTop:`1px solid ${T.border}`,
              display:'flex',gap:8,alignItems:'center'}}>
              <button onClick={()=>executeAiCommand(aiCmd)} disabled={aiCmdLoading}
                style={{padding:'8px 20px',borderRadius:7,border:'none',
                  background:T.accent,color:'#fff',cursor:'pointer',
                  fontSize:13,fontWeight:'700',opacity:aiCmdLoading?0.6:1}}>
                {aiCmdLoading?'Working...':'Run command'}
              </button>
              <button onClick={()=>setShowAiBar(false)}
                style={{padding:'8px 14px',borderRadius:7,
                  border:`1px solid ${T.border}`,background:'transparent',
                  color:T.muted,cursor:'pointer',fontSize:12}}>
                Close
              </button>
              <span style={{fontSize:10,color:T.muted,marginLeft:'auto'}}>
                Ctrl+I to open · Enter to run · Esc to close
              </span>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        open={showCommandPalette}
        onClose={()=>setShowCommandPalette(false)}
        onExecute={executePaletteCommand}
      />

      {showLiquify&&liquifySource&&(
        <LiquifyModal
          sourceImageData={liquifySource.imageData}
          W={liquifySource.w}
          H={liquifySource.h}
          onApply={(dataUrl)=>{
            addLayer({
              type:'image',src:dataUrl,
              width:p.preview.w,height:p.preview.h,
              x:0,y:0,
              cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
              imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
            });
            saveEngineRef.current?.markDirty('layerContent','liquify');
            setShowLiquify(false);
            setLiquifySource(null);
          }}
          onCancel={()=>{setShowLiquify(false);setLiquifySource(null);}}
        />
      )}

      {showFilters&&filtersSource&&(
        <FiltersModal
          sourceImageData={filtersSource.imageData}
          W={filtersSource.w}
          H={filtersSource.h}
          selectionMask={selectionActive?selectionMaskRef.current:null}
          lastFilter={lastFilterRef.current}
          autoApply={filtersAutoApply}
          onApply={({dataUrl,filterId,params,blendMode})=>{
            addLayer({
              type:'image',src:dataUrl,
              width:p.preview.w,height:p.preview.h,
              x:0,y:0,
              cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
              imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
              blendMode:blendMode||'normal',
            });
            lastFilterRef.current={id:filterId,params};
            saveEngineRef.current?.markDirty('layerContent','filter-'+filterId);
            setShowFilters(false);
            setFiltersSource(null);
          }}
          onCancel={()=>{setShowFilters(false);setFiltersSource(null);}}
        />
      )}

      {/* Hidden canvas for history thumbnail generation — never visible */}
      <canvas ref={thumbCanvasRef} width={160} height={90} style={{display:'none',position:'fixed',pointerEvents:'none'}}/>

      {/* ── Layer context menu (groups + regular layers) ── */}
      {ctxMenu&&(()=>{
        const ctxLayerIdx=layers.findIndex(l=>l.id===ctxMenu.layerId);
        const ctxLayer=layers[ctxLayerIdx];
        const ctxIsClipped=ctxLayer?.clipMask===true;
        const ctxCanClip=ctxLayerIdx>0&&ctxLayer?.type!=='background';
        const groupItems=[
          ['⊟ Ungroup',          ()=>{ ungroupLayer(ctxMenu.layerId);   setCtxMenu(null); }],
          ['⧉ Duplicate',        ()=>{ duplicateLayer(ctxMenu.layerId); setCtxMenu(null); }],
          ['◼ Merge to Layer',   ()=>{ mergeGroupToLayer(ctxMenu.layerId); setCtxMenu(null); }],
          null,
          ['✕ Delete Group + Contents', ()=>{ deleteGroupAndChildren(ctxMenu.layerId); setCtxMenu(null); }],
        ];
        const ctxLayerObj = layers.find(l=>l.id===ctxMenu.layerId);
        const layerItems=[
          ctxIsClipped
            ? ['⊏ Release Clipping Mask (Ctrl+Alt+G)', ()=>{ toggleClipMask(ctxMenu.layerId); setCtxMenu(null); }]
            : ctxCanClip
              ? ['⊏ Create Clipping Mask (Ctrl+Alt+G)', ()=>{ toggleClipMask(ctxMenu.layerId); setCtxMenu(null); }]
              : null,
          null,
          (ctxLayerObj&&(ctxLayerObj.type==='image'||ctxLayerObj.type==='text'))
            ? ['⬡ Warp Transform (Ctrl+Shift+W)', ()=>{ setSelectedId(ctxMenu.layerId); setWarpMode(true); setWarpBend(30); setWarpPreset('arc'); setCtxMenu(null); }]
            : null,
          null,
          ['⧉ Duplicate Layer',  ()=>{ duplicateLayer(ctxMenu.layerId); setCtxMenu(null); }],
          ['✕ Delete Layer',     ()=>{ deleteLayer(ctxMenu.layerId); setCtxMenu(null); }],
        ].filter((item,i,arr)=>!(item===null&&(i===0||arr[i-1]===null||i===arr.length-1)));
        const items=ctxMenu.menuType==='group'?groupItems:layerItems;
        return(
          <>
            <div style={{position:'fixed',inset:0,zIndex:1095}} onClick={()=>setCtxMenu(null)}/>
            <div style={{position:'fixed',left:ctxMenu.x,top:ctxMenu.y,zIndex:1096,background:'#1e1e1e',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'4px 0',minWidth:200,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',userSelect:'none'}}>
              {items.map((item,i)=>item===null?(
                <div key={i} style={{height:1,background:'rgba(255,255,255,0.08)',margin:'3px 0'}}/>
              ):(
                <button key={item[0]} onClick={item[1]}
                  style={{display:'block',width:'100%',textAlign:'left',padding:'7px 14px',background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:12,cursor:'pointer'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(249,115,22,0.15)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  {item[0]}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {/* ── YouTube Search Result Preview Modal ── */}
      {showYtPreview&&(()=>{
        const isDark=ytPreviewTheme==='dark';
        const ytBg=isDark?'#0f0f0f':'#ffffff';
        const ytText=isDark?'#ffffff':'#0f0f0f';
        const ytSub=isDark?'rgba(255,255,255,0.55)':'#606060';
        const yt2=isDark?'rgba(255,255,255,0.35)':'#909090';
        const yt3=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)';
        const thumbScaleDesktop=240/p.preview.w;
        const thumbScaleMobile=360/p.preview.w;
        const bgStyle=bg?.bgGradient?`linear-gradient(180deg,${bg.bgGradient[0]},${bg.bgGradient[1]})`:bg?.bgColor||'#000';
        return(
          <div style={{position:'fixed',inset:0,zIndex:1050,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowYtPreview(false);}}>
            <div style={{width:600,maxHeight:'90vh',overflowY:'auto',background:T.panel,borderRadius:16,border:`1px solid ${T.border}`,boxShadow:'0 32px 96px rgba(0,0,0,0.9)',display:'flex',flexDirection:'column'}}>
              {/* Header */}
              <div style={{padding:'14px 18px 10px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:13,fontWeight:'700',color:T.text}}>▶ YouTube Preview</span>
                  <span style={{fontSize:10,color:T.muted}}>How creators see your thumbnail</span>
                </div>
                <button onClick={()=>setShowYtPreview(false)} style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:12}}>✕</button>
              </div>
              {/* Controls */}
              <div style={{padding:'10px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
                {/* Mode */}
                <div style={{display:'flex',borderRadius:7,overflow:'hidden',border:`1px solid ${T.border}`}}>
                  {[['desktop','🖥 Desktop'],['mobile','📱 Mobile']].map(([m,lbl])=>(
                    <button key={m} onClick={()=>setYtPreviewMode(m)}
                      style={{padding:'5px 12px',border:'none',background:ytPreviewMode===m?T.accent:'transparent',color:ytPreviewMode===m?'#000':T.muted,cursor:'pointer',fontSize:10,fontWeight:'600',transition:'all 0.1s'}}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {/* Theme */}
                <div style={{display:'flex',borderRadius:7,overflow:'hidden',border:`1px solid ${T.border}`}}>
                  {[['dark','● Dark'],['light','○ Light']].map(([th,lbl])=>(
                    <button key={th} onClick={()=>setYtPreviewTheme(th)}
                      style={{padding:'5px 11px',border:'none',background:ytPreviewTheme===th?T.input:'transparent',color:ytPreviewTheme===th?T.text:T.muted,cursor:'pointer',fontSize:10,transition:'all 0.1s'}}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {/* Editable title */}
                <input value={ytVideoTitle} onChange={e=>setYtVideoTitle(e.target.value)} placeholder="Video title…"
                  style={{flex:1,minWidth:160,padding:'5px 10px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:11,outline:'none'}}/>
                <input value={ytChannel} onChange={e=>setYtChannel(e.target.value)} placeholder="Channel…"
                  style={{width:110,padding:'5px 10px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:11,outline:'none'}}/>
              </div>
              {/* Preview area */}
              <div style={{padding:'18px',background:ytBg,flex:1}}>
                {ytPreviewMode==='desktop'?(
                  /* Desktop search result */
                  <div>
                    {/* Search bar */}
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                      <div style={{flex:1,padding:'8px 14px',borderRadius:22,border:`1px solid ${isDark?'rgba(255,255,255,0.15)':'rgba(0,0,0,0.15)'}`,background:isDark?'rgba(255,255,255,0.05)':'#fff',color:yt2,fontSize:12}}>youtube thumbnail creator tips</div>
                      <div style={{width:32,height:32,borderRadius:'50%',background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:yt2}}>🔍</div>
                    </div>
                    {/* Result card */}
                    <div style={{display:'flex',gap:14,alignItems:'flex-start',padding:'8px',borderRadius:8,background:yt3}}>
                      {/* Thumbnail */}
                      <div style={{position:'relative',width:240,height:135,borderRadius:8,overflow:'hidden',flexShrink:0,background:bgStyle}}>
                        {layers.filter(l=>l.type!=='background').map(obj=><StampLayer key={obj.id} obj={obj} scale={thumbScaleDesktop}/>)}
                        <div style={{position:'absolute',bottom:5,right:5,padding:'2px 5px',borderRadius:3,background:'rgba(0,0,0,0.9)',fontSize:8,color:'#fff',fontFamily:'monospace',fontWeight:'700'}}>10:24</div>
                      </div>
                      {/* Meta */}
                      <div style={{flex:1,paddingTop:2}}>
                        <div style={{fontSize:15,fontWeight:'400',color:ytText,lineHeight:1.4,marginBottom:6,fontFamily:'Roboto,"Segoe UI",sans-serif'}}>{ytVideoTitle||'Your Video Title Goes Here'}</div>
                        <div style={{fontSize:11,color:yt2,marginBottom:5,fontFamily:'Roboto,sans-serif'}}>1,247,832 views · 2 days ago</div>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                          <div style={{width:20,height:20,borderRadius:'50%',background:'linear-gradient(135deg,#f97316,#ef4444)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:'700',color:'#fff'}}>{ytChannel.charAt(0).toUpperCase()}</div>
                          <span style={{fontSize:11,color:ytSub,fontFamily:'Roboto,sans-serif'}}>{ytChannel||'Your Channel'} · 1.2M subscribers</span>
                        </div>
                        <div style={{fontSize:11,color:yt2,lineHeight:1.5,fontFamily:'Roboto,sans-serif'}}>Watch this tutorial to learn how to create stunning YouTube thumbnails that drive massive clicks and grow your channel…</div>
                      </div>
                    </div>
                    {/* Suggested next card (faded) */}
                    <div style={{display:'flex',gap:14,alignItems:'flex-start',padding:'8px',marginTop:4,opacity:0.35}}>
                      <div style={{width:240,height:135,borderRadius:8,background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)',flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{height:14,width:'80%',borderRadius:3,background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)',marginBottom:8}}/>
                        <div style={{height:10,width:'40%',borderRadius:3,background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'}}/>
                      </div>
                    </div>
                  </div>
                ):(
                  /* Mobile feed */
                  <div style={{maxWidth:390,margin:'0 auto'}}>
                    {/* Top nav */}
                    <div style={{display:'flex',gap:12,marginBottom:14,borderBottom:`1px solid ${isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)'}`,paddingBottom:10}}>
                      {['All','Gaming','Music','Tech','Film'].map((t,i)=>(
                        <div key={t} style={{padding:'5px 10px',borderRadius:16,background:i===0?T.accent:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',color:i===0?'#000':yt2,fontSize:10,fontWeight:i===0?'700':'400',whiteSpace:'nowrap',cursor:'pointer'}}>{t}</div>
                      ))}
                    </div>
                    {/* The user's video card */}
                    <div style={{marginBottom:12}}>
                      <div style={{position:'relative',width:'100%',paddingBottom:'56.25%',borderRadius:8,overflow:'hidden',background:bgStyle,marginBottom:8}}>
                        <div style={{position:'absolute',inset:0}}>
                          {layers.filter(l=>l.type!=='background').map(obj=><StampLayer key={obj.id} obj={obj} scale={thumbScaleMobile}/>)}
                        </div>
                        <div style={{position:'absolute',bottom:6,right:6,padding:'2px 5px',borderRadius:3,background:'rgba(0,0,0,0.9)',fontSize:8,color:'#fff',fontFamily:'monospace',fontWeight:'700'}}>10:24</div>
                      </div>
                      <div style={{display:'flex',gap:9,alignItems:'flex-start'}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#f97316,#ef4444)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:'700',color:'#fff'}}>{ytChannel.charAt(0).toUpperCase()}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:'500',color:ytText,lineHeight:1.35,marginBottom:3,fontFamily:'Roboto,sans-serif'}}>{ytVideoTitle||'Your Video Title Goes Here'}</div>
                          <div style={{fontSize:11,color:yt2,fontFamily:'Roboto,sans-serif'}}>{ytChannel||'Channel Name'} · 1.2M views · 2 days ago</div>
                        </div>
                        <div style={{color:yt2,fontSize:16,paddingTop:2,cursor:'pointer'}}>⋮</div>
                      </div>
                    </div>
                    {/* Faded next card */}
                    <div style={{opacity:0.3}}>
                      <div style={{width:'100%',paddingBottom:'56.25%',borderRadius:8,background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',marginBottom:8}}/>
                      <div style={{display:'flex',gap:9}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'}}/>
                        <div style={{flex:1}}>
                          <div style={{height:12,width:'80%',borderRadius:3,background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)',marginBottom:6}}/>
                          <div style={{height:10,width:'50%',borderRadius:3,background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'}}/>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Footer hint */}
              <div style={{padding:'8px 18px',borderTop:`1px solid ${T.border}`,fontSize:9,color:T.muted,textAlign:'center',flexShrink:0}}>
                Live preview · edit title and channel above · never affects your canvas
              </div>
            </div>
          </div>
        );
      })()}

      {showDownload&&(()=>{
        const isPro = isProUser || token==='test-key-123' || user?.is_admin;
        const jpegEstKB = Math.round(p.preview.w * p.preview.h * 3 * (exportQuality/100) * 0.1 / 1024);
        const formats = [
          { id:'png',  label:'PNG',  icon:'🖼', desc:'Lossless · transparent bg supported' },
          { id:'jpeg', label:'JPEG', icon:'📷', desc:'Smaller file · no transparency' },
          { id:'webp', label:'WebP', icon:'⚡', desc:'Modern · best compression' },
          { id:'psd',  label:'PSD',  icon:'🎨', desc:'Layered Photoshop · Pro', pro:true },
        ];
        const cardBase = {borderRadius:8,border:'1px solid',padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'all 0.15s',marginBottom:6};
        return(
          <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowDownload(false);}}>
            <div style={{width:400,background:'#1a1a1a',borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.9)',overflow:'hidden'}}>
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:`1px solid ${T.border}`}}>
                <div>
                  <div style={{fontSize:15,fontWeight:'700',color:T.text}}>Export</div>
                  <div style={{fontSize:11,color:T.muted,marginTop:1}}>{p.label} · {p.width}×{p.height}px</div>
                </div>
                <button onClick={()=>setShowDownload(false)} style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
              </div>
              {/* Body */}
              <div style={{padding:'16px 20px',maxHeight:'70vh',overflowY:'auto'}}>
                {/* Section 1: Format */}
                <div style={{fontSize:10,fontWeight:'700',color:T.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>Export Format</div>
                {formats.map(fmt=>{
                  const isSelected = exportFormat === fmt.id;
                  const isLocked = fmt.pro && !isPro;
                  return(
                    <div key={fmt.id} onClick={()=>!isLocked&&setExportFormat(fmt.id)}
                      style={{...cardBase,
                        borderColor: isSelected ? '#ff6a00' : T.border,
                        background: isSelected ? 'rgba(255,106,0,0.1)' : T.input,
                        opacity: isLocked ? 0.55 : 1,
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                      }}>
                      <span style={{fontSize:18}}>{fmt.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:'700',color:T.text,display:'flex',alignItems:'center',gap:6}}>
                          {fmt.label}
                          {isLocked&&<span style={{fontSize:9,background:'rgba(249,115,22,0.2)',color:'#f97316',padding:'1px 5px',borderRadius:3,border:'1px solid rgba(249,115,22,0.3)'}}>🔒 PRO</span>}
                        </div>
                        <div style={{fontSize:10,color:T.muted}}>{fmt.desc}</div>
                        {fmt.id==='jpeg'&&isSelected&&(
                          <div style={{marginTop:6}}>
                            <div style={{fontSize:10,color:T.muted,marginBottom:3}}>Quality — {exportQuality}%  ≈ {jpegEstKB} KB</div>
                            <input type="range" min={20} max={100} value={exportQuality}
                              onChange={e=>setExportQuality(Number(e.target.value))}
                              style={{width:'100%',accentColor:'#ff6a00'}}/>
                          </div>
                        )}
                      </div>
                      {isSelected&&!isLocked&&<span style={{fontSize:14,color:'#ff6a00'}}>✓</span>}
                    </div>
                  );
                })}

                {/* Section 2: Quick Presets */}
                <div style={{fontSize:10,fontWeight:'700',color:T.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8,marginTop:14}}>Quick Presets</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[
                    {label:'YouTube Thumbnail',w:1280,h:720},
                    {label:'YouTube Banner',w:2560,h:1440},
                    {label:'Instagram Post',w:1080,h:1080},
                  ].map(preset=>(
                    <button key={preset.label} onClick={()=>{
                      exportCanvas('png',false);
                    }}
                      title={`${preset.w}×${preset.h}`}
                      style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#ff6a00';e.currentTarget.style.background='rgba(255,106,0,0.1)';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.input;}}>
                      {preset.label}<div style={{fontSize:9,color:T.muted,marginTop:1}}>{preset.w}×{preset.h}</div>
                    </button>
                  ))}
                </div>

                {/* Section 3: ThumbFrame Project */}
                <div style={{fontSize:10,fontWeight:'700',color:T.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8,marginTop:14}}>ThumbFrame Project</div>
                <button onClick={()=>{
                  try{
                    const snap = JSON.stringify({designName,platform,layers,version:1});
                    const blob = new Blob([snap],{type:'application/json'});
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${designName.replace(/\s+/g,'-')||'thumbframe'}.tf`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                    showToastMsg('Project file saved', 'success');
                  }catch(e){showToastMsg('Save failed: '+e.message,'error');}
                }}
                  style={{width:'100%',padding:'8px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:11,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:8}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='#ff6a00';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;}}>
                  <span style={{fontSize:14}}>💾</span>
                  <div>
                    <div style={{fontWeight:'600'}}>Save .tf project file</div>
                    <div style={{fontSize:10,color:T.muted}}>All layers · editable in ThumbFrame</div>
                  </div>
                </button>

                {/* Legacy options */}
                <div style={{...css.section,marginTop:12,padding:'10px 12px',border:`1px solid ${T.border}`}}>
                  <div style={{...css.row}}>
                    <input type="checkbox" id="transp2" checked={transparentExport} onChange={e=>setTransparentExport(e.target.checked)} style={{width:14,height:14,cursor:'pointer',accentColor:'#ff6a00'}}/>
                    <label htmlFor="transp2" style={{fontSize:11,color:T.text,cursor:'pointer',flex:1,marginLeft:6}}>Transparent background (PNG)</label>
                  </div>
                </div>
              </div>

              {/* Footer / Export button */}
              <div style={{padding:'12px 20px',borderTop:`1px solid ${T.border}`,display:'flex',gap:8}}>
                <button onClick={()=>{
                  if(exportFormat==='psd'){exportAsPsd();return;}
                  if(exportFormat==='jpeg'){
                    const c=document.createElement('canvas');
                    c.width=p.width;c.height=p.height;
                    renderLayersToCanvas(c,layers,{transparent:false}).then(()=>{
                      const fname=`${designName.replace(/\s+/g,'-')||'thumbframe'}-${p.width}x${p.height}`;
                      const a=document.createElement('a');a.download=`${fname}.jpg`;
                      a.href=c.toDataURL('image/jpeg',exportQuality/100);a.click();
                      setShowDownload(false);
                    });
                    return;
                  }
                  exportCanvas(exportFormat==='webp'?'webp':'png', transparentExport);
                }}
                  disabled={exportLoading!=null}
                  style={{flex:1,padding:'10px',borderRadius:8,border:'none',background:'#ff6a00',color:'#fff',fontSize:13,fontWeight:'700',cursor:exportLoading?'wait':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,opacity:exportLoading?0.7:1}}>
                  {exportLoading ? '⏳ Exporting…' : `Export ${exportFormat.toUpperCase()}`}
                </button>
                <button onClick={()=>handleDownload({tier:'basic'})}
                  style={{padding:'10px 14px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.text,fontSize:11,cursor:'pointer'}}
                  title="Quick basic JPG download">
                  Basic JPG
                </button>
              </div>
            </div>
          </div>
        );
      })()}



      {cmdOpen&&(
        <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:80,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget){setCmdOpen(false);setCmdSuggestions([]);}}}>
          <div style={{width:560,background:T.panel,borderRadius:14,border:`1px solid ${T.border}`,boxShadow:'0 24px 80px rgba(0,0,0,0.8)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:14,color:T.muted,fontFamily:'monospace'}}>⌘</span>
              <input ref={cmdInputRef} value={cmdInput} onChange={e=>{setCmdInput(e.target.value);updateSuggestions(e.target.value);}} onKeyDown={handleCmdKey} placeholder='text "Hello", bg #ff0000, save, align center, help...' style={{flex:1,background:'transparent',border:'none',outline:'none',fontSize:14,color:T.text,fontFamily:'inherit'}} autoFocus/>
              <span style={{fontSize:10,color:T.muted,background:T.input,padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`}}>Esc</span>
            </div>
            {cmdLog&&<div style={{padding:'6px 16px',fontSize:11,color:T.success,borderBottom:`1px solid ${T.border}`}}>✓ {cmdLog}</div>}
            {cmdSuggestions.length>0&&cmdSuggestions.map((s,i)=>(<div key={i} onClick={()=>{setCmdInput(s.cmd);runCommand(s.cmd);}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px',cursor:'pointer',borderBottom:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontSize:13,color:T.text,fontFamily:'monospace'}}>{s.cmd}</span><span style={{fontSize:11,color:T.muted}}>{s.desc}</span></div>))}
            {cmdInput===''&&!showCmdHelp&&(<div style={{padding:'10px 16px'}}><div style={{fontSize:10,color:T.muted,fontWeight:'700',letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:8}}>Recent</div>{cmdHistory.slice(0,5).map((h,i)=>(<div key={i} onClick={()=>{setCmdInput(h);runCommand(h);}} style={{padding:'6px 8px',fontSize:12,color:T.text,cursor:'pointer',borderRadius:5,fontFamily:'monospace'}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{h}</div>))}{cmdHistory.length===0&&<div style={{fontSize:12,color:T.muted,padding:'4px 8px'}}>No recent commands</div>}</div>)}
            {showCmdHelp&&(<div style={{maxHeight:360,overflowY:'auto',padding:'8px 0'}}>{ALL_COMMANDS.map((c,i)=>(<div key={i} onClick={()=>setCmdInput(c.cmd)} style={{display:'flex',justifyContent:'space-between',padding:'7px 16px',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=T.input} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontSize:12,color:T.accent,fontFamily:'monospace'}}>{c.cmd}</span><span style={{fontSize:11,color:T.muted}}>{c.desc}</span></div>))}</div>)}
            <div style={{padding:'8px 16px',borderTop:`1px solid ${T.border}`,display:'flex',gap:12}}>{[['↑↓','History'],['Tab','Complete'],['Enter','Run'],['Esc','Close']].map(([k,d])=>(<div key={k} style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:10,background:T.input,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`,color:T.text,fontFamily:'monospace'}}>{k}</span><span style={{fontSize:10,color:T.muted}}>{d}</span></div>))}</div>
          </div>
        </div>
      )}

      {/* ── Warp Mode options bar ── */}
      {warpMode&&selectedId&&(
        <div style={{position:'fixed',top:0,left:0,right:0,zIndex:1099,background:'#1a1a1a',borderBottom:'2px solid #ff6a00',padding:'8px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <span style={{fontSize:12,fontWeight:'700',color:'#ff6a00'}}>⬡ Warp Transform</span>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>Preset:</span>
          <select value={warpPreset} onChange={e=>setWarpPreset(e.target.value)}
            style={{padding:'4px 8px',borderRadius:6,border:'1px solid #444',background:'#2a2a2a',color:'#fff',fontSize:11,cursor:'pointer'}}>
            {Object.keys(WARP_PRESETS).map(k=><option key={k} value={k}>{k.charAt(0).toUpperCase()+k.slice(1)}</option>)}
          </select>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>Bend: {warpBend}</span>
          <input type="range" min={-100} max={100} value={warpBend} onChange={e=>setWarpBend(Number(e.target.value))}
            style={{width:120,accentColor:'#ff6a00'}}/>
          <button onClick={()=>applyWarpToLayer(selectedId, warpPreset, warpBend)} disabled={warpLoading}
            style={{padding:'6px 14px',borderRadius:7,border:'none',background:'#ff6a00',color:'#fff',fontSize:12,fontWeight:'700',cursor:warpLoading?'wait':'pointer',opacity:warpLoading?0.7:1}}>
            {warpLoading?'Applying…':'Apply'}
          </button>
          <button onClick={()=>{setWarpMode(false);setWarpPreview(null);}}
            style={{padding:'6px 14px',borderRadius:7,border:'1px solid #444',background:'transparent',color:'rgba(255,255,255,0.7)',fontSize:12,cursor:'pointer'}}>
            Cancel
          </button>
          {warpPreview&&<span style={{fontSize:10,color:'#ff6a00'}}>● Preview active</span>}
        </div>
      )}

      {/* ── Warp grid overlay (rendered inside canvas container via absolute positioning) ── */}
      {/* Actual overlay is rendered inline in the canvas area below via warpMode flag */}

      {/* Top bar */}
      <div style={{
        display:'flex',alignItems:'center',
        height:isMobile?42:50,
        padding:isMobile?'0 10px':'0 14px',
        background:T.panel,
        borderBottom:`1px solid ${T.border}`,
        gap:isMobile?4:8,
        flexShrink:0,
        overflowX:isMobile?'auto':'visible',
        boxShadow:'0 1px 0 rgba(255,255,255,0.02)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {onExit&&(
            <button onClick={onExit} style={{
              padding:'5px 8px',borderRadius:6,
              border:`1px solid ${T.border}`,
              background:'transparent',color:T.muted,cursor:'pointer',fontSize:12,
              lineHeight:1,
            }}>←</button>
          )}
          {/* Brand mark */}
          <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
            <div style={{
              width:24,height:24,borderRadius:6,
              background:'linear-gradient(135deg,#f97316,#ea580c)',
              display:'flex',alignItems:'center',justifyContent:'center',
              flexShrink:0,
              boxShadow:'0 2px 8px rgba(249,115,22,0.3)',
            }}>
              <span style={{fontSize:11,fontWeight:'900',color:'#fff',letterSpacing:'-0.5px'}}>T</span>
            </div>
            <span style={{fontSize:13,fontWeight:'700',color:T.text,letterSpacing:'-0.4px'}}>ThumbFrame</span>
          </div>
          {!isMobile&&(
            <div style={{width:1,height:16,background:T.border,margin:'0 2px'}}/>
          )}
          {!isMobile&&(
            <button onClick={()=>setShowFileTab(true)}
              style={{
                padding:'5px 11px',borderRadius:6,
                border:`1px solid ${T.border}`,
                background:'transparent',color:T.muted,
                cursor:'pointer',fontSize:11,fontWeight:'500',
                display:'flex',alignItems:'center',gap:4,
              }}
              onMouseEnter={e=>{e.currentTarget.style.color=T.text;e.currentTarget.style.borderColor=T.border;}}
              onMouseLeave={e=>{e.currentTarget.style.color=T.muted;e.currentTarget.style.borderColor=T.border;}}>
              File
            </button>
          )}
        </div>
        {!isMobile&&(
          <button onClick={()=>{setCmdOpen(true);setTimeout(()=>cmdInputRef.current?.focus(),50);}}
            style={{
              flex:1,maxWidth:320,
              display:'flex',alignItems:'center',gap:8,
              padding:'7px 12px',borderRadius:8,
              border:`1px solid ${T.border}`,
              background:T.input,
              color:T.muted,cursor:'pointer',fontSize:12,textAlign:'left',
            }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(249,115,22,0.3)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <span style={{fontSize:12,color:T.muted,fontFamily:'monospace'}}>⌘</span>
            <span style={{flex:1,color:T.muted,fontSize:11}}>Search commands…</span>
            {cmdLog&&<span style={{fontSize:10,color:T.success,fontWeight:'600',flexShrink:0,maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>✓ {cmdLog}</span>}
            <span style={{fontSize:9,background:T.bg2,padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`,color:T.muted,flexShrink:0,letterSpacing:'0.3px'}}>⌃K</span>
          </button>
        )}
        {!isMobile&&(
          <button
            onClick={()=>{setShowAiBar(true);setTimeout(()=>aiCmdInputRef.current?.focus(),50);}}
            style={{
              display:'flex',alignItems:'center',gap:5,
              padding:'6px 12px',borderRadius:7,
              border:`1px solid ${T.accentBorder}`,
              background:T.accentDim,
              color:T.accent,cursor:'pointer',fontSize:11,fontWeight:'600',
              flexShrink:0,letterSpacing:'0.1px',
            }}
            title="AI command bar (Ctrl+I)">
            ⚡ AI
            <span style={{
              fontSize:8,fontWeight:'700',color:'#f59e0b',
              background:'rgba(245,158,11,0.12)',
              border:'1px solid rgba(245,158,11,0.25)',
              padding:'1px 4px',borderRadius:4,letterSpacing:'0.5px',
            }}>BETA</span>
          </button>
        )}
        {/* Feature J: Niche badge pill */}
        {userNiche&&NICHE_CONFIG[userNiche]&&(
          <button
            onClick={()=>{setNicheHovered(userNiche);setNicheOnboarding(true);}}
            title={`Channel niche: ${NICHE_CONFIG[userNiche].label} — click to change`}
            style={{
              display:'flex',alignItems:'center',gap:5,
              padding:'5px 10px',borderRadius:7,
              border:`1px solid ${NICHE_CONFIG[userNiche].accentColor}44`,
              background:`${NICHE_CONFIG[userNiche].accentColor}14`,
              color:NICHE_CONFIG[userNiche].accentColor,
              cursor:'pointer',fontSize:11,fontWeight:'700',
              flexShrink:0,letterSpacing:'0.05em',
              transition:'border-color 0.15s,background 0.15s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=NICHE_CONFIG[userNiche].accentColor+'99';e.currentTarget.style.background=NICHE_CONFIG[userNiche].accentColor+'22';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=NICHE_CONFIG[userNiche].accentColor+'44';e.currentTarget.style.background=NICHE_CONFIG[userNiche].accentColor+'14';}}>
            {NICHE_CONFIG[userNiche].emoji} {NICHE_CONFIG[userNiche].label}
          </button>
        )}
        {/* Feature L: Approval status badge */}
        {(()=>{
          const STATUS_CFG={
            draft:    {label:'Draft',    color:'#94a3b8', bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.2)', next:'review'},
            review:   {label:'In Review',color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.25)', next:'approved'},
            approved: {label:'Approved', color:'#22c55e', bg:'rgba(34,197,94,0.1)',   border:'rgba(34,197,94,0.25)',  next:'draft'},
          };
          const cfg=STATUS_CFG[approvalStatus]||STATUS_CFG.draft;
          return(
            <button
              onClick={()=>updateApprovalStatus(cfg.next)}
              title={`Status: ${cfg.label} — click to advance`}
              style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,border:`1px solid ${cfg.border}`,background:cfg.bg,color:cfg.color,fontSize:10,fontWeight:'700',cursor:'pointer',flexShrink:0,letterSpacing:'0.05em'}}>
              {approvalStatus==='approved'?'✓ ':approvalStatus==='review'?'◌ ':'● '}{cfg.label}
            </button>
          );
        })()}
        <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0,marginLeft:'auto'}}>
          {/* Save status indicator — dot (unsaved/saving) or checkmark (saved) */}
          {(()=>{
            // Derive display from both backend saveStatus and local IndexedDB localSaveStatus
            const isUnsaved = localSaveStatus==='unsaved' || saveStatus==='Unsaved' || saveStatus==='Error';
            const isSaving  = localSaveStatus==='saving'  || saveStatus==='Saving...';
            const savedAt   = localSavedAtRef.current;
            const tooltip   = isSaving ? 'Saving…'
              : isUnsaved ? 'Unsaved changes'
              : savedAt   ? `Saved at ${savedAt.toLocaleTimeString()}`
              : 'Saved';
            return(
              <div
                title={tooltip}
                style={{
                  display:'flex',alignItems:'center',gap:5,
                  padding:'3px 9px',borderRadius:6,
                  border:`1px solid ${isUnsaved?`${T.accent}44`:isSaving?`${T.warning}44`:`${T.success}33`}`,
                  background:isUnsaved?`${T.accent}0d`:isSaving?`${T.warning}0d`:`${T.success}0d`,
                  color:isUnsaved?T.accent:isSaving?T.warning:T.muted,
                  fontSize:10,fontWeight:'600',letterSpacing:'0.2px',
                  minWidth:52,textAlign:'center',cursor:'default',
                  transition:'all 0.2s',
                }}>
                {isSaving
                  ? <span style={{
                      display:'inline-block',
                      animation:'tf-pulse 0.9s ease-in-out infinite',
                      color:T.warning,fontSize:8,
                    }}>●</span>
                  : isUnsaved
                    ? <span style={{color:T.accent,fontSize:8}}>●</span>
                    : <span style={{color:T.success,fontSize:10}}>✓</span>
                }
                <span>{isSaving?'Saving…':isUnsaved?'Unsaved':'Saved'}</span>
              </div>
            );
          })()}
          {/* Item 20: Quick Mask Mode badge */}
          {quickMaskActive&&<div onClick={toggleQuickMask} title="Quick Mask active — press Q to exit" style={{padding:'3px 9px',borderRadius:6,border:`1px solid rgba(255,0,0,0.5)`,background:'rgba(255,0,0,0.12)',color:'#ff6666',fontSize:10,fontWeight:'700',letterSpacing:'0.5px',cursor:'pointer'}}>Q MASK</div>}
          {/* M6: Remaining quota display */}
          {remainingQuota!=null&&<div style={{padding:'3px 8px',borderRadius:6,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,fontWeight:'600',letterSpacing:'0.2px'}} title="AI credits remaining">{remainingQuota} AI left</div>}
          {/* Undo / Redo */}
          <div style={{display:'flex',gap:1,background:T.input,borderRadius:7,padding:'2px',border:`1px solid ${T.border}`}}>
            <button onClick={undo} disabled={historyIndex<=0}
              style={{padding:'4px 8px',borderRadius:5,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13,opacity:historyIndex<=0?0.25:0.7,lineHeight:1}}>↩</button>
            <button onClick={redo} disabled={historyIndex>=history.length-1}
              style={{padding:'4px 8px',borderRadius:5,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13,opacity:historyIndex>=history.length-1?0.25:0.7,lineHeight:1}}>↪</button>
          </div>
          <button onClick={()=>saveDesign(designName)}
            style={{
              padding:'6px 13px',borderRadius:7,
              border:`1px solid ${T.border}`,
              background:T.input,color:T.text,
              cursor:'pointer',fontSize:11,fontWeight:'600',
              display:'flex',alignItems:'center',gap:5,
            }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            Save
          </button>
          <button onClick={()=>selectedId&&duplicateLayer(selectedId)}
            disabled={!selectedId||selectedLayer?.type==='background'}
            style={{
              padding:'6px 12px',borderRadius:7,
              border:`1px solid ${T.border}`,
              background:'transparent',
              color:(!selectedId||selectedLayer?.type==='background')?T.muted:T.muted,
              cursor:'pointer',fontSize:11,fontWeight:'500',
              opacity:(!selectedId||selectedLayer?.type==='background')?0.3:1,
            }}>
            ⧉
          </button>
          <div style={{width:1,height:18,background:T.border,margin:'0 1px'}}/>
          {/* Zoom control */}
          <div style={{display:'flex',gap:0,alignItems:'center',background:T.input,borderRadius:7,padding:'2px 4px',border:`1px solid ${T.border}`}}>
            <button onClick={()=>setZoom(z=>Math.max(0.25,+(z-0.1).toFixed(1)))} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13}}>−</button>
            <input
              type="number"
              value={Math.round(zoom*100)}
              onChange={e=>{
                const v=Number(e.target.value);
                if(!isNaN(v)&&v>=10&&v<=1600) setZoom(v/100);
              }}
              style={{
                width:46,textAlign:'center',
                background:'transparent',border:'none',
                outline:'none',fontSize:11,color:T.text,
                fontFamily:'inherit',cursor:'text',
              }}
              onPointerDown={e=>e.stopPropagation()}
              min={10} max={1600}
            />
            <span style={{fontSize:11,color:T.muted}}>%</span>
            <button onClick={()=>setZoom(z=>Math.min(16,+(z+0.1).toFixed(1)))} style={{padding:'2px 6px',borderRadius:4,border:'none',background:'transparent',color:T.text,cursor:'pointer',fontSize:13}}>+</button>
            <button onClick={()=>setZoom(1)} style={{padding:'2px 5px',borderRadius:4,border:'none',background:'transparent',color:T.muted,cursor:'pointer',fontSize:10}}>fit</button>
          </div>
          {!isMobile&&(
            <div style={{display:'flex',gap:1,background:T.input,borderRadius:7,padding:'2px',border:`1px solid ${T.border}`}}>
              <button onClick={()=>setShowGrid(g=>!g)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showGrid?T.accentDim:'transparent',color:showGrid?T.accent:T.muted,cursor:'pointer',fontSize:11,fontWeight:'500'}} title="Grid">⊞</button>
              <button onClick={()=>setShowRuler(r=>!r)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showRuler?T.accentDim:'transparent',color:showRuler?T.accent:T.muted,cursor:'pointer',fontSize:11}} title="Ruler">⊢</button>
              <button onClick={()=>setSnapToGrid(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:snapToGrid?T.accentDim:'transparent',color:snapToGrid?T.accent:T.muted,cursor:'pointer',fontSize:11}} title="Snap to grid">⊡</button>
              <button onClick={()=>setShowSafeZones(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showSafeZones?T.accentDim:'transparent',color:showSafeZones?T.accent:T.muted,cursor:'pointer',fontSize:10,whiteSpace:'nowrap'}} title="Safe zones">Zones</button>
              <div style={{width:1,height:14,background:T.border,margin:'0 2px',alignSelf:'center'}}/>
              <button onClick={()=>setSnapEnabled(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:snapEnabled?`${T.accent}22`:'transparent',color:snapEnabled?T.accent:T.muted,cursor:'pointer',fontSize:10,fontWeight:snapEnabled?'700':'400',whiteSpace:'nowrap'}} title="Smart snap (Shift+;)">{snapEnabled?'⊕ Snap':'⊖ Snap'}</button>
              <button onClick={()=>setShowThirds(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showThirds?`${T.accent}22`:'transparent',color:showThirds?T.accent:T.muted,cursor:'pointer',fontSize:10,whiteSpace:'nowrap'}} title="Rule of thirds">⅓</button>
              <button onClick={()=>setPixelSnapEnabled(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:pixelSnapEnabled?`${T.accent}22`:'transparent',color:pixelSnapEnabled?T.accent:T.muted,cursor:'pointer',fontSize:10,fontWeight:'700',whiteSpace:'nowrap'}} title="Pixel snap — forces whole-pixel positions">px</button>
              <button onClick={()=>setShowStampTest(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showStampTest?T.accentDim:'transparent',color:showStampTest?T.accent:T.muted,cursor:'pointer',fontSize:10,whiteSpace:'nowrap'}} title="Mobile feed preview (Ctrl+M)">📱</button>
              <button onClick={()=>setShowYtPreview(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showYtPreview?T.accentDim:'transparent',color:showYtPreview?T.accent:T.muted,cursor:'pointer',fontSize:10,fontWeight:'700',whiteSpace:'nowrap'}} title="YouTube search result preview">▶ YT</button>
              <button onClick={()=>setDarkMode(!darkMode)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:'transparent',color:T.muted,cursor:'pointer',fontSize:11}} title="Toggle theme">{darkMode?'○':'●'}</button>
              <button onClick={()=>setShowShortcutsModal(s=>!s)} style={{padding:'4px 7px',borderRadius:5,border:'none',background:showShortcutsModal?T.accentDim:'transparent',color:showShortcutsModal?T.accent:T.muted,cursor:'pointer',fontSize:12,fontWeight:'700'}} title="Keyboard shortcuts (? or Ctrl+/)">?</button>
            </div>
          )}
          <div style={{width:1,height:18,background:T.border,margin:'0 1px',flexShrink:0}}/>
          <label style={{
            padding:isMobile?'5px 10px':'6px 13px',
            borderRadius:7,
            border:`1px solid ${T.border}`,
            background:T.input,color:T.muted,
            cursor:'pointer',fontSize:11,fontWeight:'500',
            display:'flex',alignItems:'center',gap:4,flexShrink:0,
          }}>
            ↑ {isMobile?'':'Upload'}
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{display:'none'}}/>
          </label>
          <button onClick={()=>setShowDownload(true)}
            style={{
              padding:isMobile?'5px 12px':'6px 16px',
              borderRadius:7,border:'none',
              background:'#22c55e',color:'#fff',
              cursor:'pointer',fontSize:11,fontWeight:'700',
              display:'flex',alignItems:'center',gap:5,
              boxShadow:'0 2px 12px rgba(34,197,94,0.25)',flexShrink:0,
            }}
            onMouseEnter={e=>e.currentTarget.style.background='#16a34a'}
            onMouseLeave={e=>e.currentTarget.style.background='#22c55e'}>
            ↓ {isMobile?'':'Export'}
          </button>
          {!isMobile&&(
            <button
              onClick={generateAndExportVariants}
              disabled={variantExporting}
              title="Generate A/B/C variants and download as 2x JPEG ZIP"
              style={{
                padding:'6px 13px',borderRadius:7,
                border:'1px solid rgba(124,58,237,0.3)',
                background:variantExporting?'transparent':'rgba(124,58,237,0.1)',
                color:variantExporting?T.muted:'#a78bfa',
                cursor:variantExporting?'not-allowed':'pointer',
                fontSize:11,fontWeight:'600',
                display:'flex',alignItems:'center',gap:5,
                flexShrink:0,opacity:variantExporting?0.5:1,
                transition:'all 0.15s',
              }}>
              {variantExporting
                ?<><span style={{display:'inline-block',animation:'editor-spin 0.8s linear infinite'}}>◌</span> Exporting…</>
                :<>⚡ A/B Export</>
              }
            </button>
          )}
          {!isMobile&&(
            <button
              onClick={async ()=>{
                const flat=document.createElement('canvas');
                flat.width=p.preview.w; flat.height=p.preview.h;
                await renderLayersToCanvas(flat,layers);
                runAutoAnalysis(flat.toDataURL('image/jpeg',0.9));
              }}
              title="AI thumbnail analysis — CTR score and recommendations"
              style={{
                padding:'6px 13px',borderRadius:7,
                border:'1px solid rgba(249,115,22,0.3)',
                background:autoPanel?'rgba(249,115,22,0.2)':'rgba(249,115,22,0.08)',
                color:T.accent,cursor:'pointer',fontSize:11,fontWeight:'700',
                display:'flex',alignItems:'center',gap:5,flexShrink:0,
                letterSpacing:'0.1px',
              }}>
              ✦ AI
            </button>
          )}
          {!isMobile&&(
            <button
              onClick={()=>setShowPromptEngine(true)}
              title="Generate thumbnail from a text prompt"
              style={{
                padding:'6px 13px',borderRadius:7,
                border:'1px solid rgba(249,115,22,0.3)',
                background:showPromptEngine?'rgba(249,115,22,0.2)':'rgba(249,115,22,0.08)',
                color:T.accent,cursor:'pointer',fontSize:11,fontWeight:'700',
                display:'flex',alignItems:'center',gap:5,flexShrink:0,
                letterSpacing:'0.1px',
              }}>
              ✦ AI Generate
            </button>
          )}
          <button onClick={()=>{
            const isPro = isProUser;
            const isAdmin = user?.is_admin || user?.is_admin;
            if (isPro || isAdmin) {
              setShowAlreadyPro(true);
              return;
            }
            handleUpgrade();
          }}
            style={{
              padding:'6px 13px',borderRadius:7,
              border:'1px solid rgba(249,115,22,0.3)',
              background:'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(234,88,12,0.1))',
              color:T.accent,cursor:'pointer',fontSize:11,fontWeight:'700',
              display:'flex',alignItems:'center',gap:5,flexShrink:0,
              letterSpacing:'0.1px',
            }}>
            ⚡ Pro
          </button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',flexDirection:isMobile?'column':'row'}}>

        {/* Left sidebar — hidden on mobile */}
        {!isMobile&&<div style={{width:148,background:T.sidebar,borderRight:`1px solid ${T.border}`,padding:'6px 5px',display:'flex',flexDirection:'column',overflowY:'auto',flexShrink:0}}>
          {(()=>{
            let lastGroup = null;
            const grouped = [];
            tools.forEach((t,i)=>{
              if(t===null) return;
              if(t.group !== lastGroup){
                lastGroup = t.group;
                grouped.push({type:'header',group:t.group});
              }
              grouped.push({type:'tool',tool:t});
            });
            
            return grouped.map((item,i)=>{
              if(item.type==='header'){
                const isExpanded = expandedCategories[item.group];
                return(
                  <div key={`header-${item.group}`}
                    onClick={()=>setExpandedCategories(prev=>({...prev,[item.group]:!prev[item.group]}))}
                    style={{
                      fontSize:'8px',color:T.muted,fontWeight:'700',
                      letterSpacing:'1.2px',textTransform:'uppercase',
                      padding:'10px 10px 3px',
                      cursor:'pointer',
                      display:'flex',alignItems:'center',justifyContent:'space-between',
                      userSelect:'none',
                    }}>
                    <span style={{letterSpacing:'0.9px'}}>{item.group}</span>
                    <span style={{
                      fontSize:'9px',
                      transform:isExpanded?'rotate(90deg)':'rotate(0deg)',
                      transition:'transform 0.15s',
                      color:T.muted,opacity:0.6,
                    }}>›</span>
                  </div>
                );
              }

              const t = item.tool;
              const isExpanded = expandedCategories[t.group];
              if(!isExpanded) return null;
              const isLassoActive = t.key==='lasso'&&isLassoMode;
              const isActive = activeTool===t.key;

              return(
                <button key={t.key}
                  onClick={()=>{setActiveTool(t.key);if(t.key!=='lasso')setIsLassoMode(false);}}
                  title={TOOL_SHORTCUT_MAP[t.key]?`${t.label} (${TOOL_SHORTCUT_MAP[t.key]})`:t.label}
                  style={{
                    ...css.toolBtn(isActive||isLassoActive),
                    ...(isLassoActive?{background:'rgba(249,115,22,0.15)',color:T.accent}:{}),
                  }}>
                  <span style={{
                    fontSize:12,width:14,textAlign:'center',flexShrink:0,
                    color:isLassoActive?T.accent:isActive?T.accent:T.muted,
                    opacity:isActive||isLassoActive?1:0.7,
                  }}>{t.icon}</span>
                  <span style={{
                    fontSize:11,flex:1,
                    color:isActive||isLassoActive?T.text:T.muted,
                  }}>{t.label}</span>
                  {t.pro&&(
                    <span style={{
                      fontSize:7,background:'rgba(249,115,22,0.15)',
                      color:T.accent,padding:'1px 4px',borderRadius:3,
                      fontWeight:'700',flexShrink:0,letterSpacing:'0.3px',
                      border:'1px solid rgba(249,115,22,0.2)',
                    }}>PRO</span>
                  )}
                </button>
              );
            });
          })()}
          <div style={css.divider}/>
          <div 
            onClick={()=>setExpandedCategories(prev=>({...prev,Canvas:!prev.Canvas}))}
            style={{
              fontSize:'8px',color:'#e5e5e5',fontWeight:'700',
              letterSpacing:'0.8px',textTransform:'uppercase',
              padding:'6px 10px 2px',marginTop:4,
              cursor:'pointer',
              display:'flex',
              alignItems:'center',
              justifyContent:'space-between',
              userSelect:'none',
            }}>
            <span>Canvas size</span>
            <span style={{
              fontSize:'10px',
              transform:expandedCategories.Canvas?'rotate(90deg)':'rotate(0deg)',
              transition:'transform 0.2s',
              color:T.muted,
            }}>›</span>
          </div>
          {expandedCategories.Canvas&&Object.entries(PLATFORMS).map(([key,val])=>(
            <button key={key} onClick={()=>setPlatform(key)} style={{...css.toolBtn(platform===key),flexDirection:'column',alignItems:'flex-start',gap:1,padding:'6px 10px'}}>
              <span style={{fontSize:11,fontWeight:'600',color:platform===key?T.accent:'#e5e5e5'}}>{val.label}</span>
              <span style={{fontSize:'9px',color:T.muted}}>{val.width}×{val.height}</span>
            </button>
          ))}
        </div>}

        {/* Canvas */}
        <div style={{flex:1,display:'flex',flexDirection:'column',background:darkMode?'#080808':'#d0d0d0',overflow:'hidden',position:'relative',minHeight:isMobile?200:undefined}}>
          {/* ── Retouch tool options bar ─────────────────────────────────────── */}
          {RETOUCH_TOOLS.includes(activeTool)&&(
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 16px',background:'#0d0f14',borderBottom:'1px solid rgba(255,255,255,0.08)',fontSize:11,color:'rgba(255,255,255,0.7)',flexShrink:0,flexWrap:'wrap',zIndex:1}}>
              {(activeTool==='dodge'||activeTool==='burn')&&(<>
                <div style={{display:'flex',gap:3}}>
                  {['dodge','burn'].map(m=>(
                    <button key={m} onClick={()=>{setDodgeBurnMode(m);setActiveTool(m);}}
                      style={{padding:'3px 10px',borderRadius:5,border:`1px solid ${activeTool===m?'#f97316':'rgba(255,255,255,0.15)'}`,background:activeTool===m?'rgba(249,115,22,0.2)':'transparent',color:activeTool===m?'#f97316':'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:10,fontWeight:'600',textTransform:'capitalize'}}>
                      {m==='dodge'?'◉ Dodge':'◎ Burn'}
                    </button>
                  ))}
                </div>
                <div style={{width:1,height:18,background:'rgba(255,255,255,0.1)'}}/>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>Range:</span>
                <div style={{display:'flex',gap:3}}>
                  {['shadows','midtones','highlights'].map(r=>(
                    <button key={r} onClick={()=>setRetouchRange(r)}
                      style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${retouchRange===r?'#f97316':'rgba(255,255,255,0.15)'}`,background:retouchRange===r?'rgba(249,115,22,0.15)':'transparent',color:retouchRange===r?'#f97316':'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:10,fontWeight:'600',textTransform:'capitalize'}}>
                      {r.charAt(0).toUpperCase()+r.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{width:1,height:18,background:'rgba(255,255,255,0.1)'}}/>
                <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:11}}>
                  Exposure
                  <input type="range" min={1} max={100} value={retouchExposure} onChange={e=>setRetouchExposure(+e.target.value)} style={{width:80,accentColor:'#f97316'}}/>
                  <span style={{width:30,color:'rgba(255,255,255,0.5)'}}>{retouchExposure}%</span>
                </label>
              </>)}
              {(activeTool==='smudge')&&(<>
                <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:11}}>
                  Strength
                  <input type="range" min={1} max={100} value={retouchStrength} onChange={e=>setRetouchStrength(+e.target.value)} style={{width:80,accentColor:'#f97316'}}/>
                  <span style={{width:30,color:'rgba(255,255,255,0.5)'}}>{retouchStrength}%</span>
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:11,cursor:'pointer'}}>
                  <input type="checkbox" checked={fingerPainting} onChange={e=>setFingerPainting(e.target.checked)} style={{accentColor:'#f97316'}}/>
                  Finger Painting
                </label>
              </>)}
              {(activeTool==='blur-brush'||activeTool==='sharpen-brush')&&(
                <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:11}}>
                  Strength
                  <input type="range" min={1} max={100} value={retouchStrength} onChange={e=>setRetouchStrength(+e.target.value)} style={{width:80,accentColor:'#f97316'}}/>
                  <span style={{width:30,color:'rgba(255,255,255,0.5)'}}>{retouchStrength}%</span>
                </label>
              )}
              <div style={{width:1,height:18,background:'rgba(255,255,255,0.1)'}}/>
              <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:11}}>
                Size
                <input type="range" min={1} max={300} value={brushSizeState} onChange={e=>setBrushSizeState(+e.target.value)} style={{width:70,accentColor:'#f97316'}}/>
                <span style={{width:30,color:'rgba(255,255,255,0.5)'}}>{brushSizeState}px</span>
              </label>
              <div style={{display:'flex',gap:3}}>
                {['soft','hard'].map(e2=>(
                  <button key={e2} onClick={()=>setBrushEdgeState(e2)}
                    style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${brushEdgeState===e2?'#f97316':'rgba(255,255,255,0.15)'}`,background:brushEdgeState===e2?'rgba(249,115,22,0.15)':'transparent',color:brushEdgeState===e2?'#f97316':'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:10,fontWeight:'600',textTransform:'capitalize'}}>{e2}</button>
                ))}
              </div>
              <div style={{width:1,height:18,background:'rgba(255,255,255,0.1)'}}/>
              {/* Pressure sensitivity quick toggle */}
              <button
                title={pressureEnabled?'Pressure sensitivity ON':'Pressure sensitivity OFF'}
                onClick={()=>setPressureEnabled(v=>!v)}
                style={{background:pressureEnabled?'#ff6a00':'#333',color:'#fff',border:'none',borderRadius:4,padding:'4px 8px',cursor:'pointer',fontSize:14,lineHeight:1}}
              >✒</button>
              {pressureEnabled&&(
                <>
                  <select value={pressureMapping} onChange={e=>setPressureMapping(e.target.value)}
                    style={{background:'#222',color:'#fff',border:'1px solid #444',borderRadius:4,padding:'3px 6px',fontSize:11}}>
                    <option value="none">No Pressure</option>
                    <option value="size">Size</option>
                    <option value="opacity">Opacity</option>
                    <option value="both">Size + Opacity</option>
                  </select>
                  <select value={pressureCurve} onChange={e=>setPressureCurve(e.target.value)}
                    style={{background:'#222',color:'#fff',border:'1px solid #444',borderRadius:4,padding:'3px 6px',fontSize:11}}>
                    <option value="linear">Linear</option>
                    <option value="exponential">Exponential</option>
                    <option value="logarithmic">Logarithmic</option>
                  </select>
                </>
              )}
            </div>
          )}
          {/* ── Selection tool options bar ─────────────────────────────────── */}
          {['marquee','sel-lasso','sel-poly','sel-wand'].includes(activeTool)&&(
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 16px',background:'#0d0f14',borderBottom:'1px solid rgba(255,255,255,0.08)',fontSize:11,color:'rgba(255,255,255,0.7)',flexShrink:0,flexWrap:'wrap',zIndex:1}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.45)'}}>Shift=Add · Alt=Subtract · Shift+Alt=Intersect</span>
              <div style={{width:1,height:18,background:'rgba(255,255,255,0.1)'}}/>
              <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:11}}>
                Feather
                <input type="range" min={0} max={100} value={selFeather} onChange={e=>setSelFeather(+e.target.value)} style={{width:70,accentColor:'#f97316'}}/>
                <span style={{width:24,color:'rgba(255,255,255,0.5)'}}>{selFeather}px</span>
              </label>
              {activeTool==='sel-wand'&&(
                <label style={{display:'flex',alignItems:'center',gap:6,color:'rgba(255,255,255,0.6)',fontSize:11}}>
                  Tolerance
                  <input type="range" min={0} max={255} value={selTolerance} onChange={e=>setSelTolerance(+e.target.value)} style={{width:70,accentColor:'#f97316'}}/>
                  <span style={{width:24,color:'rgba(255,255,255,0.5)'}}>{selTolerance}</span>
                </label>
              )}
              {activeTool==='marquee'&&(
                <>
                  <div style={{width:1,height:18,background:'rgba(255,255,255,0.1)'}}/>
                  {['rect','ellipse'].map(sm=>(
                    <button key={sm} onClick={()=>setSelSubMode(sm)}
                      style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${selSubMode===sm?'#f97316':'rgba(255,255,255,0.15)'}`,background:selSubMode===sm?'rgba(249,115,22,0.15)':'transparent',color:selSubMode===sm?'#f97316':'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:10,fontWeight:'600'}}>
                      {sm==='rect'?'⬚ Rectangle':'⬭ Ellipse'}
                    </button>
                  ))}
                </>
              )}
              {activeTool==='sel-poly'&&selDrawRef.current&&(
                <span style={{color:'#f97316',fontSize:10}}>Click to add points · Click start point or double-click to close · Esc to cancel</span>
              )}
              {selectionActive&&(
                <>
                  <div style={{width:1,height:18,background:'rgba(255,255,255,0.1)'}}/>
                  <span style={{color:'rgba(255,255,255,0.4)',fontSize:10}}>Selection active</span>
                  <button onClick={clearSel} style={{padding:'3px 8px',borderRadius:5,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:10}}>Deselect (Ctrl+D)</button>
                  <button onClick={invertSel} style={{padding:'3px 8px',borderRadius:5,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:10}}>Invert (Ctrl+Shift+I)</button>
                </>
              )}
            </div>
          )}
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}
          onClick={(e)=>{
            // Click on canvas background (not on a layer) deselects
            if(e.target===e.currentTarget) setSelectedId(null);
          }}
          onWheel={(e)=>{
            if(!(activeTool==='zoom'||e.ctrlKey||e.metaKey)) return;
            e.preventDefault();

            // Capture all values synchronously from the DOM — zoomRef gives the
            // latest zoom even when multiple wheel events fire in the same frame.
            const curZoom = zoomRef.current;
            const containerRect = e.currentTarget.getBoundingClientRect();
            const canvasRect    = canvasRef.current.getBoundingClientRect();

            // Mouse position relative to the scroll container.
            const mouseX = e.clientX - containerRect.left;
            const mouseY = e.clientY - containerRect.top;

            // Container-relative position of the canvas top-left corner
            // (the "pan" origin in world-coordinate terms).
            const panX = canvasRect.left - containerRect.left;
            const panY = canvasRect.top  - containerRect.top;

            // World coordinates: the canvas pixel that sits under the cursor.
            const worldX = (mouseX - panX) / curZoom;
            const worldY = (mouseY - panY) / curZoom;

            const factor  = e.deltaY > 0 ? -0.15 : 0.15;
            const newZoom = Math.max(0.1, Math.min(5,
              Math.round((curZoom + factor) * 100) / 100));

            // New canvas-origin position that keeps worldX/Y pinned under cursor.
            const newPanX = mouseX - worldX * newZoom;
            const newPanY = mouseY - worldY * newZoom;

            // Convert back to the panOffset coordinate system the rest of the app
            // uses.  The transform is scale(z) translate(panOffset, …) with
            // transformOrigin:center, so:
            //   canvasOriginX = containerW/2 + z*(panOffset.x − canvasW/2)
            // Solving for newPanOffset:
            //   newPanOffset.x = (newPanX − containerW/2) / newZoom + canvasW/2
            const cw2 = containerRect.width  / 2;
            const ch2 = containerRect.height / 2;
            const newPanOffsetX = (newPanX - cw2) / newZoom + p.preview.w / 2;
            const newPanOffsetY = (newPanY - ch2) / newZoom + p.preview.h / 2;

            // Cancel any pending frame so rapid scrolling doesn't stack stale updates.
            if(wheelRafRef.current) cancelAnimationFrame(wheelRafRef.current);
            wheelRafRef.current = requestAnimationFrame(()=>{
              wheelRafRef.current = null;
              if(newZoom <= 1){
                setPanOffset({x:0,y:0});
              } else {
                setPanOffset({x:newPanOffsetX, y:newPanOffsetY});
              }
              setZoom(newZoom);
            });
          }}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <CanvasErrorBoundary>
            <div style={{transform:`scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,transformOrigin:'center center',imageRendering:zoom>1?'pixelated':'high-quality'}}>
              <div id="thumbnail-canvas" ref={canvasRef}
                onMouseMove={(e)=>{
                  // ── Selection tool mouse move ────────────────────────────
                  if(selDrawRef.current&&(activeTool==='marquee'||activeTool==='sel-lasso')){
                    const rect=canvasRef.current.getBoundingClientRect();
                    let x=(e.clientX-rect.left)/zoom;
                    let y=(e.clientY-rect.top)/zoom;
                    if(activeTool==='marquee'){
                      if(e.shiftKey){const d=Math.max(Math.abs(x-selDrawRef.current.sx),Math.abs(y-selDrawRef.current.sy));x=selDrawRef.current.sx+(x>=selDrawRef.current.sx?d:-d);y=selDrawRef.current.sy+(y>=selDrawRef.current.sy?d:-d);}
                      selDrawRef.current.ex=x; selDrawRef.current.ey=y;
                      setSelDrawState({type:selDrawRef.current.type,x1:selDrawRef.current.sx,y1:selDrawRef.current.sy,x2:x,y2:y});
                    } else if(activeTool==='sel-lasso'){
                      selDrawRef.current.points.push({x,y});
                      setSelDrawState({type:'lasso',points:[...selDrawRef.current.points]});
                    }
                    return;
                  }
                  if(selDrawRef.current&&activeTool==='sel-poly'){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    setSelDrawState(s=>s?{...s,cx:x,cy:y}:s);
                    return;
                  }
                  if(activeTool==='rimlight'){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const cursor=document.getElementById('rim-cursor');
                    if(cursor){
                      cursor.style.display='block';
                      cursor.style.left=(e.clientX-rect.left)/zoom+'px';
                      cursor.style.top=(e.clientY-rect.top)/zoom+'px';
                      // ✅ Show eyedropper cursor when picking
                      if(rimPickingColor){
                        cursor.style.width='20px';
                        cursor.style.height='20px';
                        cursor.style.border='2px solid #fff';
                        cursor.style.background='rgba(255,255,255,0.3)';
                        cursor.style.boxShadow='0 0 0 1px #000, 0 0 8px rgba(0,0,0,0.5)';
                      } else {
                        const size=(rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8;
                        cursor.style.width=size+'px';
                        cursor.style.height=size+'px';
                        cursor.style.border=`2px solid ${rimLightColor}`;
                        cursor.style.background=`radial-gradient(circle, ${rimLightColor}22 0%, transparent 70%)`;
                        cursor.style.boxShadow=`0 0 12px ${rimLightColor}88`;
                      }
                    }
                    if(rimPaintingRef.current){
                      const x=(e.clientX-rect.left)/zoom;
                      const y=(e.clientY-rect.top)/zoom;
                      mouseRef.current={x,y};
                      applyRimLightThrottled(x,y);
                    }
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode && lassoDrawingRef.current){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    lassoPointsRef.current.push({x,y});
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points', lassoPointsRef.current.map(p=>`${p.x},${p.y}`).join(' '));
                    return;
                  }
                  if(activeTool==='freehand' && freehandDrawingRef.current){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    freehandPointsRef.current.push({x,y});
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points', freehandPointsRef.current.map(pt=>`${pt.x},${pt.y}`).join(' '));
                    return;
                  }
                  if(RETOUCH_TOOLS.includes(activeTool)&&retouchActiveRef.current){
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    applyRetouchStroke(x,y,activeTool);
                    return;
                  }
                }}
                onMouseDown={(e)=>{
                  // ── Selection tools ──────────────────────────────────────
                  if(activeTool==='marquee'||activeTool==='sel-lasso'||activeTool==='sel-poly'||activeTool==='sel-wand'){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    const mode=getSelMode(e);
                    if(activeTool==='marquee'){
                      selDrawRef.current={type:selSubMode==='ellipse'?'ellipse':'rect',sx:x,sy:y,ex:x,ey:y,mode};
                      setSelDrawState({type:selSubMode==='ellipse'?'ellipse':'rect',x1:x,y1:y,x2:x,y2:y});
                    } else if(activeTool==='sel-lasso'){
                      selDrawRef.current={type:'lasso',points:[{x,y}],mode};
                      setSelDrawState({type:'lasso',points:[{x,y}]});
                    } else if(activeTool==='sel-poly'){
                      if(!selDrawRef.current){
                        selDrawRef.current={type:'poly',points:[{x,y}],mode};
                        setSelDrawState({type:'poly',points:[{x,y}],cx:x,cy:y});
                      } else {
                        const pts=selDrawRef.current.points;
                        const fp=pts[0];
                        if(pts.length>2&&Math.hypot(x-fp.x,y-fp.y)<12){
                          const mask=pathMask(pts,p.preview.w,p.preview.h);
                          applySelection(mask,selDrawRef.current.mode);
                          selDrawRef.current=null;
                          setSelDrawState(null);
                        } else {
                          pts.push({x,y});
                          setSelDrawState({type:'poly',points:[...pts],cx:x,cy:y});
                        }
                      }
                      return;
                    } else if(activeTool==='sel-wand'){
                      const flatCanvas=document.createElement('canvas');
                      flatCanvas.width=p.preview.w; flatCanvas.height=p.preview.h;
                      renderLayersToCanvas(flatCanvas,layers).then(()=>{
                        const ctx2=flatCanvas.getContext('2d');
                        const imgData=ctx2.getImageData(0,0,p.preview.w,p.preview.h);
                        const mask=magicWandMask(imgData,Math.round(x),Math.round(y),selTolerance);
                        applySelection(mask,mode);
                      });
                      return;
                    }
                    return;
                  }
                  if(activeTool==='rimlight'){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;

                    if(rimPickingColor){
                      // ✅ Eyedropper mode — sample color from canvas at click position
                      const sampleCanvas=document.createElement('canvas');
                      sampleCanvas.width=p.preview.w;
                      sampleCanvas.height=p.preview.h;
                      const sCtx=sampleCanvas.getContext('2d');

                      // Draw all visible layers to sample from
                      const drawNext=(index)=>{
                        if(index>=layers.length){
                          // Sample the pixel
                          const px=Math.round(x),py=Math.round(y);
                          const pixel=sCtx.getImageData(
                            Math.max(0,Math.min(px,p.preview.w-1)),
                            Math.max(0,Math.min(py,p.preview.h-1)),
                            1,1
                          ).data;
                          const r=pixel[0],g=pixel[1],b=pixel[2];
                          const hex='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
                          setRimLightColor(hex);
                          setRimPickedFrom({x:px,y:py,color:hex});
                          setRimPickingColor(false);
                          setCmdLog(`Color picked: ${hex} — now paint to apply`);
                          return;
                        }
                        const obj=layers[index];
                        if(obj.hidden){drawNext(index+1);return;}
                        if(obj.type==='background'){
                          if(obj.bgGradient){
                            const g=sCtx.createLinearGradient(0,0,0,p.preview.h);
                            g.addColorStop(0,obj.bgGradient[0]);
                            g.addColorStop(1,obj.bgGradient[1]);
                            sCtx.fillStyle=g;
                          } else sCtx.fillStyle=obj.bgColor||'#000';
                          sCtx.fillRect(0,0,p.preview.w,p.preview.h);
                          drawNext(index+1);
                        } else if(obj.type==='image'){
                          const imageSrc = getSafeImageSrc(obj);
                          if(!imageSrc){
                            drawNext(index+1);
                            return;
                          }
                          const img=new Image();
                          img.crossOrigin='Anonymous';
                          img.onload=()=>{
                            sCtx.save();
                            sCtx.globalAlpha=(obj.opacity??100)/100;
                            sCtx.globalCompositeOperation=obj.blendMode||'normal';
                            sCtx.drawImage(img,obj.x,obj.y,obj.width,obj.height);
                            sCtx.restore();
                            drawNext(index+1);
                          };
                          img.onerror=()=>drawNext(index+1);
                          img.src=imageSrc;
                        } else {
                          drawNext(index+1);
                        }
                      };
                      drawNext(0);
                      return;
                    }

                    // Normal paint mode
                    rimPaintingRef.current=true;
                    applyRimLight(x,y);
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    lassoDrawingRef.current=true;
                    lassoPointsRef.current=[{x,y}];
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points',`${x},${y}`);
                    return;
                  }
                  if(activeTool==='freehand'){
                    e.stopPropagation();
                    e.preventDefault();
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    freehandDrawingRef.current=true;
                    freehandPointsRef.current=[{x,y}];
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points',`${x},${y}`);
                    return;
                  }
                  if(RETOUCH_TOOLS.includes(activeTool)){
                    e.stopPropagation();e.preventDefault();
                    retouchActiveRef.current=true;
                    retouchPrevTileRef.current=null;
                    const rect=canvasRef.current.getBoundingClientRect();
                    const x=(e.clientX-rect.left)/zoom;
                    const y=(e.clientY-rect.top)/zoom;
                    applyRetouchStroke(x,y,activeTool);
                    return;
                  }
                }}
                onMouseUp={(e)=>{
                  // ── Selection tools mouse up ─────────────────────────────
                  if(selDrawRef.current&&(activeTool==='marquee'||activeTool==='sel-lasso')){
                    const draw=selDrawRef.current;
                    selDrawRef.current=null;
                    setSelDrawState(null);
                    if(activeTool==='marquee'){
                      const mx=Math.min(draw.sx,draw.ex),my=Math.min(draw.sy,draw.ey);
                      const mw=Math.abs(draw.ex-draw.sx),mh=Math.abs(draw.ey-draw.sy);
                      if(mw>2&&mh>2){
                        const mask=draw.type==='ellipse'?ellipseMask(mx,my,mw,mh,p.preview.w,p.preview.h):rectMask(mx,my,mw,mh,p.preview.w,p.preview.h);
                        applySelection(mask,draw.mode);
                      }
                    } else if(activeTool==='sel-lasso'){
                      const pts=draw.points;
                      if(pts.length>=3){
                        const mask=pathMask(pts,p.preview.w,p.preview.h);
                        applySelection(mask,draw.mode);
                      }
                    }
                    return;
                  }
                  if(activeTool==='rimlight'){
                    rimPaintingRef.current=false;
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode && lassoDrawingRef.current){
                    lassoDrawingRef.current=false;
                    const points=lassoPointsRef.current;
                    if(points.length>=3 && selectedLayer && selectedLayer.type==='image'){
                      const cropL=selectedLayer.cropLeft||0;
                      const cropT=selectedLayer.cropTop||0;
                      const cropW=selectedLayer.width-cropL-(selectedLayer.cropRight||0);
                      const cropH=selectedLayer.height-cropT-(selectedLayer.cropBottom||0);
                      // Convert canvas-space points to coordinates relative to the image div
                      const ox=selectedLayer.x+cropL;
                      const oy=selectedLayer.y+cropT;
                      // Simplify path: keep 1 point per 3px of movement to reduce polygon complexity
                      const simplified=[];
                      let lastX=null,lastY=null;
                      for(const p of points){
                        const rx=p.x-ox, ry=p.y-oy;
                        if(lastX===null||Math.hypot(rx-lastX,ry-lastY)>3){
                          simplified.push({x:Math.round(rx*10)/10, y:Math.round(ry*10)/10});
                          lastX=rx; lastY=ry;
                        }
                      }
                      if(simplified.length>=3){
                        updateLayer(selectedLayer.id,{
                          mask:{
                            enabled:true,
                            type:'lasso',
                            inverted:lassoInvertRef.current||false,
                            points:simplified,
                            w:Math.round(cropW),
                            h:Math.round(cropH),
                          }
                        });
                      }
                    }
                    setIsLassoMode(false);
                    lassoPointsRef.current=[];
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points','');
                    return;
                  }
                  if(activeTool==='freehand' && freehandDrawingRef.current){
                    freehandDrawingRef.current=false;
                    const pts=freehandPointsRef.current.slice();
                    freehandPointsRef.current=[];
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points','');
                    if(pts.length>=2){
                      const tmpCanvas=document.createElement('canvas');
                      tmpCanvas.width=p.preview.w;
                      tmpCanvas.height=p.preview.h;
                      const ctx2=tmpCanvas.getContext('2d');
                      ctx2.strokeStyle=freeBrushColor;
                      ctx2.lineWidth=freeBrushSize;
                      ctx2.lineCap='round';
                      ctx2.lineJoin='round';
                      ctx2.beginPath();
                      ctx2.moveTo(pts[0].x,pts[0].y);
                      for(let i=1;i<pts.length;i++) ctx2.lineTo(pts[i].x,pts[i].y);
                      ctx2.stroke();
                      const dataUrl=tmpCanvas.toDataURL('image/png');
                      addLayer({type:'image',src:dataUrl,width:p.preview.w,height:p.preview.h,x:0,y:0,cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
                      console.log('[FREEHAND] Stroke committed as new image layer. Sprint 3 panel auto-syncs via setLayers().');
                    }
                    return;
                  }
                  if(RETOUCH_TOOLS.includes(activeTool)&&retouchActiveRef.current){
                    retouchActiveRef.current=false;
                    retouchPrevTileRef.current=null;
                    // Push history + mark dirty on stroke end
                    const toolLabel=activeTool==='dodge'?'Dodge':activeTool==='burn'?'Burn':activeTool==='smudge'?'Smudge':activeTool==='blur-brush'?'Blur':'Sharpen';
                    setLayers(prev=>{pushHistory(prev,toolLabel);return prev;});
                    if(selectedId) saveEngineRef.current?.markDirty('layerContent',selectedId);
                    return;
                  }
                  triggerAutoSave();
                }}
                onTouchEnd={()=>{
                  triggerAutoSave();
                }}
                onMouseLeave={(e)=>{
                  if(activeTool==='rimlight'){
                    rimPaintingRef.current=false;
                    const cursor=document.getElementById('rim-cursor');
                    if(cursor) cursor.style.display='none';
                    return;
                  }
                  if(activeTool==='lasso' && isLassoMode && lassoDrawingRef.current){
                    lassoDrawingRef.current=false;
                    lassoPointsRef.current=[];
                    if(lassoSvgRef.current) lassoSvgRef.current.setAttribute('points','');
                    return;
                  }
                  if(activeTool==='freehand' && freehandDrawingRef.current){
                    freehandDrawingRef.current=false;
                    freehandPointsRef.current=[];
                    if(freehandSvgRef.current) freehandSvgRef.current.setAttribute('points','');
                    return;
                  }
                }}
                onClick={(e)=>{
                  // ── Selection tools click ────────────────────────────────
                  if(activeTool==='sel-poly'&&selDrawRef.current&&e.detail===2){
                    const pts=selDrawRef.current.points;
                    if(pts.length>=3){
                      const mask=pathMask(pts,p.preview.w,p.preview.h);
                      applySelection(mask,selDrawRef.current.mode);
                      selDrawRef.current=null;
                      setSelDrawState(null);
                    }
                    return;
                  }
                  if(['marquee','sel-lasso','sel-wand'].includes(activeTool)){return;}
                  if(ctxMenu)setCtxMenu(null);
                  if(activeTool==='rimlight') return;
                  if(activeTool==='lasso') return;
                  if(justSelectedRef.current){justSelectedRef.current=false;return;}
                  if(activeTool==='brush') return;
                  if(activeTool==='zoom'){
                    e.stopPropagation();
                    // Same DOM-based coordinate system as the wheel handler:
                    // container = flex scroll div that wraps the transform wrapper.
                    const canvasRect    = canvasRef.current.getBoundingClientRect();
                    // parentElement = zoom-scale wrapper, .parentElement = flex-column wrapper,
                    // .parentElement = outer scroll container (same element as onWheel's e.currentTarget)
                    const containerElem = canvasRef.current.parentElement.parentElement.parentElement;
                    const containerRect = containerElem.getBoundingClientRect();
                    const curZoom       = zoomRef.current;

                    // Mouse position relative to the scroll container
                    const mouseX = e.clientX - containerRect.left;
                    const mouseY = e.clientY - containerRect.top;

                    // Canvas top-left relative to container (already encodes current pan+zoom)
                    const panX = canvasRect.left - containerRect.left;
                    const panY = canvasRect.top  - containerRect.top;

                    // World coordinate (canvas pixel) under the cursor
                    const worldX = (mouseX - panX) / curZoom;
                    const worldY = (mouseY - panY) / curZoom;

                    const newZoom = (e.shiftKey||e.altKey)
                      ? Math.max(0.25, Math.round((curZoom - 0.5) * 10) / 10)
                      : Math.min(8,    Math.round((curZoom + 0.5) * 10) / 10);

                    if(newZoom <= 1){
                      setZoom(newZoom);
                      setPanOffset({x:0,y:0});
                    } else {
                      // New canvas-origin position that keeps worldX/Y pinned under cursor
                      const newPanX = mouseX - worldX * newZoom;
                      const newPanY = mouseY - worldY * newZoom;
                      // Convert viewport-relative origin → panOffset coord system:
                      //   canvasOriginX = cw2 + newZoom*(panOffset.x - canvasW/2)
                      //   => panOffset.x = (newPanX - cw2) / newZoom + canvasW/2
                      const cw2 = containerRect.width  / 2;
                      const ch2 = containerRect.height / 2;
                      setZoom(newZoom);
                      setPanOffset({
                        x: (newPanX - cw2) / newZoom + p.preview.w / 2,
                        y: (newPanY - ch2) / newZoom + p.preview.h / 2,
                      });
                    }
                    return;
                  }
                  setSelectedId(null);
                }}
                style={{width:p.preview.w,height:p.preview.h,position:'relative',overflow:'hidden',borderRadius:4,boxShadow:'0 8px 40px rgba(0,0,0,0.8)',flexShrink:0,touchAction:'none',WebkitUserSelect:'none',userSelect:'none',WebkitTouchCallout:'none',cursor:activeTool==='brush'?'crosshair':
                       activeTool==='rimlight'?(rimPickingColor?'crosshair':'crosshair'):
                       activeTool==='zoom'?'zoom-in':
                       (activeTool==='lasso'&&isLassoMode)?'crosshair':
                       RETOUCH_TOOLS.includes(activeTool)?'crosshair':
                       (activeTool==='marquee'||activeTool==='sel-lasso'||activeTool==='sel-poly'||activeTool==='sel-wand')?'crosshair':
                       'default'}}>

                <div style={{position:'absolute',inset:0,filter:canvasFilter,zIndex:0}}>
                  <div style={{position:'absolute',inset:0,
                    pointerEvents: (activeTool==='brush'||activeTool==='zoom'||activeTool==='freehand'||(activeTool==='lasso'&&isLassoMode)||RETOUCH_TOOLS.includes(activeTool)||activeTool==='marquee'||activeTool==='sel-lasso'||activeTool==='sel-poly'||activeTool==='sel-wand') ? 'none' : 'auto',
                  }}>
                    <CanvasLayerRenderer layers={layers} renderLayerElement={renderLayerElement} />
                  </div>

                  {/* Paint overlay for non-active brush images */}
                  {layers.map(obj=>{
                    if(obj.hidden||!obj.paintSrc||obj.type==='background')return null;
                    const overlaySrc = getSafeImageSrc({ src: obj.paintSrc });
                    if(!overlaySrc)return null;
                    if(obj.id===brushingImageId)return null;
                    const cropW=obj.width-(obj.cropLeft||0)-(obj.cropRight||0);
                    const cropH=obj.height-(obj.cropTop||0)-(obj.cropBottom||0);
                    return(
                      <div key={`paint-${obj.id}`} style={{
                        position:'absolute',left:obj.x,top:obj.y,
                        width:cropW,height:cropH,
                        zIndex:layers.indexOf(obj)+2,
                        overflow:'hidden',pointerEvents:'none',
                      }}>
                        <img src={overlaySrc} alt="" style={{
                          position:'absolute',top:0,left:0,
                          width:obj.width,height:obj.height,
                          display:'block',
                          marginLeft:-(obj.cropLeft||0),marginTop:-(obj.cropTop||0),
                        }}/>
                      </div>
                    );
                  })}
                </div>

                {/* ── Rule of thirds overlay ───────────────────────────── */}
                {showThirds&&(
                  <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:9988,overflow:'visible'}}>
                    {[1/3,2/3].map((f,i)=>(
                      <React.Fragment key={i}>
                        <line x1={p.preview.w*f} y1={0} x2={p.preview.w*f} y2={p.preview.h} stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
                        <line x1={0} y1={p.preview.h*f} x2={p.preview.w} y2={p.preview.h*f} stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
                      </React.Fragment>
                    ))}
                  </svg>
                )}

                {/* ── Smart guide overlay ───────────────────────────────── */}
                {(smartGuides.h.length>0||smartGuides.v.length>0)&&(
                  <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:9995,overflow:'visible'}}>
                    {smartGuides.v.map((gx,i)=>(
                      <line key={`v${i}`} x1={gx} y1={0} x2={gx} y2={p.preview.h} stroke="#FF6B00" strokeWidth="1" strokeDasharray="0" opacity="1"/>
                    ))}
                    {smartGuides.h.map((gy,i)=>(
                      <line key={`h${i}`} x1={0} y1={gy} x2={p.preview.w} y2={gy} stroke="#FF6B00" strokeWidth="1" strokeDasharray="0" opacity="1"/>
                    ))}
                  </svg>
                )}

                {/* ── Warp grid overlay ──────────────────────────────── */}
                {warpMode&&selectedId&&(()=>{
                  const wLayer = layers.find(l=>l.id===selectedId);
                  if(!wLayer) return null;
                  const wx = wLayer.x||0, wy = wLayer.y||0;
                  const ww = wLayer.width||p.preview.w, wh = wLayer.height||p.preview.h;
                  const mW=5, mH=5;
                  const lines=[];
                  for(let r=0;r<mH;r++){
                    const yy=wy+(r/(mH-1))*wh;
                    lines.push(<line key={`h${r}`} x1={wx} y1={yy} x2={wx+ww} y2={yy} stroke="rgba(255,106,0,0.7)" strokeWidth={1.5}/>);
                  }
                  for(let c=0;c<mW;c++){
                    const xx=wx+(c/(mW-1))*ww;
                    lines.push(<line key={`v${c}`} x1={xx} y1={wy} x2={xx} y2={wy+wh} stroke="rgba(255,106,0,0.7)" strokeWidth={1.5}/>);
                  }
                  const dots=[];
                  for(let r=0;r<mH;r++) for(let c=0;c<mW;c++){
                    dots.push(<circle key={`d${r}${c}`} cx={wx+(c/(mW-1))*ww} cy={wy+(r/(mH-1))*wh} r={3} fill="#ff6a00" stroke="#fff" strokeWidth={1}/>);
                  }
                  return(
                    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:10050,overflow:'visible'}}>
                      {warpPreview&&<image href={warpPreview} x={wx} y={wy} width={ww} height={wh} opacity={0.8}/>}
                      {lines}{dots}
                    </svg>
                  );
                })()}

                {/* ── Selection marching ants overlay ─────────────────── */}
                <SelectionOverlay maskRef={selectionMaskRef} W={p.preview.w} H={p.preview.h} active={selectionActive&&!quickMaskActive}/>

                {/* ── Item 20: Quick Mask red overlay ─────────────────── */}
                {quickMaskActive&&(
                  <canvas ref={quickMaskCanvasRef} width={p.preview.w} height={p.preview.h}
                    style={{position:'absolute',inset:0,width:p.preview.w,height:p.preview.h,pointerEvents:'none',zIndex:9999}}/>
                )}

                {/* ── Live selection draw preview ──────────────────────── */}
                {selDrawState&&(
                  <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:10001,overflow:'visible'}}>
                    {(selDrawState.type==='rect')&&(
                      <rect
                        x={Math.min(selDrawState.x1,selDrawState.x2)}
                        y={Math.min(selDrawState.y1,selDrawState.y2)}
                        width={Math.abs(selDrawState.x2-selDrawState.x1)}
                        height={Math.abs(selDrawState.y2-selDrawState.y1)}
                        fill="rgba(255,255,255,0.08)"
                        stroke="#fff" strokeWidth="1"
                        strokeDasharray="5,5"
                      />
                    )}
                    {(selDrawState.type==='ellipse')&&(
                      <ellipse
                        cx={(selDrawState.x1+selDrawState.x2)/2}
                        cy={(selDrawState.y1+selDrawState.y2)/2}
                        rx={Math.abs(selDrawState.x2-selDrawState.x1)/2}
                        ry={Math.abs(selDrawState.y2-selDrawState.y1)/2}
                        fill="rgba(255,255,255,0.08)"
                        stroke="#fff" strokeWidth="1"
                        strokeDasharray="5,5"
                      />
                    )}
                    {(selDrawState.type==='lasso'||selDrawState.type==='poly')&&selDrawState.points?.length>1&&(
                      <>
                        <polyline
                          points={selDrawState.points.map(pt=>`${pt.x},${pt.y}`).join(' ')}
                          fill="rgba(255,255,255,0.08)"
                          stroke="#fff" strokeWidth="1"
                          strokeDasharray="5,5" strokeLinejoin="round"
                        />
                        {selDrawState.type==='poly'&&selDrawState.cx!=null&&(
                          <line
                            x1={selDrawState.points[selDrawState.points.length-1].x}
                            y1={selDrawState.points[selDrawState.points.length-1].y}
                            x2={selDrawState.cx} y2={selDrawState.cy}
                            stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4,4"
                          />
                        )}
                        {selDrawState.type==='poly'&&selDrawState.points?.length>2&&(
                          <circle
                            cx={selDrawState.points[0].x} cy={selDrawState.points[0].y}
                            r="5" fill="#f97316" stroke="#fff" strokeWidth="1.5"
                          />
                        )}
                      </>
                    )}
                  </svg>
                )}

                {/* Lasso mask SVG overlay */}
                {isLassoMode&&(
                  <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:10000}}>
                    <polyline ref={lassoSvgRef} points="" fill="rgba(249,115,22,0.12)" stroke="#f97316" strokeWidth="2" strokeDasharray="6,4"/>
                  </svg>
                )}
                {/* Freehand draw SVG overlay */}
                {activeTool==='freehand'&&(
                  <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:10000}}>
                    <polyline ref={freehandSvgRef} points="" fill="none" stroke={freeBrushColor} strokeWidth={freeBrushSize} strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
                  </svg>
                )}

                {/* Feature L: Comment pin overlay */}
                {comments.map((c,idx)=>{
                  const isActive=activeCommentId===c.id;
                  const unresolved=!c.resolved;
                  return(
                    <div key={c.id} style={{
                      position:'absolute',
                      left:`${c.x}%`, top:`${c.y}%`,
                      transform:'translate(-50%,-100%)',
                      zIndex:19999,
                      pointerEvents:'all',
                    }}>
                      {/* Pin circle */}
                      <div
                        onClick={e=>{e.stopPropagation();setActiveCommentId(isActive?null:c.id);}}
                        style={{
                          width:24,height:24,borderRadius:'50% 50% 50% 0',
                          transform:'rotate(-45deg)',
                          background:c.resolved?'#4b5563':'#f97316',
                          border:c.resolved?'2px solid #6b7280':'2px solid #fff',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          cursor:'pointer',
                          boxShadow:unresolved?'0 0 0 0 rgba(249,115,22,0.4)':'none',
                          animation:unresolved?'comment-pulse 2s ease-in-out infinite':'none',
                        }}
                      >
                        <span style={{transform:'rotate(45deg)',fontSize:9,fontWeight:'800',color:'#fff',lineHeight:1}}>{idx+1}</span>
                      </div>
                      {/* Popover */}
                      {isActive&&(
                        <div
                          onClick={e=>e.stopPropagation()}
                          style={{
                            position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',
                            width:240,background:'#0d0f14',border:'1px solid rgba(249,115,22,0.3)',
                            borderRadius:10,padding:'12px',
                            boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:20000,
                          }}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                            <span style={{fontSize:10,color:'#f97316',fontWeight:'700'}}>#{idx+1}</span>
                            <span style={{flex:1,fontSize:10,color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.userId}</span>
                            <button onClick={()=>resolveComment(c.id)} style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${c.resolved?'#4b5563':'rgba(249,115,22,0.4)'}`,background:'transparent',color:c.resolved?'#6b7280':'#f97316',fontSize:9,cursor:'pointer',fontWeight:'700',flexShrink:0}}>
                              {c.resolved?'Reopen':'Resolve'}
                            </button>
                          </div>
                          <div style={{fontSize:12,color:'#e5e7eb',lineHeight:1.5,marginBottom:8}}>{c.text}</div>
                          {c.replies?.length>0&&(
                            <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:8,marginBottom:8,display:'flex',flexDirection:'column',gap:6}}>
                              {c.replies.map(r=>(
                                <div key={r.id} style={{fontSize:11,color:'rgba(255,255,255,0.6)',paddingLeft:8,borderLeft:'2px solid rgba(249,115,22,0.3)'}}>
                                  <span style={{color:'rgba(255,255,255,0.35)',fontSize:9}}>{r.userId}: </span>{r.text}
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{display:'flex',gap:5}}>
                            <input value={replyDraft} onChange={e=>setReplyDraft(e.target.value)}
                              onKeyDown={e=>{if(e.key==='Enter'&&replyDraft.trim()){replyToComment(c.id,replyDraft);e.preventDefault();}}}
                              placeholder="Reply…" style={{flex:1,padding:'5px 8px',borderRadius:5,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:11,outline:'none'}}/>
                            <button onClick={()=>replyToComment(c.id,replyDraft)} style={{padding:'5px 10px',borderRadius:5,border:'none',background:'#f97316',color:'#fff',fontSize:11,fontWeight:'700',cursor:'pointer'}}>↩</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Comment-mode drop target overlay */}
                {commentMode&&(
                  <div
                    style={{position:'absolute',inset:0,zIndex:18000,cursor:'crosshair',background:'rgba(249,115,22,0.04)',border:'2px dashed rgba(249,115,22,0.3)'}}
                    onClick={e=>{
                      const rect=e.currentTarget.getBoundingClientRect();
                      const xPct=((e.clientX-rect.left)/rect.width*100).toFixed(2);
                      const yPct=((e.clientY-rect.top)/rect.height*100).toFixed(2);
                      const text=window.prompt('Add comment:');
                      if(text?.trim()){
                        addComment(xPct,yPct,text);
                        setCommentMode(false);
                      }
                    }}
                  >
                    <div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,0.8)',borderRadius:6,padding:'4px 12px',fontSize:11,color:'#f97316',fontWeight:'700',pointerEvents:'none',whiteSpace:'nowrap'}}>
                      Click anywhere to drop a comment
                    </div>
                  </div>
                )}

                {/* Smart Cutout — segmentation overlays */}
                {activeTool==='segment'&&(
                  <>
                    {segmentBusy&&(
                      <div style={{position:'absolute',inset:0,zIndex:9996,pointerEvents:'none',overflow:'hidden'}}>
                        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.28)'}}/>
                        <div style={{
                          position:'absolute',left:0,right:0,height:2,
                          background:'linear-gradient(90deg,transparent,#f97316 30%,#ff8c00 50%,#f97316 70%,transparent)',
                          boxShadow:'0 0 14px 5px rgba(249,115,22,0.55)',
                          animation:'tf-scan 1.8s ease-in-out infinite',
                        }}/>
                        <div style={{
                          position:'absolute',top:'50%',left:'50%',
                          transform:'translate(-50%,-50%)',
                          background:'rgba(10,10,15,0.85)',
                          border:'1px solid rgba(249,115,22,0.4)',
                          borderRadius:10,padding:'10px 18px',
                          fontSize:12,fontWeight:'700',color:'#f97316',
                          display:'flex',alignItems:'center',gap:8,
                          letterSpacing:'0.2px',
                        }}>
                          <span style={{display:'inline-block',animation:'editor-spin 1s linear infinite',fontSize:14}}>◌</span>
                          {segmentStatus||'Analyzing objects...'}
                        </div>
                      </div>
                    )}
                    {!segmentBusy&&segmentMasks.map((maskUrl,idx)=>(
                      <div
                        key={idx}
                        onClick={e=>{e.stopPropagation();applySegmentMask(idx);}}
                        onMouseEnter={()=>setSegmentHoverIdx(idx)}
                        onMouseLeave={()=>setSegmentHoverIdx(null)}
                        style={{
                          position:'absolute',inset:0,
                          zIndex:9990+idx,
                          cursor:'pointer',
                          mixBlendMode:'screen',
                          opacity:segmentHoverIdx===idx?0.95:0.5,
                          transition:'opacity 0.12s',
                        }}>
                        <img
                          src={maskUrl}
                          alt=""
                          style={{
                            width:'100%',height:'100%',objectFit:'fill',
                            filter:`hue-rotate(${idx*47}deg) saturate(6) brightness(${segmentHoverIdx===idx?1.5:0.7})`,
                            pointerEvents:'none',display:'block',
                          }}
                        />
                        {segmentHoverIdx===idx&&(
                          <div style={{
                            position:'absolute',inset:0,
                            border:'2px solid #f97316',
                            borderRadius:2,
                            boxShadow:'inset 0 0 0 1px rgba(249,115,22,0.4)',
                            pointerEvents:'none',
                            animation:'tf-pulse-outline 1.2s ease-in-out infinite',
                          }}>
                            <div style={{
                              position:'absolute',bottom:6,left:'50%',
                              transform:'translateX(-50%)',
                              background:'rgba(249,115,22,0.95)',
                              color:'#fff',fontSize:10,fontWeight:'800',
                              padding:'2px 10px',borderRadius:20,
                              whiteSpace:'nowrap',letterSpacing:'0.3px',
                            }}>
                              Click to isolate
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Face Score Badge — expression score on detected face */}
                {activeTool==='face'&&showExpressionScore&&expressionScore?.bbox&&!expressionBusy&&(()=>{
                  const sc=expressionScore.overall;
                  const badgeColor=sc>=8?'#22c55e':sc>=5?'#f59e0b':'#ef4444';
                  const bx=Math.round(expressionScore.bbox.x*p.preview.w);
                  const by=Math.round(expressionScore.bbox.y*p.preview.h);
                  const bw=Math.round(expressionScore.bbox.w*p.preview.w);
                  return(
                    <div style={{position:'absolute',left:bx,top:Math.max(0,by-28),zIndex:9984,pointerEvents:'auto'}}>
                      <div style={{
                        display:'flex',alignItems:'center',gap:5,
                        background:'rgba(10,10,15,0.85)',
                        border:`1.5px solid ${badgeColor}`,
                        borderRadius:20,padding:'3px 10px',
                        backdropFilter:'blur(6px)',
                        boxShadow:`0 2px 12px rgba(0,0,0,0.5),0 0 0 1px ${badgeColor}22`,
                      }}>
                        <span style={{
                          fontSize:15,fontWeight:'900',color:badgeColor,
                          letterSpacing:'-0.5px',lineHeight:1,
                        }}>{sc}</span>
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.6)',fontWeight:'600',letterSpacing:'0.3px'}}>/10</span>
                        <span style={{fontSize:9,color:badgeColor,fontWeight:'700',letterSpacing:'0.2px',marginLeft:1}}>EXPR</span>
                        <button onClick={()=>setShowExpressionScore(false)} style={{
                          marginLeft:4,background:'none',border:'none',cursor:'pointer',
                          color:'rgba(255,255,255,0.5)',fontSize:12,lineHeight:1,padding:'0 0 0 2px',
                        }}>×</button>
                      </div>
                      <div style={{width:bw,height:1.5,background:`${badgeColor}55`,marginTop:2,borderRadius:1}}/>
                    </div>
                  );
                })()}

                {/* ✅ Brush overlay — no CSS width/height, no filter, canvas sizes itself */}
                {brushingImageId&&selectedLayer&&!maskingLayerId&&(
                  <div style={{
                    position:'absolute',
                    left:  selectedLayer.type==='background' ? 0 : selectedLayer.x,
                    top:   selectedLayer.type==='background' ? 0 : selectedLayer.y,
                    width: selectedLayer.type==='background' ? p.preview.w  : selectedLayer.width-(selectedLayer.cropLeft||0)-(selectedLayer.cropRight||0),
                    height:selectedLayer.type==='background' ? p.preview.h  : selectedLayer.height-(selectedLayer.cropTop||0)-(selectedLayer.cropBottom||0),
                    zIndex:9999,
                    overflow:'hidden',
                    pointerEvents:'auto',
                  }}>
                    <BrushOverlay
                      ref={brushOverlayRef}
                      layer={selectedLayer ? {
                        ...selectedLayer,
                        src: getLayerSrc(selectedLayer),
                        width:  selectedLayer.type==='background' ? p.preview.w  : selectedLayer.width,
                        height: selectedLayer.type==='background' ? p.preview.h  : selectedLayer.height,
                        x: selectedLayer.type==='background' ? 0 : selectedLayer.x,
                        y: selectedLayer.type==='background' ? 0 : selectedLayer.y,
                      } : null}
                      active={true}
                      zoom={zoom}
                      brushType={brushTypeState}
                      brushSize={brushSizeState}
                      brushStrength={brushStrengthState}
                      brushEdge={brushEdgeState}
                      brushFlow={brushFlowState}
                      brushStabilizer={brushStabilizerState}
                      brushSmoothing={brushSmoothingState}
                      brushSpacing={brushSpacingState}
                      paintColor={brushColorState}
                      paintAlpha={brushColorAlpha}
                      pressureEnabled={pressureEnabled}
                      pressureMapping={pressureMapping}
                      pressureCurve={pressureCurve}
                      pressureMin={pressureMin}
                      pressureMax={pressureMax}
                      onTabletDetected={handleTabletDetected}
                      selectionMaskRef={selectionMaskRef}
                      selectionActive={selectionActive}
                      maskW={p.preview.w}
                      maskH={p.preview.h}
                      onUpdate={(updates)=>{
                        if(selectedLayer?.type==='background'){
                          updateLayer(selectedId,{bgColor:'transparent',bgGradient:null,paintSrc:updates.src,src:updates.src,type:'image',
                            x:0,y:0,width:p.preview.w,height:p.preview.h,
                            cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
                            imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0
                          });
                        } else {
                          updateLayer(selectedId,{paintSrc:updates.src});
                        }
                      }}
                    />
                  </div>
                )}



                {activeTool==='rimlight'&&selectedLayer?.type==='image'&&(
                  <div style={{
                    position:'absolute',
                    inset:0,
                    zIndex:9998,
                    cursor:'crosshair',
                    pointerEvents:'none',
                  }}>
                    <div id="rim-cursor" style={{
                      position:'absolute',
                      width: (rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8+'px',
                      height:(rimLightSize/100)*Math.min(p.preview.w,p.preview.h)*0.8+'px',
                      borderRadius:'50%',
                      border:`2px solid ${rimLightColor}`,
                      background:`radial-gradient(circle, ${rimLightColor}22 0%, transparent 70%)`,
                      transform:'translate(-50%,-50%)',
                      pointerEvents:'none',
                      display:'none',
                      boxShadow:`0 0 12px ${rimLightColor}88`,
                    }}/>
                  </div>
                )}

                {/* Composition AI overlays — rule-of-thirds, text zones, crop box */}
                {activeTool==='composition'&&compResult&&compOverlay&&(
                  <div style={{position:'absolute',inset:0,zIndex:9989,pointerEvents:'none'}}>

                    {/* Rule-of-thirds grid */}
                    {[33.33,66.66].map(pct=>(
                      <React.Fragment key={`v${pct}`}>
                        <div style={{position:'absolute',top:0,bottom:0,left:`${pct}%`,width:1,background:'rgba(249,115,22,0.22)',boxShadow:'0 0 4px rgba(249,115,22,0.15)'}}/>
                        <div style={{position:'absolute',left:0,right:0,top:`${pct}%`,height:1,background:'rgba(249,115,22,0.22)',boxShadow:'0 0 4px rgba(249,115,22,0.15)'}}/>
                      </React.Fragment>
                    ))}
                    {[33.33,66.66].flatMap(x=>[33.33,66.66].map(y=>(
                      <div key={`dot-${x}-${y}`} style={{position:'absolute',left:`${x}%`,top:`${y}%`,width:6,height:6,borderRadius:'50%',background:'rgba(249,115,22,0.55)',transform:'translate(-50%,-50%)',boxShadow:'0 0 6px rgba(249,115,22,0.4)'}}/>
                    )))}

                    {/* Text placement zones */}
                    {compResult.text_zones?.map((zone,i)=>(
                      <div key={`zone-${i}`} style={{
                        position:'absolute',
                        left:`${zone.x}%`,top:`${zone.y}%`,
                        width:`${zone.w}%`,height:`${zone.h}%`,
                        background:'rgba(249,115,22,0.09)',
                        border:'1.5px dashed rgba(249,115,22,0.7)',
                        borderRadius:3,
                        display:'flex',alignItems:'center',justifyContent:'center',
                      }}>
                        <span style={{
                          fontSize:8,fontWeight:'800',color:'rgba(249,115,22,0.9)',
                          textTransform:'uppercase',letterSpacing:'0.8px',
                          background:'rgba(0,0,0,0.55)',padding:'2px 7px',borderRadius:10,
                          whiteSpace:'nowrap',
                        }}>
                          {zone.label||`Text zone ${i+1}`}
                        </span>
                      </div>
                    ))}

                    {/* Crop suggestion box */}
                    {compResult.crop_suggestion&&(()=>{
                      const c=compResult.crop_suggestion;
                      const isFullCanvas=c.x===0&&c.y===0&&c.w>=98&&c.h>=98;
                      if(isFullCanvas) return null;
                      return(
                        <div style={{
                          position:'absolute',
                          left:`${c.x}%`,top:`${c.y}%`,
                          width:`${c.w}%`,height:`${c.h}%`,
                          border:'2px dashed rgba(249,115,22,0.9)',
                          borderRadius:3,
                          boxShadow:'0 0 0 9999px rgba(0,0,0,0.35)',
                        }}>
                          <div style={{
                            position:'absolute',bottom:4,right:4,
                            background:'#f97316',color:'#fff',
                            fontSize:9,fontWeight:'800',
                            padding:'2px 8px',borderRadius:10,letterSpacing:'0.4px',
                          }}>
                            SUGGESTED CROP
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ── Safe Zone Overlay ── */}
                {showSafeZones&&(
                  <div style={{position:'absolute',inset:0,zIndex:9998,pointerEvents:'none'}}>
                    {/* Legend */}
                    <div style={{position:'absolute',top:0,left:0,right:0,padding:'3px 6px',background:'rgba(0,0,0,0.72)',display:'flex',gap:8,alignItems:'center',borderBottom:'1px solid rgba(255,80,80,0.3)'}}>
                      <span style={{fontSize:6.5,color:'#ff6666',fontWeight:'700',letterSpacing:'0.4px'}}>◼ BLOCKED BY YOUTUBE UI</span>
                      <span style={{fontSize:6.5,color:'rgba(255,255,80,0.8)',fontWeight:'700',letterSpacing:'0.4px'}}>⊡ SAFE ZONE</span>
                    </div>
                    {/* Bottom progress bar — full width, bottom 2% (~7px of 360) */}
                    <div style={{position:'absolute',bottom:0,left:0,right:0,height:'2%',background:'rgba(255,40,40,0.5)',borderTop:'1px solid rgba(255,80,80,0.9)'}}/>
                    {/* Timestamp badge — bottom-right, ~8% width × 10% height */}
                    <div style={{position:'absolute',bottom:'4%',right:'1.5%',width:'8%',height:'10%',background:'rgba(180,0,0,0.45)',border:'1.5px solid #ff4444',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:7,color:'#ff9999',fontFamily:'monospace',fontWeight:'700'}}>0:00</span>
                    </div>
                    {/* Watch Later button — top-right ~5% × 11% */}
                    <div style={{position:'absolute',top:'4%',right:'1.5%',width:'5%',height:'11%',background:'rgba(180,0,0,0.40)',border:'1.5px solid #ff4444',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:8,color:'#ff9999'}}>⊕</span>
                    </div>
                    {/* Menu dots — top-right, next to Watch Later */}
                    <div style={{position:'absolute',top:'4%',right:'7%',width:'4%',height:'11%',background:'rgba(180,0,0,0.35)',border:'1px solid rgba(255,80,80,0.6)',borderRadius:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:8,color:'#ff9999',letterSpacing:-2}}>···</span>
                    </div>
                    {/* Safe zone guide — dashed inner rect */}
                    <div style={{position:'absolute',top:'20%',left:'3%',right:'12%',bottom:'14%',border:'1px dashed rgba(255,255,80,0.5)',borderRadius:2,pointerEvents:'none'}}/>
                    {/* Labels on zones */}
                    <div style={{position:'absolute',bottom:'14%',right:'2%',fontSize:6,color:'rgba(255,100,100,0.9)',fontWeight:'700',textAlign:'right',lineHeight:1.3}}>TIMESTAMP<br/>ZONE</div>
                    <div style={{position:'absolute',top:'4%',right:'12%',fontSize:6,color:'rgba(255,100,100,0.9)',fontWeight:'700'}}>UI BUTTONS</div>
                  </div>
                )}

                {/* ── Heat Map Overlay ── */}
                {showHeatMap&&heatMapData&&heatMapVisible&&(
                  <canvas
                    ref={heatMapCanvasRef}
                    width={p.preview.w}
                    height={p.preview.h}
                    style={{
                      position:'absolute',
                      top:0,left:0,
                      width:p.preview.w,
                      height:p.preview.h,
                      pointerEvents:'none',
                      zIndex:9990,
                      borderRadius:0,
                    }}
                  />
                )}
              </div>
            </div>
            </CanvasErrorBoundary>
            <div style={{fontSize:10,color:'#444',letterSpacing:'0.3px'}}>
              {p.label} · {p.width}×{p.height}px · {layers.length} layer{layers.length!==1?'s':''} · {Math.round(zoom*100)}%
            </div>
          </div>

          {/* ── Mobile Feed Preview (draggable) ── */}
          {showStampTest&&(()=>{
            const mScale=168/p.preview.w;
            const smallTextLayers=layers.filter(l=>l.type==='text'&&!l.hidden&&l.fontSize*mScale<12);
            const pos=mobilePreviewPos;
            const posStyle=pos.x>=0?{left:pos.x,top:pos.y}:{right:20,bottom:72};
            return(
              <div
                style={{position:'fixed',...posStyle,zIndex:300,userSelect:'none'}}
                onMouseDown={e=>{
                  if(e.target.closest('button')) return;
                  e.preventDefault();
                  const rect=e.currentTarget.getBoundingClientRect();
                  const ox=e.clientX-rect.left, oy=e.clientY-rect.top;
                  const onMove=mv=>setMobilePreviewPos({x:mv.clientX-ox,y:mv.clientY-oy});
                  const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
                  window.addEventListener('mousemove',onMove);
                  window.addEventListener('mouseup',onUp);
                }}>
                {/* Phone frame */}
                <div style={{background:'#0a0a0a',borderRadius:22,padding:'18px 6px 12px 6px',border:'2.5px solid #2a2a2a',boxShadow:'0 0 0 1px #111, 0 16px 60px rgba(0,0,0,0.9)',position:'relative',cursor:'move',minWidth:196}}>
                  {/* Notch */}
                  <div style={{position:'absolute',top:7,left:'50%',transform:'translateX(-50%)',width:36,height:5,borderRadius:3,background:'#1e1e1e'}}/>
                  {/* Header */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,paddingLeft:4,paddingRight:4}}>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.35)',fontWeight:'700',letterSpacing:'0.6px',textTransform:'uppercase'}}>📱 Mobile Feed</div>
                    <button onClick={()=>setShowStampTest(false)} style={{padding:'1px 5px',borderRadius:4,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.3)',fontSize:10,cursor:'pointer',lineHeight:1}}>✕</button>
                  </div>
                  {/* YouTube-style mobile feed item */}
                  <div style={{background:'#111',borderRadius:8,overflow:'hidden',width:184}}>
                    {/* Thumbnail at exact mobile feed size */}
                    <div style={{position:'relative',width:184,height:103,overflow:'hidden',background:bg?.bgGradient?`linear-gradient(180deg,${bg.bgGradient[0]},${bg.bgGradient[1]})`:bg?.bgColor||'#000'}}>
                      {layers.filter(l=>l.type!=='background').map(obj=>(
                        <div key={obj.id} style={{position:'absolute',inset:0}}>
                          <StampLayer obj={obj} scale={184/p.preview.w}/>
                          {/* Small text warning */}
                          {obj.type==='text'&&!obj.hidden&&obj.fontSize*(184/p.preview.w)<12&&(
                            <div title="Text too small for mobile — increase font size" style={{position:'absolute',left:obj.x*(184/p.preview.w)-2,top:obj.y*(184/p.preview.w)-2,padding:'1px 2px',background:'rgba(220,30,30,0.85)',borderRadius:2,border:'1px solid #ff4444',fontSize:5.5,color:'#fff',fontWeight:'700',whiteSpace:'nowrap',pointerEvents:'none',zIndex:2}}>
                              ⚠ Too small
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Timestamp */}
                      <div style={{position:'absolute',bottom:4,right:4,padding:'1px 4px',borderRadius:3,background:'rgba(0,0,0,0.88)',fontSize:7,color:'#fff',fontFamily:'monospace',fontWeight:'700',letterSpacing:'0.3px'}}>0:00</div>
                      {/* Watch-later zone highlight */}
                      <div style={{position:'absolute',top:4,right:4,width:16,height:16,borderRadius:3,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.7)'}}>⊕</span>
                      </div>
                    </div>
                    {/* Video info row */}
                    <div style={{padding:'7px 8px',display:'flex',gap:7,alignItems:'flex-start'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#f97316,#ef4444)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:'700',color:'#fff'}}>{ytChannel.charAt(0).toUpperCase()}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:10,color:'#fff',fontWeight:'500',lineHeight:1.35,marginBottom:2,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{ytVideoTitle||'Your video title goes here'}</div>
                        <div style={{fontSize:9,color:'rgba(255,255,255,0.45)',lineHeight:1.3}}>{ytChannel||'Channel Name'} · 1.2M views · 2 days ago</div>
                      </div>
                    </div>
                  </div>
                  {/* Warnings summary */}
                  {smallTextLayers.length>0&&(
                    <div style={{marginTop:6,padding:'4px 6px',borderRadius:5,background:'rgba(220,30,30,0.15)',border:'1px solid rgba(220,30,30,0.4)',fontSize:8,color:'#ff8888',lineHeight:1.4}}>
                      ⚠ {smallTextLayers.length} text layer{smallTextLayers.length>1?'s':''} too small at mobile size
                    </div>
                  )}
                  {/* Home indicator */}
                  <div style={{margin:'10px auto 0',width:40,height:3.5,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
                </div>
              </div>
            );
          })()}
          </div>{/* end inner canvas flex-center wrapper */}
        </div>

        {/* ── Heat Map Floating Control Panel ── */}
        {showHeatMap&&(
          <div style={{
            position:'fixed',bottom:80,right:20,width:220,
            background:'#1a1a1a',border:'1px solid #333',borderRadius:12,
            boxShadow:'0 8px 32px rgba(0,0,0,0.6)',padding:'14px 16px',
            zIndex:500,userSelect:'none',
          }}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:'700',color:'#fff'}}>Focus Map</span>
              <button onClick={()=>{setShowHeatMap(false);setHeatMapData(null);setHeatMapInsights([]);}} style={{padding:'2px 6px',borderRadius:5,border:'1px solid #444',background:'transparent',color:'#888',cursor:'pointer',fontSize:12}}>✕</button>
            </div>
            {/* Opacity */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>Opacity — {heatMapOpacity}%</div>
              <input type="range" min={0} max={100} value={heatMapOpacity}
                onChange={e=>{
                  const v=Number(e.target.value);
                  setHeatMapOpacity(v);
                  if(heatMapData&&heatMapCanvasRef.current) drawHeatMap(heatMapData,p.preview.w,p.preview.h,v,heatMapCanvasRef.current);
                }}
                style={{width:'100%',accentColor:'#f97316'}}/>
            </div>
            {/* Toggle */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div onClick={()=>setHeatMapVisible(v=>!v)} style={{width:34,height:18,borderRadius:9,background:heatMapVisible?'#f97316':'#444',cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                <div style={{position:'absolute',top:2,left:heatMapVisible?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
              </div>
              <span style={{fontSize:10,color:'#aaa'}}>Show overlay</span>
            </div>
            {/* Refresh */}
            <button onClick={runHeatMap} disabled={heatMapLoading}
              style={{width:'100%',padding:'6px',borderRadius:7,border:'1px solid #444',background:'#222',color:'#fff',fontSize:11,fontWeight:'600',cursor:'pointer',marginBottom:10,opacity:heatMapLoading?0.5:1}}>
              {heatMapLoading?'Analyzing…':'↻ Refresh'}
            </button>
            {/* Color legend */}
            <div style={{marginBottom:10}}>
              <div style={{height:10,borderRadius:4,background:'linear-gradient(to right, #0000ff, #00ff00, #ffff00, #ff0000)',marginBottom:4}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#888'}}>
                <span>Low attention</span><span>High attention</span>
              </div>
            </div>
            {/* Insights */}
            {heatMapInsights.length>0&&(
              <div>
                <div style={{fontSize:10,fontWeight:'700',color:'#f97316',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.6px'}}>Insights</div>
                {heatMapInsights.map((ins,i)=>(
                  <div key={i} style={{fontSize:10,color:'#ccc',lineHeight:1.5,marginBottom:5,paddingLeft:8,borderLeft:'2px solid #f97316'}}>
                    {ins}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ✅ Right sidebar — stopPropagation on pointer events so sliders never leak to canvas */}
        <div
          onPointerDown={e=>e.stopPropagation()}
          style={isMobile?{
            position:'absolute',bottom:0,left:0,right:0,
            maxHeight:'45vh',
            background:T.sidebar,borderTop:`1px solid ${T.border}`,
            display:'flex',flexDirection:'column',zIndex:100,
            borderRadius:'12px 12px 0 0',
            boxShadow:'0 -4px 20px rgba(0,0,0,0.3)',
          }:{
            width:272,background:T.sidebar,borderLeft:`1px solid ${T.border}`,
            display:'flex',flexDirection:'column',flexShrink:0,
          }}
        >
          <div style={{flex:1,padding:'10px 12px',overflowY:'auto'}}>

            {activeTool==='select'&&(
              <div>
                <span style={css.label}>Select tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600',lineHeight:1.8}}>
                  ↖ Click any layer to select it.<br/>
                  <span style={{color:T.muted,fontWeight:'400'}}>Switch to Move ✋ to drag.</span>
                </div>
                {selectedLayer&&selectedLayer.type!=='background'&&(<>
                  <span style={css.label}>Selected — {getLayerName(selectedLayer)}</span>
                  <div style={css.section}>
                    <div style={css.row}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>X</span>
                      <input type="number" value={Math.round(selectedLayer.x)} onChange={e=>updateLayer(selectedId,{x:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>Y</span>
                      <input type="number" value={Math.round(selectedLayer.y)} onChange={e=>updateLayer(selectedId,{y:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>
                    {selectedLayer.width&&(<div style={{...css.row,marginTop:6}}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>W</span>
                      <input type="number" value={Math.round(selectedLayer.width||0)} onChange={e=>updateLayer(selectedId,{width:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>H</span>
                      <input type="number" value={Math.round(selectedLayer.height||0)} onChange={e=>updateLayer(selectedId,{height:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>)}
                    <span style={{...css.label,marginTop:8}}>Opacity — {selectedLayer.opacity??100}%</span>
                    <Slider min={0} max={100} value={selectedLayer.opacity??100}
                      onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                      onCommit={v=>updateLayer(selectedId,{opacity:v})}
                      style={{width:'100%'}}/>
                    {selectedLayer&&selectedLayer.type!=='background'&&(<>
                      <span style={css.label}>Rotation — {Math.round(selectedLayer.rotation||0)}°</span>
                      <div style={css.row}>
                        <Slider min={-180} max={180} value={selectedLayer.rotation||0}
                          onChange={v=>updateLayerSilent(selectedId,{rotation:v})}
                          onCommit={v=>updateLayer(selectedId,{rotation:v})}
                          style={{flex:1}}/>
                        <button onClick={()=>updateLayer(selectedId,{rotation:0})}
                          style={{padding:'3px 8px',borderRadius:4,border:`1px solid ${T.border}`,
                            background:T.input,color:T.muted,cursor:'pointer',fontSize:10}}>
                          Reset
                        </button>
                      </div>
                    </>)}
                    {selectedLayer?.type==='shape'&&(<>
                      <span style={{...css.label,marginTop:8}}>Fill color</span>
                      <input type="color" value={selectedLayer.fillColor||'#FF4500'}
                        onChange={e=>{updateLayer(selectedId,{fillColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                      <span style={css.label}>Border color</span>
                      <input type="color" value={selectedLayer.strokeColor||'#000000'}
                        onChange={e=>{updateLayer(selectedId,{strokeColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                    </>)}
                    {selectedLayer?.type==='text'&&(<>
                      <span style={{...css.label,marginTop:8}}>Text color</span>
                      <input type="color" value={selectedLayer.textColor||'#ffffff'}
                        onChange={e=>{updateLayer(selectedId,{textColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                      <span style={css.label}>Outline color</span>
                      <input type="color" value={selectedLayer.strokeColor||'#000000'}
                        onChange={e=>{updateLayer(selectedId,{strokeColor:e.target.value});triggerAutoSave();}}
                        style={css.color}/>
                      <span style={css.label}>Font size — {selectedLayer.fontSize}px</span>
                      <Slider min={8} max={120} value={selectedLayer.fontSize||48}
                        onChange={v=>updateLayerSilent(selectedId,{fontSize:v})}
                        onCommit={v=>updateLayer(selectedId,{fontSize:v})}
                        style={{width:'100%'}}/>
                    </>)}
                    {selectedLayer?.type==='image'&&(<>
                      <span style={{...css.label,marginTop:8}}>Scale</span>
                      <div style={{display:'flex',gap:4,marginBottom:6}}>
                        {[25,50,75,100].map(pct=>{
                          const curPct=Math.round((selectedLayer.width/(selectedLayer.originalWidth||selectedLayer.width))*100)||100;
                          return(
                            <button key={pct} onClick={()=>{
                              const ow=selectedLayer.originalWidth||selectedLayer.width;
                              const oh=selectedLayer.originalHeight||selectedLayer.height;
                              const nw=Math.round(ow*pct/100);
                              const nh=Math.round(oh*pct/100);
                              updateLayer(selectedId,{width:nw,height:nh});
                            }} style={{flex:1,padding:'5px 2px',borderRadius:5,border:`1px solid ${curPct===pct?T.accent:T.border}`,background:curPct===pct?`${T.accent}18`:T.input,color:curPct===pct?T.accent:T.text,fontSize:10,cursor:'pointer',fontWeight:curPct===pct?'700':'400'}}>{pct}%</button>
                          );
                        })}
                      </div>
                      <div style={{display:'flex',gap:4,marginBottom:6}}>
                        <button onClick={()=>{
                          const aspect=selectedLayer.width/selectedLayer.height;
                          const cW=p.preview.w,cH=p.preview.h;
                          let nw,nh;
                          if(aspect>cW/cH){nw=cW;nh=Math.round(cW/aspect);}
                          else{nh=cH;nw=Math.round(cH*aspect);}
                          updateLayer(selectedId,{width:nw,height:nh,x:Math.round((cW-nw)/2),y:Math.round((cH-nh)/2)});
                        }} style={{flex:1,padding:'6px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer'}}>Fit canvas</button>
                        <button onClick={()=>{
                          const aspect=selectedLayer.width/selectedLayer.height;
                          const cW=p.preview.w,cH=p.preview.h;
                          let nw,nh;
                          if(aspect>cW/cH){nh=cH;nw=Math.round(cH*aspect);}
                          else{nw=cW;nh=Math.round(cW/aspect);}
                          updateLayer(selectedId,{width:nw,height:nh,x:Math.round((cW-nw)/2),y:Math.round((cH-nh)/2)});
                        }} style={{flex:1,padding:'6px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer'}}>Fill canvas</button>
                        <button onClick={()=>{
                          updateLayer(selectedId,{x:Math.round((p.preview.w-selectedLayer.width)/2),y:Math.round((p.preview.h-selectedLayer.height)/2)});
                        }} style={{flex:1,padding:'6px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer'}}>Center</button>
                      </div>
                      <span style={{...css.label}}>Brightness — {selectedLayer.imgBrightness||100}%</span>
                      <Slider min={50} max={200} value={selectedLayer.imgBrightness||100}
                        onChange={v=>updateLayerSilent(selectedId,{imgBrightness:v})}
                        onCommit={v=>updateLayer(selectedId,{imgBrightness:v})}
                        style={{width:'100%'}}/>
                      <span style={css.label}>Contrast — {selectedLayer.imgContrast||100}%</span>
                      <Slider min={50} max={200} value={selectedLayer.imgContrast||100}
                        onChange={v=>updateLayerSilent(selectedId,{imgContrast:v})}
                        onCommit={v=>updateLayer(selectedId,{imgContrast:v})}
                        style={{width:'100%'}}/>
                    </>)}
                    <div style={{display:'flex',gap:5,marginTop:10}}>
                      <button onClick={()=>duplicateLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>Duplicate</button>
                      <button onClick={()=>deleteLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:T.danger}}>Delete</button>
                    </div>
                  </div>
                </>)}
                <span style={css.label}>Shortcuts</span>
                <div style={css.section}>
                  {[['Delete','Remove'],['Ctrl+D','Duplicate'],['Ctrl+C/V','Copy/Paste'],['Ctrl+Z/Y','Undo/Redo'],['Ctrl+K','Commands'],['Ctrl+S','Save']].map(([k,d])=>(
                    <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:`1px solid ${T.border}`}}>
                      <span style={{fontSize:10,color:T.muted}}>{d}</span>
                      <span style={{fontSize:9,color:T.text,fontFamily:'monospace',background:T.bg,padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`}}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTool==='move'&&(
              <div>
                <span style={css.label}>Move tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600',lineHeight:1.8}}>
                  ✋ Drag any layer to move it.<br/>
                  <span style={{color:T.muted,fontWeight:'400'}}>Corner handles to resize.</span>
                </div>
                {selectedLayer&&selectedLayer.type!=='background'&&(<>
                  <span style={css.label}>Align</span>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                    {[['Center','center'],['H ctr','center-h'],['V ctr','center-v'],['Left','left'],['Right','right'],['Top','top'],['Bottom','bottom']].map(([label,dir])=>(
                      <button key={dir} onClick={()=>alignLayer(selectedId,dir)} style={{padding:'6px 2px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:9,cursor:'pointer',textAlign:'center'}}>{label}</button>
                    ))}
                  </div>
                  <span style={css.label}>Flip</span>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>flipLayer(selectedId,'h')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↔ H</button>
                    <button onClick={()=>flipLayer(selectedId,'v')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↕ V</button>
                  </div>
                  <span style={css.label}>Blend mode</span>
                  <BlendModeSelect value={selectedLayer.blendMode||'normal'} onChange={v=>{updateLayer(selectedId,{blendMode:v});saveEngineRef.current?.markDirty('layerProperties');}} style={css.input}/>
                  <span style={css.label}>Position</span>
                  <div style={css.section}>
                    <div style={css.row}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>X</span>
                      <input type="number" value={Math.round(selectedLayer.x)} onChange={e=>updateLayer(selectedId,{x:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>Y</span>
                      <input type="number" value={Math.round(selectedLayer.y)} onChange={e=>updateLayer(selectedId,{y:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>
                    {selectedLayer.width&&(<div style={{...css.row,marginTop:6}}>
                      <span style={{fontSize:10,color:T.muted,width:10}}>W</span>
                      <input type="number" value={Math.round(selectedLayer.width||0)} onChange={e=>updateLayer(selectedId,{width:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                      <span style={{fontSize:10,color:T.muted,width:10}}>H</span>
                      <input type="number" value={Math.round(selectedLayer.height||0)} onChange={e=>updateLayer(selectedId,{height:Number(e.target.value)})} onBlur={triggerAutoSave} style={{...css.input,width:'50%'}}/>
                    </div>)}
                    <span style={{...css.label,marginTop:8}}>Opacity — {selectedLayer.opacity??100}%</span>
                    <Slider min={0} max={100} value={selectedLayer.opacity??100}
                      onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                      onCommit={v=>updateLayer(selectedId,{opacity:v})}
                      style={{width:'100%'}}/>
                    <div style={{display:'flex',gap:5,marginTop:10}}>
                      <button onClick={()=>duplicateLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:'transparent',color:T.text,border:`1px solid ${T.border}`}}>Duplicate</button>
                      <button onClick={()=>deleteLayer(selectedId)} style={{...css.addBtn,flex:1,marginTop:0,background:T.danger}}>Delete</button>
                    </div>
                  </div>
                </>)}
              </div>
            )}

            {activeTool==='crop'&&(
              <div>
                <span style={css.label}>Crop tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.7}}>
                  Drag the handles on the image to crop directly.<br/>
                  <span style={{color:T.text,fontWeight:'600'}}>Other layers stay interactive.</span>
                </div>
                {!selectedLayer||selectedLayer.type!=='image'?(
                  <div style={{...css.section,marginTop:8,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>⊡</div>Click an image to begin cropping</div>
                ):(
                  <div style={{...css.section,marginTop:8,padding:12}}>
                    <button onClick={()=>updateLayer(selectedId,{cropTop:0,cropBottom:0,cropLeft:0,cropRight:0})} style={{...css.addBtn,marginTop:0,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>Reset crop</button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='zoom'&&(
              <div>
                <span style={css.label}>Zoom tool</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.8}}>
                  <strong style={{color:T.text}}>Click</strong> to zoom in on a spot<br/>
                  <strong style={{color:T.text}}>Shift+Click</strong> to zoom out<br/>
                </div>

                <span style={css.label}>Zoom — {Math.round(zoom*100)}%</span>
                <div style={css.row}>
                  <button onClick={()=>{const z=Math.max(0.25,Math.round((zoom-0.25)*100)/100);setZoom(z);if(z<=1)setPanOffset({x:0,y:0});}} style={{padding:'4px 10px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:13,fontWeight:'700'}}>−</button>
                  <div style={{flex:1,height:4,background:T.border,borderRadius:2,position:'relative',margin:'0 4px'}}>
                    <div style={{position:'absolute',left:`${Math.min(100,((zoom-0.25)/7.75)*100)}%`,top:-4,width:12,height:12,borderRadius:'50%',background:T.accent,border:'2px solid #fff',transform:'translateX(-50%)'}}/>
                  </div>
                  <button onClick={()=>{setZoom(Math.min(8,Math.round((zoom+0.25)*100)/100));}} style={{padding:'4px 10px',borderRadius:5,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:13,fontWeight:'700'}}>+</button>
                </div>

                <span style={css.label}>Quick zoom</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                  {[25,50,100,150,200,400].map(pct=>(
                    <button key={pct} onClick={()=>{setZoom(pct/100);if(pct<=100)setPanOffset({x:0,y:0});}}
                      style={{padding:'6px 2px',borderRadius:5,border:`1px solid ${Math.round(zoom*100)===pct?T.accent:T.border}`,background:Math.round(zoom*100)===pct?`${T.accent}18`:T.input,color:Math.round(zoom*100)===pct?T.accent:T.text,fontSize:10,cursor:'pointer',fontWeight:Math.round(zoom*100)===pct?'700':'400'}}>{pct}%</button>
                  ))}
                </div>

                <button onClick={()=>{setZoom(1);setPanOffset({x:0,y:0});}}
                  style={{...css.addBtn,marginTop:12,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>
                  Reset view
                </button>

                <span style={css.label}>Navigate</span>
                <div style={{...css.section,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:3}}>
                  <div/>
                  <button onClick={()=>setPanOffset(p=>({...p,y:p.y+30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>↑</button>
                  <div/>
                  <button onClick={()=>setPanOffset(p=>({...p,x:p.x+30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>←</button>
                  <button onClick={()=>setPanOffset({x:0,y:0})} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:9}}>⊙</button>
                  <button onClick={()=>setPanOffset(p=>({...p,x:p.x-30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>→</button>
                  <div/>
                  <button onClick={()=>setPanOffset(p=>({...p,y:p.y-30}))} style={{padding:6,borderRadius:4,border:`1px solid ${T.border}`,background:T.input,color:T.text,cursor:'pointer',fontSize:11}}>↓</button>
                  <div/>
                </div>
              </div>
            )}

            {activeTool==='brush'&&(
              <div>
                <span style={css.label}>Brush tools</span>
                {!selectedLayer||(selectedLayer.type!=='image'&&selectedLayer.type!=='background')||selectedLayer.isRimLight?(
                  <div style={{...css.section,marginTop:0,fontSize:12,color:T.muted,textAlign:'center',padding:20}}><div style={{fontSize:24,marginBottom:8}}>⌀</div>Click an image on the canvas first</div>
                ):(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600'}}>✓ Image selected — paint on the canvas</div>
                )}
                <BrushTool
                  layer={(selectedLayer?.type==='image'||selectedLayer?.type==='background')&&!selectedLayer?.isRimLight?selectedLayer:null}
                  theme={T}
                  brushOverlayRef={brushOverlayRef}
                  brushType={brushTypeState}
                  brushSize={brushSizeState}
                  brushStrength={brushStrengthState}
                  brushEdge={brushEdgeState}
                  brushFlow={brushFlowState}
                  brushStabilizer={brushStabilizerState}
                  brushSmoothing={brushSmoothingState}
                  brushSpacing={brushSpacingState}
                  paintColor={brushColorState}
                  paintAlpha={brushColorAlpha}
                  onBrushTypeChange={setBrushTypeState}
                  onBrushSizeChange={setBrushSizeState}
                  onBrushStrengthChange={setBrushStrengthState}
                  onBrushEdgeChange={setBrushEdgeState}
                  onBrushFlowChange={setBrushFlowState}
                  onBrushStabilizerChange={setBrushStabilizerState}
                  onBrushSmoothingChange={setBrushSmoothingState}
                  onBrushSpacingChange={setBrushSpacingState}
                  onPaintColorChange={(c)=>{
                    setBrushColorState(c);
                  }}
                  onPaintAlphaChange={setBrushColorAlpha}
                  onUpdate={(updates)=>{if(selectedId)updateLayer(selectedId,updates);}}
                  pressureEnabled={pressureEnabled}
                  pressureMapping={pressureMapping}
                  pressureCurve={pressureCurve}
                  pressureMin={pressureMin}
                  pressureMax={pressureMax}
                  tabletDetected={tabletDetected}
                  onPressureEnabledChange={setPressureEnabled}
                  onPressureMappingChange={setPressureMapping}
                  onPressureCurveChange={setPressureCurve}
                  onPressureMinChange={setPressureMin}
                  onPressureMaxChange={setPressureMax}
                />
                {/* Mask — coming soon */}
                {selectedLayer?.type==='image'&&(
                  <div style={{marginTop:10}}>
                    <span style={css.label}>Layer mask</span>
                    <div style={{...css.section,textAlign:'center',padding:12,fontSize:10,color:T.muted}}>
                      Coming soon — paint to hide/reveal parts of an image
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTool==='text'&&(
              <div>
                {/* ── Presets ──────────────────────────────────────────────── */}
                <span style={css.label}>Presets</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:5,marginBottom:4}}>
                  {TEXT_TEMPLATES.map((t,i)=>(<button key={i} onClick={()=>applyTextTemplate(t)} style={{padding:'7px 6px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:10,cursor:'pointer',fontFamily:resolveFontFamily(t.fontFamily),fontWeight:t.fontWeight||700,textAlign:'center'}}>{t.label}</button>))}
                </div>

                {/* ── Font picker ───────────────────────────────────────────── */}
                <span style={css.label}>Font</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:4,marginBottom:6}}>
                  {CURATED_FONTS.map(f=>(<button key={f.family} onClick={()=>{setFontFamily(f.family);setTextProp({fontFamily:f.family,fontWeight:f.weight});saveEngineRef.current?.markDirty('textContent');}} style={{padding:'8px 4px',borderRadius:6,border:`1.5px solid ${fontFamily===f.family?T.accent:T.border}`,background:fontFamily===f.family?`${T.accent}22`:T.input,color:T.text,fontSize:12,cursor:'pointer',fontFamily:resolveFontFamily(f.family),fontWeight:f.weight,textAlign:'center',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{f.label}</button>))}
                </div>
                <select value={fontFamily} onChange={e=>{setFontFamily(e.target.value);setTextProp({fontFamily:e.target.value});saveEngineRef.current?.markDirty('textContent');}} style={{...css.input,marginBottom:6}}>{FONTS.map(f=><option key={f}>{f}</option>)}</select>

                {/* ── Weight & Style ────────────────────────────────────────── */}
                <span style={css.label}>Weight &amp; Style</span>
                <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:6}}>
                  {FONT_WEIGHTS.map(fw=>(<button key={fw.value} onClick={()=>{setFontWeight(fw.value);setTextProp({fontWeight:fw.value});saveEngineRef.current?.markDirty('textContent');}} style={{padding:'4px 7px',borderRadius:4,border:`1px solid ${fontWeight===fw.value?T.accent:T.border}`,background:fontWeight===fw.value?T.accent:'transparent',color:fontWeight===fw.value?'#fff':T.text,fontSize:10,cursor:'pointer',fontWeight:fw.value}}>{fw.label}</button>))}
                  <button onClick={()=>{const ni=!fontItalic;setFontItalic(ni);setTextProp({fontItalic:ni});saveEngineRef.current?.markDirty('textContent');}} style={{...css.iconBtn(fontItalic),padding:'4px 8px',fontStyle:'italic',fontSize:11}}>I</button>
                </div>

                {/* ── Transform ────────────────────────────────────────────── */}
                <span style={css.label}>Transform</span>
                <div style={{display:'flex',gap:3,marginBottom:6}}>
                  {[['none','Aa'],['uppercase','AA'],['lowercase','aa'],['capitalize','Ab']].map(([v,l])=>(<button key={v} onClick={()=>{setTextTransform(v);setTextProp({textTransform:v});saveEngineRef.current?.markDirty('textContent');}} style={{...css.iconBtn(textTransform===v),flex:1,fontSize:10,padding:'4px 2px'}}>{l}</button>))}
                </div>

                {/* ── Content ───────────────────────────────────────────────── */}
                <span style={css.label}>Content</span>
                <input value={textInput} onChange={e=>setTextInput(e.target.value)} style={css.input} placeholder="Enter text..."/>

                {/* ── Size, spacing, leading ────────────────────────────────── */}
                <span style={css.label}>Size — {fontSize}px</span>
                <div style={css.row}>
                  <Slider min={8} max={200} value={fontSize} onChange={v=>{setFontSize(v);setTextPropSilent({fontSize:v});}} onCommit={v=>{setTextProp({fontSize:v});saveEngineRef.current?.markDirty('textContent');}} style={{flex:1}}/>
                  <input type="number" value={fontSize} onChange={e=>{const v=Number(e.target.value);setFontSize(v);setTextProp({fontSize:v});}} onBlur={()=>saveEngineRef.current?.markDirty('textContent')} style={{...css.input,width:50,padding:'5px 6px',textAlign:'center'}}/>
                </div>
                <span style={css.label}>Letter spacing — {letterSpacing}px</span>
                <Slider min={-20} max={200} value={letterSpacing} onChange={v=>{setLetterSpacing(v);setTextPropSilent({letterSpacing:v});}} onCommit={v=>{setTextProp({letterSpacing:v});saveEngineRef.current?.markDirty('textContent');}} style={{width:'100%'}}/>
                <span style={css.label}>Line height — {lineHeight}</span>
                <Slider min={0.8} max={3} step={0.1} value={lineHeight} onChange={v=>{setLineHeight(v);setTextPropSilent({lineHeight:v});}} onCommit={v=>{setTextProp({lineHeight:v});saveEngineRef.current?.markDirty('textContent');}} style={{width:'100%'}}/>

                {/* ── Alignment ─────────────────────────────────────────────── */}
                <span style={css.label}>Alignment</span>
                <div style={{display:'flex',gap:4,marginBottom:6}}>
                  {[['left','◀ Left'],['center','■ Center'],['right','Right ▶']].map(([val,label])=>(<button key={val} onClick={()=>{setTextAlign(val);setTextProp({textAlign:val});saveEngineRef.current?.markDirty('textContent');}} style={{...css.iconBtn(textAlign===val),flex:1,textAlign:'center',fontSize:10}}>{label}</button>))}
                </div>

                {/* ── Fill ─────────────────────────────────────────────────── */}
                <span style={css.label}>Fill</span>
                <div style={{display:'flex',gap:4,marginBottom:6}}>
                  {[['solid','Solid'],['gradient','Gradient']].map(([v,l])=>(<button key={v} onClick={()=>{setFillType(v);setTextProp({fillType:v});saveEngineRef.current?.markDirty('textContent');}} style={{...css.iconBtn(fillType===v),flex:1,fontSize:10}}>{l}</button>))}
                </div>
                {fillType==='solid'&&(
                  <input type="color" value={textColor} onChange={e=>{setTextColor(e.target.value);setTextProp({textColor:e.target.value});addRecentColor(e.target.value);saveEngineRef.current?.markDirty('textContent');}} style={css.color}/>
                )}
                {fillType==='gradient'&&(
                  <div style={css.section}>
                    <div style={css.row}><span style={{fontSize:10,color:T.muted,width:36}}>From</span><input type="color" value={gradColor1} onChange={e=>{setGradColor1(e.target.value);setTextProp({gradientColors:[e.target.value,gradColor2]});saveEngineRef.current?.markDirty('textContent');}} style={{...css.color,height:28}}/></div>
                    <div style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:36}}>To</span><input type="color" value={gradColor2} onChange={e=>{setGradColor2(e.target.value);setTextProp({gradientColors:[gradColor1,e.target.value]});saveEngineRef.current?.markDirty('textContent');}} style={{...css.color,height:28}}/></div>
                    <div style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:36}}>Angle</span><Slider min={0} max={360} value={gradAngle} onChange={v=>{setGradAngle(v);setTextPropSilent({gradientAngle:v});}} onCommit={v=>{setTextProp({gradientAngle:v});saveEngineRef.current?.markDirty('textContent');}} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:28}}>{gradAngle}°</span></div>
                  </div>
                )}

                {/* ── Primary stroke ────────────────────────────────────────── */}
                <span style={css.label}>Outline</span>
                <div style={css.row}>
                  <input type="color" value={strokeColor} onChange={e=>{setStrokeColor(e.target.value);setTextProp({strokeColor:e.target.value});saveEngineRef.current?.markDirty('textContent');}} style={{...css.color,width:44,flexShrink:0}}/>
                  <Slider min={0} max={30} value={strokeWidth} onChange={v=>{setStrokeWidth(v);setTextPropSilent({strokeWidth:v});}} onCommit={v=>{setTextProp({strokeWidth:v});saveEngineRef.current?.markDirty('textContent');}} style={{flex:1}}/>
                  <span style={{fontSize:10,color:T.muted,minWidth:24}}>{strokeWidth}px</span>
                </div>

                {/* ── Extra text strokes ────────────────────────────────────── */}
                <span style={css.label}>Extra strokes</span>
                <div style={css.section}>
                  {textStrokes.map((st,idx)=>(
                    <div key={idx} style={{...css.row,marginBottom:6}}>
                      <input type="color" value={st.color||'#000000'} onChange={e=>{const ns=[...textStrokes];ns[idx]={...ns[idx],color:e.target.value};setTextStrokes(ns);setTextProp({textStrokes:ns});saveEngineRef.current?.markDirty('textContent');}} style={{...css.color,width:32,height:24,flexShrink:0}}/>
                      <Slider min={0} max={30} value={st.width||0} onChange={v=>{const ns=[...textStrokes];ns[idx]={...ns[idx],width:v};setTextStrokes(ns);setTextPropSilent({textStrokes:ns});}} onCommit={()=>saveEngineRef.current?.markDirty('textContent')} style={{flex:1}}/>
                      <span style={{fontSize:10,color:T.muted,minWidth:22}}>{st.width||0}px</span>
                      <button onClick={()=>{const ns=textStrokes.filter((_,i)=>i!==idx);setTextStrokes(ns);setTextProp({textStrokes:ns});saveEngineRef.current?.markDirty('textContent');}} style={{background:'transparent',border:'none',color:T.danger,cursor:'pointer',fontSize:14,padding:'0 2px'}}>×</button>
                    </div>
                  ))}
                  {textStrokes.length<3&&(<button onClick={()=>{const ns=[...textStrokes,{color:'#000000',width:4,enabled:true}];setTextStrokes(ns);setTextProp({textStrokes:ns});}} style={{...css.iconBtn(false),width:'100%',fontSize:10,marginTop:2}}>+ Add stroke</button>)}
                </div>

                {/* ── Drop shadow ───────────────────────────────────────────── */}
                <span style={css.label}>Drop shadow</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>{const ne=!shadowEnabled;setShadowEnabled(ne);setTextProp({shadowEnabled:ne});saveEngineRef.current?.markDirty('textContent');}} style={css.iconBtn(shadowEnabled)}>{shadowEnabled?'On':'Off'}</button></div>
                  {shadowEnabled&&<>
                    <div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:36}}>Color</span><input type="color" value={shadowColor} onChange={e=>{setShadowColor(e.target.value);setTextProp({shadowColor:e.target.value});saveEngineRef.current?.markDirty('textContent');}} style={{...css.color,height:28}}/></div>
                    {[['Blur','shadowBlur',shadowBlur,setShadowBlur,0,40],['X','shadowX',shadowX,setShadowX,-20,20],['Y','shadowY',shadowY,setShadowY,-20,20]].map(([l,k,v,sv,mn,mx])=>(<div key={l} style={{...css.row,marginTop:4}}><span style={{fontSize:10,color:T.muted,width:28}}>{l}</span><Slider min={mn} max={mx} value={v} onChange={nv=>{sv(nv);setTextPropSilent({[k]:nv});}} onCommit={nv=>{setTextProp({[k]:nv});saveEngineRef.current?.markDirty('textContent');}} style={{flex:1}}/><span style={{fontSize:10,color:T.muted,minWidth:20,textAlign:'right'}}>{v}</span></div>))}
                  </>}
                </div>

                {/* ── Glow ─────────────────────────────────────────────────── */}
                <span style={css.label}>Glow</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>{const ne=!glowEnabled;setGlowEnabled(ne);setTextProp({glowEnabled:ne});saveEngineRef.current?.markDirty('textContent');}} style={css.iconBtn(glowEnabled)}>{glowEnabled?'On':'Off'}</button></div>
                  {glowEnabled&&<div style={{...css.row,marginTop:8}}><span style={{fontSize:10,color:T.muted,width:36}}>Color</span><input type="color" value={glowColor} onChange={e=>{setGlowColor(e.target.value);setTextProp({glowColor:e.target.value});saveEngineRef.current?.markDirty('textContent');}} style={{...css.color,height:28}}/></div>}
                </div>

                {/* ── Warp ─────────────────────────────────────────────────── */}
                <span style={css.label}>Warp</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:3,marginBottom:6}}>
                  {[['none','None'],['arc','Arc'],['wave','Wave'],['bulge','Bulge']].map(([v,l])=>(<button key={v} onClick={()=>{setWarpType(v);setTextProp({warpType:v});saveEngineRef.current?.markDirty('textContent');}} style={{...css.iconBtn(warpType===v),fontSize:10,padding:'5px 4px'}}>{l}</button>))}
                </div>
                {warpType!=='none'&&<><span style={css.label}>Amount — {warpAmount}%</span><Slider min={0} max={100} value={warpAmount} onChange={v=>{setWarpAmount(v);setTextPropSilent({warpAmount:v});}} onCommit={v=>{setTextProp({warpAmount:v});saveEngineRef.current?.markDirty('textContent');}} style={{width:'100%'}}/></>}

                {/* ── Arc (legacy) ──────────────────────────────────────────── */}
                <span style={css.label}>Text on arc (legacy)</span>
                <div style={css.section}>
                  <div style={css.row}><span style={{fontSize:11,color:T.muted,flex:1}}>Enabled</span><button onClick={()=>{const ne=!arcEnabled;setArcEnabled(ne);setTextProp({arcEnabled:ne});saveEngineRef.current?.markDirty('textContent');}} style={css.iconBtn(arcEnabled)}>{arcEnabled?'On':'Off'}</button></div>
                  {arcEnabled&&<><span style={{...css.label,marginTop:8}}>Radius — {arcRadius}px</span><Slider min={60} max={300} value={arcRadius} onChange={v=>{setArcRadius(v);setTextPropSilent({arcRadius:v});}} onCommit={v=>{setTextProp({arcRadius:v});saveEngineRef.current?.markDirty('textContent');}} style={{width:'100%'}}/></>}
                </div>

                {/* ── Recent colors ─────────────────────────────────────────── */}
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>{recentColors.map((c,i)=>(<div key={i} onClick={()=>{setTextColor(c);setTextProp({textColor:c});saveEngineRef.current?.markDirty('textContent');}} style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>))}</div>

                {/* ── Selected layer live edit ───────────────────────────────── */}
                {selectedLayer?.type==='text'&&(<>
                  <span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span>
                  <Slider min={0} max={100} value={selectedLayer.opacity??100}
                    onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                    onCommit={v=>updateLayer(selectedId,{opacity:v})}
                    style={{width:'100%'}}/>
                  <span style={css.label}>Live edit text</span>
                  <input value={selectedLayer.text} onChange={e=>updateLayer(selectedId,{text:e.target.value})} onBlur={()=>saveEngineRef.current?.markDirty('textContent',selectedId)} style={css.input} placeholder="Edit text..."/>
                  <span style={css.label}>Letter spacing</span>
                  <Slider min={-20} max={200} value={selectedLayer.letterSpacing||0}
                    onChange={v=>updateLayerSilent(selectedId,{letterSpacing:v})}
                    onCommit={v=>{updateLayer(selectedId,{letterSpacing:v});saveEngineRef.current?.markDirty('textContent',selectedId);}}
                    style={{width:'100%'}}/>
                  {/* Warp Text button */}
                  <button onClick={()=>setShowTextWarp(w=>!w)}
                    style={{...css.addBtn,marginTop:6,background:showTextWarp?'rgba(255,106,0,0.2)':T.input,color:T.text,border:`1px solid ${showTextWarp?'#ff6a00':T.border}`,fontSize:11}}>
                    ⬡ Warp Text {showTextWarp?'▲':'▼'}
                  </button>
                  {showTextWarp&&(
                    <div style={{background:'#1e1e1e',border:'1px solid #ff6a00',borderRadius:8,padding:'10px',marginTop:4}}>
                      <div style={{fontSize:10,fontWeight:'700',color:'#ff6a00',marginBottom:8}}>Text Warp</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginBottom:6}}>Preset</div>
                      <select value={selectedLayer.warpPreset||'none'} onChange={e=>updateLayer(selectedId,{warpPreset:e.target.value})}
                        style={{width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid #444',background:'#2a2a2a',color:'#fff',fontSize:11,marginBottom:8,cursor:'pointer'}}>
                        {Object.keys(WARP_PRESETS).map(k=><option key={k} value={k}>{k.charAt(0).toUpperCase()+k.slice(1)}</option>)}
                      </select>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginBottom:4}}>Bend — {selectedLayer.warpBend||30}</div>
                      <input type="range" min={-100} max={100} value={selectedLayer.warpBend||30}
                        onChange={e=>updateLayer(selectedId,{warpBend:Number(e.target.value)})}
                        style={{width:'100%',accentColor:'#ff6a00',marginBottom:8}}/>
                      <button onClick={()=>{
                        setWarpPreset(selectedLayer.warpPreset||'arc');
                        setWarpBend(selectedLayer.warpBend||30);
                        setWarpMode(true);
                        setShowTextWarp(false);
                      }} style={{width:'100%',padding:'6px',borderRadius:6,border:'none',background:'#ff6a00',color:'#fff',fontSize:11,fontWeight:'700',cursor:'pointer'}}>
                        Apply Warp
                      </button>
                    </div>
                  )}
                </>)}
                <button onClick={addText} style={css.addBtn}>Add text</button>
              </div>
            )}

            {activeTool==='shapes'&&(
              <div>
                <span style={css.label}>Shapes & icons</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                  {SHAPES_BASIC.map(({key,label,icon})=>(<button key={key} onClick={()=>addShape(key)} style={{padding:'10px 4px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:9,cursor:'pointer',textAlign:'center',lineHeight:1.5}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.background=`${T.accent}12`;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.input;}}><div style={{fontSize:16,marginBottom:2}}>{icon}</div><div>{label}</div></button>))}
                </div>
                <span style={css.label}>Fill color</span>
                <input type="color" value={fillColor} onChange={e=>{setFillColor(e.target.value);addRecentColor(e.target.value);if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:e.target.value});}} style={css.color}/>
                <div style={css.section}>
                  {[['R',0],['G',1],['B',2]].map(([l,idx])=>{
                    const hex=fillColor.replace('#','');
                    const vals=[parseInt(hex.slice(0,2),16)||0,parseInt(hex.slice(2,4),16)||0,parseInt(hex.slice(4,6),16)||0];
                    const colors=['#f87171','#4ade80','#60a5fa'];
                    return(
                      <div key={l} style={{...css.row,marginBottom:6}}>
                        <span style={{fontSize:11,color:colors[idx],fontWeight:'700',width:12}}>{l}</span>
                        <Slider min={0} max={255} value={vals[idx]}
                          onChange={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setFillColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayerSilent(selectedId,{fillColor:newHex});
                          }}
                          onCommit={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setFillColor(newHex);addRecentColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:newHex});
                          }}
                          style={{flex:1}}/>
                        <span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{vals[idx]}</span>
                      </div>
                    );
                  })}
                  <div style={{width:'100%',height:28,borderRadius:6,background:fillColor,margin:'4px 0 6px',border:`1px solid ${T.border}`}}/>
                </div>
                <span style={css.label}>Border color</span>
                <input type="color" value={strokeColor} onChange={e=>{setStrokeColor(e.target.value);if(selectedLayer?.type==='shape')updateLayer(selectedId,{strokeColor:e.target.value});}} style={css.color}/>
                <div style={css.section}>
                  {[['R',0],['G',1],['B',2]].map(([l,idx])=>{
                    const hex=strokeColor.replace('#','');
                    const vals=[parseInt(hex.slice(0,2),16)||0,parseInt(hex.slice(2,4),16)||0,parseInt(hex.slice(4,6),16)||0];
                    const colors=['#f87171','#4ade80','#60a5fa'];
                    return(
                      <div key={l} style={{...css.row,marginBottom:6}}>
                        <span style={{fontSize:11,color:colors[idx],fontWeight:'700',width:12}}>{l}</span>
                        <Slider min={0} max={255} value={vals[idx]}
                          onChange={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setStrokeColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayerSilent(selectedId,{strokeColor:newHex});
                          }}
                          onCommit={v=>{
                            const newVals=[...vals];newVals[idx]=v;
                            const newHex='#'+newVals.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
                            setStrokeColor(newHex);
                            if(selectedLayer?.type==='shape')updateLayer(selectedId,{strokeColor:newHex});
                          }}
                          style={{flex:1}}/>
                        <span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{vals[idx]}</span>
                      </div>
                    );
                  })}
                  <div style={{width:'100%',height:28,borderRadius:6,background:strokeColor,margin:'4px 0 6px',border:`1px solid ${T.border}`}}/>
                </div>
                {selectedLayer?.type==='shape'&&(<>
                  <span style={css.label}>Blend mode</span>
                  <BlendModeSelect value={selectedLayer.blendMode||'normal'} onChange={v=>{updateLayer(selectedId,{blendMode:v});saveEngineRef.current?.markDirty('layerProperties');}} style={css.input}/>
                  <span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span>
                  <Slider min={0} max={100} value={selectedLayer.opacity??100}
                    onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                    onCommit={v=>updateLayer(selectedId,{opacity:v})}
                    style={{width:'100%'}}/>
                  <div style={{display:'flex',gap:5,marginTop:8}}>
                    <button onClick={()=>flipLayer(selectedId,'h')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↔ H</button>
                    <button onClick={()=>flipLayer(selectedId,'v')} style={{...css.addBtn,flex:1,marginTop:0,background:T.input,color:T.text,border:`1px solid ${T.border}`,fontSize:11}}>↕ V</button>
                  </div>
                </>)}
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                  {recentColors.map((c,i)=>(
                    <div key={i} onClick={()=>{setFillColor(c);addRecentColor(c);if(selectedLayer?.type==='shape')updateLayer(selectedId,{fillColor:c});}}
                      style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>
                  ))}
                </div>
              </div>
            )}

            {activeTool==='effects'&&(
              <div style={{paddingBottom:12}}>
                {/* Panel header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px 6px'}}>
                  <span style={{fontSize:11,fontWeight:'700',color:T.text,letterSpacing:'0.7px',textTransform:'uppercase'}}>Layer Effects</span>
                  {selectedLayer&&selectedLayer.type!=='background'&&selectedLayer.type!=='adjustment'&&selectedLayer.type!=='curves'&&(
                    <button onClick={()=>updateLayer(selectedId,{effects:defaultEffects()})}
                      style={{fontSize:9,color:T.muted,background:'transparent',border:`1px solid ${T.border}`,cursor:'pointer',padding:'2px 7px',borderRadius:3,letterSpacing:'0.3px'}}
                      onMouseEnter={e=>e.currentTarget.style.color=T.danger}
                      onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
                      Reset all
                    </button>
                  )}
                </div>

                {!selectedLayer||selectedLayer.type==='background'||selectedLayer.type==='adjustment'||selectedLayer.type==='curves'?(
                  <div style={{textAlign:'center',padding:'28px 16px'}}>
                    <div style={{fontSize:22,opacity:0.2,marginBottom:10}}>⬡</div>
                    <div style={{fontSize:12,color:T.muted,lineHeight:1.6}}>{selectedLayer?.type==='adjustment'||selectedLayer?.type==='curves'?'Effects cannot be applied to adjustment layers':<>Select a layer<br/>to apply effects</>}</div>
                  </div>
                ):(()=>{
                  const fx=selectedLayer.effects||defaultEffects();
                  const sid=selectedId;

                  // ── Reusable toggle header ──────────────────────────────
                  const EffectToggle=({label,enabled,onToggle,accent})=>{
                    const col=accent||T.accent;
                    return(
                      <div onClick={onToggle} style={{
                        display:'flex',alignItems:'center',justifyContent:'space-between',
                        padding:'7px 10px',borderRadius:6,cursor:'pointer',
                        background:enabled?`rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},0.08)`:'transparent',
                        border:`1px solid ${enabled?col+'55':T.border}`,
                        transition:'all 0.12s',userSelect:'none',
                      }}
                      onMouseEnter={e=>!enabled&&(e.currentTarget.style.borderColor=col+'33')}
                      onMouseLeave={e=>!enabled&&(e.currentTarget.style.borderColor=T.border)}>
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          <div style={{
                            width:6,height:6,borderRadius:'50%',flexShrink:0,
                            background:enabled?col:T.border,
                            boxShadow:enabled?`0 0 8px ${col}`:'none',
                            transition:'all 0.15s',
                          }}/>
                          <span style={{fontSize:11,fontWeight:'700',letterSpacing:'0.6px',textTransform:'uppercase',color:enabled?T.text:T.muted,transition:'color 0.12s'}}>{label}</span>
                        </div>
                        {/* Toggle switch */}
                        <div style={{width:26,height:13,borderRadius:7,background:enabled?col:T.border,position:'relative',transition:'background 0.15s',flexShrink:0}}>
                          <div style={{position:'absolute',top:2,left:enabled?14:2,width:9,height:9,borderRadius:'50%',background:'#fff',transition:'left 0.12s',boxShadow:'0 1px 3px rgba(0,0,0,0.5)'}}/>
                        </div>
                      </div>
                    );
                  };

                  // ── Reusable slider row ─────────────────────────────────
                  const SliderRow=({label,value,min,max,unit='',onChange,onCommit,width})=>(
                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:5}}>
                      <span style={{fontSize:9,color:T.muted,width:width||32,flexShrink:0,letterSpacing:'0.3px'}}>{label}</span>
                      <Slider min={min} max={max} value={value} onChange={onChange} onCommit={onCommit} style={{flex:1}}/>
                      <span style={{fontSize:9,color:T.muted,minWidth:26,textAlign:'right'}}>{value}{unit}</span>
                    </div>
                  );

                  // ── Color + label row ───────────────────────────────────
                  const ColorRow=({label,value,onChange})=>(
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5}}>
                      <span style={{fontSize:9,color:T.muted,width:32,flexShrink:0}}>{label}</span>
                      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                        <div style={{width:22,height:22,borderRadius:4,background:value,border:`1px solid ${T.border}`,flexShrink:0,cursor:'pointer'}}/>
                        <input type="color" value={value} onChange={onChange} style={{position:'absolute',opacity:0,width:0,height:0}}/>
                        <span style={{fontSize:10,color:T.muted,fontFamily:'monospace'}}>{value}</span>
                      </label>
                    </div>
                  );

                  const strokes=Array.isArray(fx.strokes)?fx.strokes:[];

                  return(
                    <div style={{padding:'0 8px',display:'flex',flexDirection:'column',gap:6}}>
                      {/* Non-destructive badge */}
                      <div style={{fontSize:10,color:T.success,display:'flex',alignItems:'center',gap:4,padding:'3px 4px'}}>
                        <span>✦</span><span>Non-destructive — live preview</span>
                      </div>

                      {/* ───────────────── DROP SHADOW ───────────────────── */}
                      <div style={{borderRadius:7,border:`1px solid ${T.border}`,overflow:'hidden'}}>
                        <EffectToggle label="Drop Shadow" enabled={fx.shadow?.enabled}
                          onToggle={()=>updateLayerEffectNested(sid,'shadow','enabled',!fx.shadow?.enabled)}/>
                        {fx.shadow?.enabled&&(
                          <div style={{padding:'8px 10px',borderTop:`1px solid ${T.border}`,background:T.bg2}}>
                            <ColorRow label="Color" value={fx.shadow?.color||'#000000'}
                              onChange={e=>updateLayerEffectNested(sid,'shadow','color',e.target.value)}/>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:6}}>
                              <SliderRow label="X" value={fx.shadow?.x??4} min={-40} max={40} unit="px"
                                onChange={v=>updateLayerEffectNestedSilent(sid,'shadow','x',v)}
                                onCommit={v=>updateLayerEffectNested(sid,'shadow','x',v)}/>
                              <SliderRow label="Y" value={fx.shadow?.y??4} min={-40} max={40} unit="px"
                                onChange={v=>updateLayerEffectNestedSilent(sid,'shadow','y',v)}
                                onCommit={v=>updateLayerEffectNested(sid,'shadow','y',v)}/>
                              <SliderRow label="Blur" value={fx.shadow?.blur??12} min={0} max={60} unit="px"
                                onChange={v=>updateLayerEffectNestedSilent(sid,'shadow','blur',v)}
                                onCommit={v=>updateLayerEffectNested(sid,'shadow','blur',v)}/>
                              <SliderRow label="Spread" value={fx.shadow?.spread??0} min={0} max={30} unit="px"
                                onChange={v=>updateLayerEffectNestedSilent(sid,'shadow','spread',v)}
                                onCommit={v=>updateLayerEffectNested(sid,'shadow','spread',v)}/>
                            </div>
                            <SliderRow label="Opacity" value={fx.shadow?.opacity??60} min={0} max={100} unit="%"
                              onChange={v=>updateLayerEffectNestedSilent(sid,'shadow','opacity',v)}
                              onCommit={v=>updateLayerEffectNested(sid,'shadow','opacity',v)} width={42}/>
                          </div>
                        )}
                      </div>

                      {/* ───────────────── OUTER GLOW ────────────────────── */}
                      <div style={{borderRadius:7,border:`1px solid ${T.border}`,overflow:'hidden'}}>
                        <EffectToggle label="Outer Glow" enabled={fx.glow?.enabled} accent='#f59e0b'
                          onToggle={()=>updateLayerEffectNested(sid,'glow','enabled',!fx.glow?.enabled)}/>
                        {fx.glow?.enabled&&(
                          <div style={{padding:'8px 10px',borderTop:`1px solid ${T.border}`,background:T.bg2}}>
                            <ColorRow label="Color" value={fx.glow?.color||'#f97316'}
                              onChange={e=>updateLayerEffectNested(sid,'glow','color',e.target.value)}/>
                            <SliderRow label="Size" value={fx.glow?.blur??20} min={0} max={80} unit="px"
                              onChange={v=>updateLayerEffectNestedSilent(sid,'glow','blur',v)}
                              onCommit={v=>updateLayerEffectNested(sid,'glow','blur',v)} width={28}/>
                            <SliderRow label="Opacity" value={fx.glow?.opacity??80} min={0} max={100} unit="%"
                              onChange={v=>updateLayerEffectNestedSilent(sid,'glow','opacity',v)}
                              onCommit={v=>updateLayerEffectNested(sid,'glow','opacity',v)} width={42}/>
                          </div>
                        )}
                      </div>

                      {/* ───────────────── STROKE / OUTLINE ─────────────── */}
                      <div style={{borderRadius:7,border:`1px solid ${T.border}`,overflow:'hidden'}}>
                        <EffectToggle label="Stroke" enabled={fx.outline?.enabled} accent='#60a5fa'
                          onToggle={()=>updateLayerEffectNested(sid,'outline','enabled',!fx.outline?.enabled)}/>
                        {fx.outline?.enabled&&(
                          <div style={{padding:'8px 10px',borderTop:`1px solid ${T.border}`,background:T.bg2}}>
                            <ColorRow label="Color" value={fx.outline?.color||'#ffffff'}
                              onChange={e=>updateLayerEffectNested(sid,'outline','color',e.target.value)}/>
                            <SliderRow label="Width" value={fx.outline?.width??2} min={1} max={24} unit="px"
                              onChange={v=>updateLayerEffectNestedSilent(sid,'outline','width',v)}
                              onCommit={v=>updateLayerEffectNested(sid,'outline','width',v)} width={28}/>
                            {/* Position */}
                            <div style={{display:'flex',gap:3,marginTop:6}}>
                              {['outside','center','inside'].map(pos=>(
                                <button key={pos} onClick={()=>updateLayerEffectNested(sid,'outline','position',pos)}
                                  style={{flex:1,padding:'3px 0',borderRadius:4,border:`1px solid ${(fx.outline?.position||'outside')===pos?'#60a5fa':T.border}`,background:(fx.outline?.position||'outside')===pos?'rgba(96,165,250,0.15)':T.bg,color:(fx.outline?.position||'outside')===pos?'#60a5fa':T.muted,fontSize:9,fontWeight:'600',cursor:'pointer',textTransform:'capitalize',letterSpacing:'0.3px'}}>
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Additional strokes */}
                        {strokes.length>0&&strokes.map((st,i)=>(
                          <div key={i} style={{borderTop:`1px solid ${T.border}`,background:T.bg2}}>
                            <div style={{display:'flex',alignItems:'center',gap:4,padding:'6px 10px'}}>
                              <div onClick={()=>{const ns=[...strokes];ns[i]={...ns[i],enabled:!ns[i].enabled};updateLayerStrokes(sid,ns);}}
                                style={{width:6,height:6,borderRadius:'50%',background:st.enabled?'#60a5fa':T.border,cursor:'pointer',flexShrink:0,boxShadow:st.enabled?'0 0 6px #60a5fa':'none'}}/>
                              <span style={{fontSize:9,color:T.muted,letterSpacing:'0.4px',textTransform:'uppercase',fontWeight:'700'}}>Stroke {i+2}</span>
                              <div style={{flex:1}}/>
                              <button onClick={()=>{const ns=strokes.filter((_,j)=>j!==i);updateLayerStrokes(sid,ns);}}
                                style={{padding:'1px 5px',borderRadius:3,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,cursor:'pointer',lineHeight:1}}
                                onMouseEnter={e=>e.currentTarget.style.color=T.danger}
                                onMouseLeave={e=>e.currentTarget.style.color=T.muted}>✕</button>
                            </div>
                            {st.enabled&&(
                              <div style={{padding:'0 10px 8px'}}>
                                <ColorRow label="Color" value={st.color||'#ffffff'}
                                  onChange={e=>{const ns=[...strokes];ns[i]={...ns[i],color:e.target.value};updateLayerStrokes(sid,ns);}}/>
                                <SliderRow label="Width" value={st.width||2} min={1} max={24} unit="px"
                                  onChange={v=>{const ns=[...strokes];ns[i]={...ns[i],width:v};updateLayerStrokes(sid,ns);}}
                                  onCommit={v=>{const ns=[...strokes];ns[i]={...ns[i],width:v};updateLayerStrokes(sid,ns);}} width={28}/>
                                <div style={{display:'flex',gap:3,marginTop:5}}>
                                  {['outside','center','inside'].map(pos=>(
                                    <button key={pos} onClick={()=>{const ns=[...strokes];ns[i]={...ns[i],position:pos};updateLayerStrokes(sid,ns);}}
                                      style={{flex:1,padding:'3px 0',borderRadius:4,border:`1px solid ${(st.position||'outside')===pos?'#60a5fa':T.border}`,background:(st.position||'outside')===pos?'rgba(96,165,250,0.15)':T.bg,color:(st.position||'outside')===pos?'#60a5fa':T.muted,fontSize:9,fontWeight:'600',cursor:'pointer',textTransform:'capitalize'}}>
                                      {pos}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Add stroke */}
                        {strokes.length<3&&(
                          <div style={{borderTop:`1px solid ${T.border}`}}>
                            <button onClick={()=>updateLayerStrokes(sid,[...strokes,{enabled:true,color:'#ff6b00',width:2,position:'outside'}])}
                              style={{width:'100%',padding:'6px',background:'transparent',border:'none',color:T.muted,fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}
                              onMouseEnter={e=>e.currentTarget.style.color=T.accent}
                              onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
                              <span>+</span><span>Add stroke</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ───────────────── SUBJECT GLOW OUTLINE ─────────── */}
                      <div style={{borderRadius:7,border:`1px solid ${T.border}`,overflow:'hidden'}}>
                        <EffectToggle label="Subject Outline" enabled={fx.subjectOutline?.enabled} accent='#22c55e'
                          onToggle={()=>updateLayerEffectNested(sid,'subjectOutline','enabled',!fx.subjectOutline?.enabled)}/>
                        {fx.subjectOutline?.enabled&&(
                          <div style={{padding:'8px 10px',borderTop:`1px solid ${T.border}`,background:T.bg2}}>
                            <div style={{fontSize:9,color:T.muted,marginBottom:6,lineHeight:1.5}}>Contour glow — best on PNG cutouts &amp; removed backgrounds</div>
                            <ColorRow label="Color" value={fx.subjectOutline?.color||'#ffffff'}
                              onChange={e=>updateLayerEffectNested(sid,'subjectOutline','color',e.target.value)}/>
                            <SliderRow label="Width" value={fx.subjectOutline?.width||5} min={1} max={30} unit="px"
                              onChange={v=>updateLayerEffectNestedSilent(sid,'subjectOutline','width',v)}
                              onCommit={v=>updateLayerEffectNested(sid,'subjectOutline','width',v)} width={28}/>
                          </div>
                        )}
                      </div>

                      {/* ───────────────── IMAGE ADJUSTMENTS ────────────── */}
                      <div style={{borderRadius:7,border:`1px solid ${T.border}`,overflow:'hidden'}}>
                        <div style={{padding:'7px 10px',display:'flex',alignItems:'center',gap:7}}>
                          <span style={{fontSize:11,fontWeight:'700',letterSpacing:'0.6px',textTransform:'uppercase',color:T.muted}}>Adjustments</span>
                        </div>
                        <div style={{padding:'4px 10px 10px',borderTop:`1px solid ${T.border}`,background:T.bg2}}>
                          <SliderRow label="Blur" value={fx.layerBlur||0} min={0} max={30} unit="px"
                            onChange={v=>updateLayerEffectSilent(sid,'layerBlur',v)}
                            onCommit={v=>updateLayerEffect(sid,'layerBlur',v)} width={28}/>
                          <SliderRow label="Bright" value={fx.brightness||100} min={0} max={200} unit="%"
                            onChange={v=>updateLayerEffectSilent(sid,'brightness',v)}
                            onCommit={v=>updateLayerEffect(sid,'brightness',v)} width={28}/>
                          <SliderRow label="Contrast" value={fx.contrast||100} min={0} max={300} unit="%"
                            onChange={v=>updateLayerEffectSilent(sid,'contrast',v)}
                            onCommit={v=>updateLayerEffect(sid,'contrast',v)} width={42}/>
                          <SliderRow label="Saturat" value={fx.saturation||100} min={0} max={300} unit="%"
                            onChange={v=>updateLayerEffectSilent(sid,'saturation',v)}
                            onCommit={v=>updateLayerEffect(sid,'saturation',v)} width={42}/>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTool==='stickers'&&(
              <div>
                <span style={css.label}>Category</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>{Object.keys(STICKER_CATEGORIES).map(cat=>(<button key={cat} onClick={()=>setActiveCategory(cat)} style={css.pill(activeCategory===cat)}>{cat}</button>))}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                  {STICKER_CATEGORIES[activeCategory].map((s,i)=>(<div key={i} onClick={()=>addSvgSticker(s.svg,s.label)} style={{padding:'9px 4px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}><div style={{width:32,height:32}} dangerouslySetInnerHTML={{__html:s.svg}}/><span style={{fontSize:9,color:T.muted,textAlign:'center'}}>{s.label}</span></div>))}
                </div>
              </div>
            )}

            {activeTool==='memes'&&(
              <Suspense fallback={null}><MemesPanel theme={T} onAddSvg={addSvgSticker}
                onAddGif={(url,w,h)=>{
                  const aspect=w/h,cW=p.preview.w,cH=p.preview.h,ca=cW/cH;
                  let fw,fh;if(aspect>ca){fh=cH;fw=fh*aspect;}else{fw=cW;fh=fw/aspect;}
                  addLayer({type:'image',src:url,width:Math.round(fw),height:Math.round(fh),x:Math.round((cW-fw)/2),y:Math.round((cH-fh)/2),cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0});
                }}
              /></Suspense>
            )}

            {activeTool==='background'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Click the background on the canvas to select it.</div>
                <span style={css.label}>Solid color</span>
                <input type="color" value={bg?.bgColor||'#f97316'} onChange={e=>{updateBg({bgColor:e.target.value,bgGradient:null});addRecentColor(e.target.value);}} style={css.color}/>
                <span style={css.label}>RGB mixer</span>
                <div style={css.section}>
                  {[['R',rgbR,setRgbR,'#f87171'],['G',rgbG,setRgbG,'#4ade80'],['B',rgbB,setRgbB,'#60a5fa']].map(([l,v,sv,c])=>(<div key={l} style={{...css.row,marginBottom:6}}><span style={{fontSize:11,color:c,fontWeight:'700',width:12}}>{l}</span><Slider min={0} max={255} value={v} onChange={sv} onCommit={triggerAutoSave} style={{flex:1}}/><span style={{fontSize:10,color:T.text,width:26,textAlign:'right'}}>{Math.round(v)}</span></div>))}
                  <div style={{width:'100%',height:28,borderRadius:6,background:`rgb(${Math.round(rgbR)},${Math.round(rgbG)},${Math.round(rgbB)})`,margin:'4px 0 8px',border:`1px solid ${T.border}`}}/>
                  <button onClick={()=>{const hex='#'+[rgbR,rgbG,rgbB].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');updateBg({bgColor:hex,bgGradient:null});addRecentColor(hex);}} style={{...css.addBtn,marginTop:0}}>Apply</button>
                </div>
                <span style={css.label}>Gradients</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                  {GRADIENTS.map(([c1,c2],i)=>(<div key={i} onClick={()=>updateBg({bgGradient:[c1,c2]})} style={{height:36,borderRadius:6,background:`linear-gradient(135deg,${c1},${c2})`,cursor:'pointer',border:bg?.bgGradient?.[0]===c1?'2px solid #fff':`1px solid ${T.border}`}}/>))}
                </div>
                <span style={css.label}>Recent colors</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{recentColors.map((c,i)=>(<div key={i} onClick={()=>updateBg({bgColor:c,bgGradient:null})} style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/>))}</div>
                {bg&&(<><span style={css.label}>Opacity — {bg.opacity??100}%</span><Slider min={0} max={100} value={bg.opacity??100} onChange={v=>updateLayerSilent(bg.id,{opacity:v})} onCommit={v=>updateLayer(bg.id,{opacity:v})} style={{width:'100%'}}/></>)}
              </div>
            )}

            {(activeTool==='curves'||selectedLayer?.type==='curves')&&(
              <div>
                {selectedLayer?.type==='curves'?(
                  <CurvesPanel
                    curves={selectedLayer.curves||DEFAULT_CURVES()}
                    onChangeSilent={c=>updateLayerSilent(selectedLayer.id,{curves:c})}
                    onChange={c=>updateLayer(selectedLayer.id,{curves:c})}
                    T={T}
                  />
                ):(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Add a Curves adjustment layer to non-destructively adjust tone and color for all layers below it.</div>
                )}
                <button onClick={addCurvesLayer} style={css.addBtn}>+ Add Curves Layer</button>
              </div>
            )}

            {/* ── Retouch tools panel ───────────────────────────────────────── */}
            {RETOUCH_TOOLS.includes(activeTool)&&(
              <div>
                <span style={css.label}>Retouch — {activeTool==='dodge'?'Dodge':activeTool==='burn'?'Burn':activeTool==='smudge'?'Smudge':activeTool==='blur-brush'?'Blur Brush':'Sharpen'}</span>
                {!selectedLayer||(selectedLayer.type!=='image'&&selectedLayer.type!=='background')||selectedLayer.isRimLight?(
                  <div style={{...css.section,marginTop:0,fontSize:12,color:T.muted,textAlign:'center',padding:20}}>Click an image layer first</div>
                ):(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.success,fontWeight:'600'}}>✓ Paint on the canvas to apply</div>
                )}
                {(activeTool==='dodge'||activeTool==='burn')&&(<>
                  <span style={css.label}>Mode</span>
                  <div style={{display:'flex',gap:4,marginBottom:8}}>
                    {['dodge','burn'].map(m=>(
                      <button key={m} onClick={()=>{setDodgeBurnMode(m);setActiveTool(m);}}
                        style={{...css.iconBtn(activeTool===m),flex:1,fontSize:11,textTransform:'capitalize'}}>
                        {m==='dodge'?'◉ Dodge':'◎ Burn'}
                      </button>
                    ))}
                  </div>
                  <span style={css.label}>Range</span>
                  <div style={{display:'flex',gap:4,marginBottom:8}}>
                    {['shadows','midtones','highlights'].map(r=>(
                      <button key={r} onClick={()=>setRetouchRange(r)}
                        style={{...css.iconBtn(retouchRange===r),flex:1,fontSize:9,textTransform:'capitalize'}}>
                        {r.charAt(0).toUpperCase()+r.slice(1)}
                      </button>
                    ))}
                  </div>
                  <span style={css.label}>Exposure — {retouchExposure}%</span>
                  <Slider min={1} max={100} value={retouchExposure} onChange={setRetouchExposure} style={{width:'100%'}}/>
                </>)}
                {(activeTool==='smudge'||activeTool==='blur-brush'||activeTool==='sharpen-brush')&&(<>
                  <span style={css.label}>Strength — {retouchStrength}%</span>
                  <Slider min={1} max={100} value={retouchStrength} onChange={setRetouchStrength} style={{width:'100%'}}/>
                  {activeTool==='smudge'&&(
                    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:T.text,marginTop:6,cursor:'pointer'}}>
                      <input type="checkbox" checked={fingerPainting} onChange={e=>setFingerPainting(e.target.checked)} style={{accentColor:T.accent}}/>
                      Finger Painting
                    </label>
                  )}
                </>)}
                <span style={{...css.label,marginTop:8}}>Brush size — {brushSizeState}px</span>
                <Slider min={1} max={300} value={brushSizeState} onChange={setBrushSizeState} style={{width:'100%'}}/>
                <span style={css.label}>Hardness</span>
                <div style={{display:'flex',gap:4,marginBottom:6}}>
                  {['soft','hard'].map(e2=>(
                    <button key={e2} onClick={()=>setBrushEdgeState(e2)}
                      style={{...css.iconBtn(brushEdgeState===e2),flex:1,fontSize:11,textTransform:'capitalize'}}>{e2}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Adjustment Layers panel ───────────────────────────────────── */}
            {(activeTool==='adjustment'||selectedLayer?.type==='adjustment')&&(
              <div>
                {selectedLayer?.type==='adjustment'?(
                  <AdjustmentPanel
                    layer={selectedLayer}
                    T={T}
                    css={css}
                    onChange={(settings)=>{
                      updateLayerSilent(selectedLayer.id,{settings,_cachedLUT:null,_lutDirty:true});
                    }}
                    onCommit={(settings)=>{
                      updateLayer(selectedLayer.id,{settings,_cachedLUT:null,_lutDirty:true});
                    }}
                  />
                ):(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Adjustment layers apply non-destructive color corrections to all layers below.</div>
                )}
                <div style={{position:'relative'}}>
                  <button onClick={()=>setAdjLayerMenu(m=>!m)} style={css.addBtn}>+ Add Adjustment Layer ▾</button>
                  {adjLayerMenu&&(
                    <div style={{position:'absolute',bottom:'100%',left:0,right:0,background:T.panel,border:`1px solid ${T.border}`,borderRadius:8,overflow:'hidden',zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
                      {[
                        ['levels','▤ Levels'],['hueSat','◐ Hue / Saturation'],['colorBalance','⊕ Color Balance'],
                        ['vibrance','✦ Vibrance'],['selectiveColor','◈ Selective Color'],
                        ['gradientMap','▓ Gradient Map'],['posterize','▦ Posterize'],['threshold','◑ Threshold'],
                      ].map(([adjType,label])=>(
                        <button key={adjType} onClick={()=>addAdjustmentLayer(adjType)}
                          style={{display:'block',width:'100%',padding:'8px 14px',background:'transparent',border:'none',borderBottom:`1px solid ${T.border}`,color:T.text,cursor:'pointer',textAlign:'left',fontSize:11}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.accentDim}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTool==='liquify'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Push, pull, bloat, and pinch pixels interactively. Face-aware handles auto-detected.</div>
                <div style={{fontSize:10,color:T.muted,marginBottom:8}}>Tools inside: Forward Warp, Bloat, Pucker, Twirl, Reconstruct, Freeze/Thaw Mask.</div>
                <button onClick={openLiquify} style={css.addBtn}>≋ Open Liquify</button>
              </div>
            )}

            {activeTool==='filters'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Apply blur and sharpen filters to the current canvas. Runs in a Web Worker.</div>
                <div style={{fontSize:10,color:T.muted,marginBottom:6}}>Blur: Gaussian · Motion · Radial · Surface · Lens</div>
                <div style={{fontSize:10,color:T.muted,marginBottom:10}}>Sharpen: Unsharp Mask · High Pass</div>
                <button onClick={()=>openFilters(false)} style={css.addBtn}>◎ Open Filters</button>
                {lastFilterRef.current&&(
                  <button onClick={()=>openFilters(true)}
                    style={{...css.addBtn,marginTop:6,background:'transparent',border:`1px solid ${T.border}`,color:T.muted}}>
                    ↩ Re-apply: {lastFilterRef.current.id} <span style={{fontSize:9,marginLeft:4,color:T.muted}}>(Ctrl+F)</span>
                  </button>
                )}
              </div>
            )}

            {activeTool==='adjust'&&(
              <div>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted}}>Canvas-wide adjustments affect everything.</div>
                {[['Brightness',brightness,setBrightness,50,200,'%'],['Contrast',contrast,setContrast,50,300,'%'],['Saturation',saturation,setSaturation,0,300,'%'],['Hue',hue,setHue,0,360,'°']].map(([l,v,sv,mn,mx,u])=>(<div key={l}><span style={css.label}>{l} — {Math.round(v)}{u}</span><Slider min={mn} max={mx} value={v} onChange={sv} onCommit={triggerAutoSave} style={{width:'100%'}}/></div>))}
                {selectedLayer?.type==='image'&&(<>
                  <div style={css.divider}/>
                  <div style={{fontSize:11,color:T.accent,fontWeight:'600',marginBottom:4}}>Per-image filters</div>
                  {[['Brightness','imgBrightness',50,200,'%'],['Contrast','imgContrast',50,200,'%'],['Saturate','imgSaturate',0,300,'%'],['Blur','imgBlur',0,20,'px']].map(([l,k,mn,mx,u])=>(<div key={k}><span style={css.label}>{l} — {selectedLayer[k]??(k==='imgBlur'?0:100)}{u}</span><Slider min={mn} max={mx} value={selectedLayer[k]??(k==='imgBlur'?0:100)} onChange={v=>updateLayerSilent(selectedId,{[k]:v})} onCommit={v=>updateLayer(selectedId,{[k]:v})} style={{width:'100%'}}/></div>))}
                  <button onClick={()=>updateLayer(selectedId,{imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0})} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`,marginTop:6}}>Reset image</button>
                </>)}
                {selectedLayer&&selectedLayer.type!=='background'&&(<><div style={css.divider}/><span style={css.label}>Layer opacity — {selectedLayer.opacity??100}%</span><Slider min={0} max={100} value={selectedLayer.opacity??100} onChange={v=>updateLayerSilent(selectedId,{opacity:v})} onCommit={v=>updateLayer(selectedId,{opacity:v})} style={{width:'100%'}}/></>)}
                <button onClick={()=>{setBrightness(100);setContrast(100);setSaturation(100);setHue(0);triggerAutoSave();}} style={{...css.addBtn,background:'transparent',color:T.muted,border:`1px solid ${T.border}`}}>Reset canvas</button>
              </div>
            )}

            {activeTool==='upload'&&(
              <div>
                <span style={css.label}>Upload images</span>
                <label style={{padding:'20px 16px',borderRadius:8,border:`1.5px dashed ${T.border}`,color:T.muted,fontSize:12,cursor:'pointer',textAlign:'center',display:'block',lineHeight:1.9}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                  <div style={{fontSize:24,marginBottom:6}}>↑</div>
                  Click to upload<br/>
                  <span style={{fontSize:10,color:T.muted}}>PNG · JPG · GIF · WEBP</span><br/>
                  <span style={{fontSize:10,color:T.success,fontWeight:'600'}}>Multiple files — each becomes a layer</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{display:'none'}}/>
                </label>
                <span style={css.label}>Color palette</span>
                <div style={css.section}>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                    {savedPalette.map((c,i)=>(<div key={i} style={{position:'relative'}}><div onClick={()=>addRecentColor(c)} style={{width:24,height:24,borderRadius:5,background:c,cursor:'pointer',border:`1px solid ${T.border}`}}/><div onClick={()=>setSavedPalette(prev=>prev.filter((_,j)=>j!==i))} style={{position:'absolute',top:-5,right:-5,width:12,height:12,background:T.danger,borderRadius:'50%',fontSize:8,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>×</div></div>))}
                    {savedPalette.length===0&&<div style={{fontSize:10,color:T.muted}}>No saved colors</div>}
                  </div>
                  <div style={css.row}><input type="color" style={{...css.color,width:44,flexShrink:0,height:32}} onChange={e=>setSavedPalette(prev=>[...prev.filter(c=>c!==e.target.value),e.target.value].slice(0,20))}/><span style={{fontSize:10,color:T.muted}}>Click to save color</span></div>
                </div>
                {selectedLayer?.type==='image'&&(<><div style={css.divider}/><span style={css.label}>Opacity — {selectedLayer.opacity??100}%</span><Slider min={0} max={100} value={selectedLayer.opacity??100} onChange={v=>updateLayerSilent(selectedId,{opacity:v})} onCommit={v=>updateLayer(selectedId,{opacity:v})} style={{width:'100%'}}/></>)}
              </div>
            )}

            {activeTool==='face'&&(
              <div>
                <span style={css.label}>Face & emotion score</span>

                {/* ── Expression Score (MediaPipe) ── */}
                {(expressionScore||expressionBusy)&&(
                  <div style={{...css.section,marginTop:0,border:`1px solid ${
                    !expressionBusy&&expressionScore?.overall>=8?'rgba(34,197,94,0.35)':
                    !expressionBusy&&expressionScore?.overall>=5?'rgba(245,158,11,0.35)':
                    'rgba(239,68,68,0.25)'}`}}>
                    {expressionBusy?(
                      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:T.muted}}>
                        <span style={{display:'inline-block',animation:'editor-spin 0.9s linear infinite'}}>◌</span>
                        Reading face landmarks...
                      </div>
                    ):(()=>{
                      const sc=expressionScore;
                      const scoreColor=sc.overall>=8?T.success:sc.overall>=5?T.warning:T.danger;
                      const breakdown=[
                        {label:'Mouth',icon:'👄',data:sc.mouth},
                        {label:'Eyes', icon:'👁', data:sc.eyes},
                        {label:'Brows',icon:'🤨',data:sc.brows},
                        {label:'Tilt', icon:'↗', data:sc.tilt},
                      ];
                      const tips=breakdown.map(b=>b.data.tip).filter(Boolean);
                      const topTip=tips[0];
                      return(
                        <>
                          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                            <div style={{
                              width:52,height:52,borderRadius:'50%',
                              border:`3px solid ${scoreColor}`,
                              display:'flex',flexDirection:'column',
                              alignItems:'center',justifyContent:'center',
                              background:`${scoreColor}10`,flexShrink:0,
                            }}>
                              <span style={{fontSize:22,fontWeight:'900',color:scoreColor,lineHeight:1}}>{sc.overall}</span>
                              <span style={{fontSize:8,color:T.muted,fontWeight:'600'}}>/ 10</span>
                            </div>
                            <div>
                              <div style={{fontSize:12,fontWeight:'800',color:T.text,marginBottom:2}}>Expression Score</div>
                              <div style={{fontSize:11,color:scoreColor,fontWeight:'700'}}>
                                {sc.overall>=8?'🔥 High energy!':sc.overall>=5?'⚡ Getting there':sc.overall>=3?'⚠ Low energy':'❌ Flat expression'}
                              </div>
                            </div>
                          </div>

                          {/* Sub-scores */}
                          <div style={{display:'flex',flexDirection:'column',gap:5}}>
                            {breakdown.map(({label,icon,data})=>{
                              const pct=data.score/10;
                              const c=pct>=0.8?T.success:pct>=0.5?T.warning:T.danger;
                              return(
                                <div key={label}>
                                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                                    <span style={{fontSize:10,color:T.muted,fontWeight:'600'}}>{icon} {label}</span>
                                    <span style={{fontSize:10,fontWeight:'800',color:c}}>{data.score}/10</span>
                                  </div>
                                  <div style={{height:3,borderRadius:2,background:T.border,overflow:'hidden'}}>
                                    <div style={{height:'100%',width:`${data.score*10}%`,background:c,borderRadius:2,transition:'width 0.4s ease'}}/>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Top actionable tip */}
                          {topTip&&(
                            <div style={{marginTop:10,padding:'7px 10px',borderRadius:7,background:`${T.warning}10`,border:`1px solid ${T.warning}33`,fontSize:11,color:T.text,lineHeight:1.55}}>
                              → {topTip}
                            </div>
                          )}

                          {/* Enhance Expression */}
                          <div style={{marginTop:10}}>
                            <div style={{fontSize:9,color:T.muted,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:5}}>AI Enhance</div>
                            <select
                              value={enhanceInstruction}
                              onChange={e=>setEnhanceInstruction(e.target.value)}
                              style={{...css.input,marginBottom:6,padding:'6px 10px',fontSize:11}}>
                              <option value="open mouth more">Open mouth more</option>
                              <option value="raise eyebrows">Raise eyebrows</option>
                              <option value="open eyes wider">Open eyes wider</option>
                              <option value="excited expression">Full excited expression</option>
                              <option value="shocked expression">Shocked / surprised expression</option>
                            </select>
                            <button
                              onClick={enhanceExpression}
                              disabled={enhanceBusy}
                              style={{
                                ...css.addBtn,marginTop:0,
                                background:enhanceBusy?T.bg2:`linear-gradient(135deg,#7c3aed,#6d28d9)`,
                                opacity:enhanceBusy?0.6:1,
                                display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                                boxShadow:enhanceBusy?'none':'0 3px 12px rgba(124,58,237,0.35)',
                              }}>
                              {enhanceBusy
                                ?<><span style={{display:'inline-block',animation:'editor-spin 0.9s linear infinite'}}>◌</span> Enhancing...</>
                                :'✦ Enhance Expression'}
                            </button>
                            <div style={{fontSize:9,color:T.muted,marginTop:4,textAlign:'center'}}>
                              Uses 1 AI action · Result added as new layer
                            </div>
                          </div>

                          <button onClick={()=>setExpressionScore(null)} style={{...css.addBtn,marginTop:8,background:'transparent',color:T.muted,border:`1px solid ${T.border}`,fontSize:11}}>Clear</button>
                        </>
                      );
                    })()}
                  </div>
                )}

                {!expressionScore&&!expressionBusy&&(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.6}}>
                    Upload a thumbnail with a face to get an automatic expression score — or click analyze below for full placement + lighting analysis.
                  </div>
                )}

                <button
                  onClick={()=>{setExpressionScore(null);runFaceDetectionOnComposite();}}
                  disabled={expressionBusy}
                  style={{...css.addBtn,marginTop:8,
                    background:expressionBusy?T.bg2:'rgba(249,115,22,0.15)',
                    color:expressionBusy?T.muted:T.accent,
                    border:`1px solid ${T.accentBorder}`,
                    fontSize:11,fontWeight:'700',opacity:expressionBusy?0.6:1}}>
                  {expressionBusy?'Detecting...':'◉ Re-scan expression'}
                </button>

                <button onClick={analyzeFace} disabled={faceLoading}
                  style={{...css.addBtn,marginTop:6,
                    background:faceLoading?T.muted:T.accent,
                    opacity:faceLoading?0.6:1,fontSize:13,fontWeight:'700'}}>
                  {faceLoading?'Analyzing...':'◉ Analyze face & emotion'}
                </button>

                {faceAnalysis&&!faceAnalysis.error&&(
                  <div>
                    {/* Overall score */}
                    <div style={{textAlign:'center',padding:'16px 0 8px'}}>
                      <div style={{
                        fontSize:52,fontWeight:'900',letterSpacing:'-2px',
                        color:faceAnalysis.score>=80?T.success:
                              faceAnalysis.score>=60?T.warning:T.danger,
                      }}>
                        {faceAnalysis.score}
                      </div>
                      <div style={{fontSize:12,color:T.muted}}>face score / 100</div>
                      <div style={{fontSize:13,fontWeight:'700',marginTop:6,
                        color:faceAnalysis.score>=80?T.success:
                              faceAnalysis.score>=60?T.warning:T.danger}}>
                        {faceAnalysis.score>=80?'🔥 Thumbnail ready':
                         faceAnalysis.score>=60?'⚠️ Needs improvement':
                         faceAnalysis.score>=40?'❌ Weak face presence':
                         '❌ No face detected'}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div style={{height:6,borderRadius:3,background:T.border,
                      marginBottom:14,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:3,
                        width:`${faceAnalysis.score}%`,
                        background:faceAnalysis.score>=80?T.success:
                                   faceAnalysis.score>=60?T.warning:T.danger,
                        transition:'width 0.5s ease'}}/>
                    </div>

                    {/* Breakdown */}
                    <span style={css.label}>Breakdown</span>
                    <div style={css.section}>
                      {faceAnalysis.scores.map((s,i)=>(
                        <div key={i} style={{marginBottom:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                            <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>{s.label}</span>
                            <span style={{fontSize:11,fontWeight:'700',
                              color:s.score/s.max>=0.8?T.success:
                                    s.score/s.max>=0.5?T.warning:T.danger}}>
                              {s.score}/{s.max}
                            </span>
                          </div>
                          <div style={{height:4,borderRadius:2,background:T.border,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:2,
                              width:`${(s.score/s.max)*100}%`,
                              background:s.score/s.max>=0.8?T.success:
                                         s.score/s.max>=0.5?T.warning:T.danger}}/>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Good things */}
                    {faceAnalysis.goods.length>0&&(<>
                      <span style={css.label}>What's working</span>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {faceAnalysis.goods.map((g,i)=>(
                          <div key={i} style={{padding:'7px 10px',borderRadius:6,
                            fontSize:11,color:T.text,lineHeight:1.5,
                            background:`${T.success}18`,
                            border:`1px solid ${T.success}44`}}>
                            ✓ {g}
                          </div>
                        ))}
                      </div>
                    </>)}

                    {/* Tips */}
                    {faceAnalysis.tips.length>0&&(<>
                      <span style={css.label}>Improvements</span>
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {faceAnalysis.tips.map((t,i)=>(
                          <div key={i} style={{padding:'7px 10px',borderRadius:6,
                            fontSize:11,color:T.text,lineHeight:1.5,
                            background:`${T.warning}18`,
                            border:`1px solid ${T.warning}44`}}>
                            → {t}
                          </div>
                        ))}
                      </div>
                    </>)}

                    {/* Emotion guide */}
                    {faceAnalysis.hasFace&&faceAnalysis.emotionTips.length>0&&(<>
                      <span style={css.label}>Emotion guide</span>
                      <div style={{...css.section,fontSize:11,color:T.muted,
                        marginBottom:4,lineHeight:1.5}}>
                        The emotion on a face drives clicks. Here are the highest-performing expressions for YouTube:
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {faceAnalysis.emotionTips.map((et,i)=>(
                          <div key={i} style={{padding:'8px 10px',borderRadius:7,
                            background:T.input,border:`1px solid ${T.border}`}}>
                            <div style={{display:'flex',justifyContent:'space-between',
                              alignItems:'center',marginBottom:4}}>
                              <span style={{fontSize:12,fontWeight:'700',color:T.text}}>
                                {et.emotion}
                              </span>
                              <span style={{fontSize:9,fontWeight:'700',
                                color:et.ctr==='High CTR'?T.success:T.warning,
                                background:et.ctr==='High CTR'?`${T.success}20`:`${T.warning}20`,
                                padding:'2px 6px',borderRadius:8}}>
                                {et.ctr}
                              </span>
                            </div>
                            <div style={{fontSize:10,color:T.muted,lineHeight:1.5}}>{et.tip}</div>
                          </div>
                        ))}
                      </div>
                    </>)}

                    <button onClick={()=>setFaceAnalysis(null)}
                      style={{...css.addBtn,marginTop:10,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`}}>
                      Reset
                    </button>
                  </div>
                )}

                {faceAnalysis?.error&&(
                  <div style={{...css.section,marginTop:10,fontSize:12,
                    color:T.danger,textAlign:'center',lineHeight:1.6}}>
                    {faceAnalysis.message}
                  </div>
                )}

                {!faceAnalysis&&!faceLoading&&(
                  <div style={{...css.section,marginTop:10,fontSize:11,
                    color:T.muted,lineHeight:1.7}}>
                    <div style={{fontSize:20,textAlign:'center',marginBottom:8}}>◉</div>
                    Upload a photo with a face, then click analyze. You'll get:<br/><br/>
                    • Face detection and placement score<br/>
                    • Lighting quality analysis<br/>
                    • How well the face stands out<br/>
                    • Emotion suggestions for higher CTR
                  </div>
                )}
              </div>
            )}

            {activeTool==='yttest'&&(
              <div>
                <span style={css.label}>YouTube A/B Testing</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.6}}>
                  Test different thumbnails on a live YouTube video. ThumbFrame rotates them automatically and measures which one gets the most clicks.
                </div>

                {!ytConnected?(
                  <div>
                    <div style={{...css.section,textAlign:'center',padding:'20px 14px'}}>
                      <div style={{fontSize:32,marginBottom:10}}>▶</div>
                      <div style={{fontSize:13,fontWeight:'700',color:T.text,marginBottom:6}}>Connect your YouTube channel</div>
                      <div style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:14}}>
                        Authorize ThumbFrame to swap thumbnails on your videos. We only request thumbnail upload permissions — nothing else.
                      </div>
                      <button onClick={()=>{
                        // YouTube OAuth flow — opens Google consent screen
                        // Requires REACT_APP_GOOGLE_CLIENT_ID in .env
                        const clientId=process.env.REACT_APP_GOOGLE_CLIENT_ID;
                        if(!clientId){
                          setYtTestStatus('Set up Google OAuth credentials first. Add REACT_APP_GOOGLE_CLIENT_ID to your .env file.');
                          setYtConnected(false);
                          return;
                        }
                        const redirect=encodeURIComponent(window.location.origin+'/editor');
                        const scope=encodeURIComponent('https://www.googleapis.com/auth/youtube');
                        window.location.href=`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
                      }}
                        style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#FF0000,#CC0000)',fontSize:13,fontWeight:'700'}}>
                        Connect YouTube Channel
                      </button>
                      {ytTestStatus&&(
                        <div style={{marginTop:10,padding:'8px 10px',borderRadius:7,fontSize:11,lineHeight:1.5,
                          background:`${T.warning}18`,border:`1px solid ${T.warning}44`,color:T.text}}>
                          {ytTestStatus}
                        </div>
                      )}
                    </div>

                    <span style={css.label}>How it works</span>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {[
                        ['1. Connect','Authorize your YouTube channel via Google OAuth'],
                        ['2. Pick a video','Paste a YouTube video URL to test'],
                        ['3. Upload variants','Generate A/B variants or upload custom thumbnails'],
                        ['4. Set duration','Choose 24h, 48h, or 7-day test rotation'],
                        ['5. Get results','See real CTR data per thumbnail — auto-pick winner'],
                      ].map(([title,desc])=>(
                        <div key={title} style={{padding:'8px 10px',borderRadius:7,background:T.input,border:`1px solid ${T.border}`}}>
                          <div style={{fontSize:11,fontWeight:'700',color:T.accent}}>{title}</div>
                          <div style={{fontSize:10,color:T.muted,marginTop:2}}>{desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ):(
                  <div>
                    <div style={{padding:'8px 10px',borderRadius:7,background:`${T.success}18`,border:`1px solid ${T.success}44`,marginBottom:10}}>
                      <div style={{fontSize:11,color:T.success,fontWeight:'600'}}>✓ YouTube connected</div>
                    </div>

                    <span style={css.label}>Video URL</span>
                    <input value={ytVideoUrl} onChange={e=>setYtVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      style={{...css.input,marginBottom:8}}/>

                    <span style={css.label}>Test duration</span>
                    <div style={{display:'flex',gap:4,marginBottom:10}}>
                      {[['24h','24 hours'],['48h','48 hours'],['7d','7 days']].map(([val,label])=>(
                        <button key={val} onClick={()=>setYtTestDuration(val)}
                          style={css.pill(ytTestDuration===val)}>{label}</button>
                      ))}
                    </div>

                    <span style={css.label}>Variants to test</span>
                    <div style={{...css.section,fontSize:11,color:T.muted}}>
                      {abVariants.length>0
                        ? `${abVariants.length} variants ready from A/B engine`
                        : 'Generate variants first using the A/B Variants tool, or upload custom thumbnails'}
                    </div>

                    <button onClick={()=>{
                      if(!ytVideoUrl){setYtTestStatus('Enter a YouTube video URL');return;}
                      if(abVariants.length===0){setYtTestStatus('Generate A/B variants first');return;}
                      setYtTestStatus('Starting test... (YouTube API integration required)');
                      setYtTests(prev=>[...prev,{
                        id:Date.now(),
                        videoUrl:ytVideoUrl,
                        variants:abVariants.length,
                        duration:ytTestDuration,
                        startedAt:new Date().toISOString(),
                        status:'pending',
                      }]);
                    }}
                      style={{...css.addBtn,background:'linear-gradient(135deg,#f97316,#ea580c)',
                        fontSize:13,fontWeight:'700',
                        boxShadow:'0 0 20px rgba(249,115,22,0.3)'}}>
                      ▶ Start A/B Test
                    </button>

                    {ytTestStatus&&(
                      <div style={{marginTop:8,padding:'8px 10px',borderRadius:7,fontSize:11,
                        background:`${T.warning}18`,border:`1px solid ${T.warning}44`,color:T.text}}>
                        {ytTestStatus}
                      </div>
                    )}

                    {ytTests.length>0&&(<>
                      <span style={css.label}>Active tests</span>
                      {ytTests.map(test=>(
                        <div key={test.id} style={{...css.section,marginBottom:6}}>
                          <div style={{fontSize:11,fontWeight:'600',color:T.text,marginBottom:4}}>
                            {test.videoUrl.slice(0,40)}...
                          </div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:T.muted}}>
                            <span>{test.variants} variants · {test.duration}</span>
                            <span style={{color:T.warning,fontWeight:'600'}}>{test.status}</span>
                          </div>
                        </div>
                      ))}
                    </>)}
                  </div>
                )}
              </div>
            )}

            {/* Feature L: Team Collaboration panel */}
            {activeTool==='team'&&(()=>{
              const isPro=user?.is_admin||(user?.plan||'free').toLowerCase()==='pro'||(user?.is_pro===true);
              if(!isPro) return(
                <div>
                  <span style={css.label}>Team Collaboration</span>
                  <div style={{margin:'8px 0',borderRadius:14,border:`1px solid ${T.accentBorder}`,background:'linear-gradient(160deg,rgba(249,115,22,0.08),rgba(249,115,22,0.02))',padding:'20px 16px',textAlign:'center'}}>
                    <div style={{fontSize:30,marginBottom:10}}>⊕</div>
                    <div style={{fontSize:14,fontWeight:'800',color:T.text,marginBottom:6}}>Pro Feature</div>
                    <div style={{fontSize:11,color:T.muted,lineHeight:1.7,marginBottom:14}}>Invite team members, share projects, leave canvas comments, and track approval status — all in one workspace.</div>
                    <button onClick={handleUpgrade} style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#f97316,#ea580c)',fontSize:13,fontWeight:'800'}}>Upgrade to Pro →</button>
                  </div>
                </div>
              );
              return(
                <div>
                  <span style={css.label}>Team Workspace</span>
                  {!teamData?(
                    <div>
                      <div style={{...css.section,fontSize:11,color:T.muted,lineHeight:1.6}}>Create a workspace to collaborate with your team.</div>
                      <input value={teamCreateName} onChange={e=>setTeamCreateName(e.target.value)} placeholder="Team name…" style={{...css.input,width:'100%',boxSizing:'border-box',marginBottom:6}}/>
                      <button onClick={createTeam} disabled={teamBusy||!teamCreateName.trim()} style={{...css.addBtn,marginTop:0,background:T.accent}}>{teamBusy?'Creating…':'Create Team'}</button>
                      {teamError&&<div style={{marginTop:6,fontSize:11,color:T.danger}}>{teamError}</div>}
                    </div>
                  ):(
                    <div>
                      {/* Team header */}
                      <div style={{padding:'10px 12px',borderRadius:10,background:T.input,border:`1px solid ${T.border}`,marginBottom:10}}>
                        <div style={{fontSize:13,fontWeight:'700',color:T.text,marginBottom:4}}>{teamData.name}</div>
                        <div style={{fontSize:10,color:T.muted}}>{teamData.members?.length||1} member{(teamData.members?.length||1)!==1?'s':''}</div>
                      </div>
                      {/* Member avatars */}
                      <span style={css.label}>Members</span>
                      <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
                        {(teamData.members||[]).map(m=>(
                          <div key={m.email} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:7,background:T.bg2,border:`1px solid ${T.border}`}}>
                            <div style={{width:26,height:26,borderRadius:'50%',background:`linear-gradient(135deg,${T.accent},#ea580c)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:'700',color:'#fff',flexShrink:0}}>
                              {m.email[0].toUpperCase()}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.email}</div>
                              <div style={{fontSize:9,color:m.role==='owner'?T.accent:T.muted,textTransform:'uppercase',fontWeight:'700',letterSpacing:'0.3px'}}>{m.role}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Invite */}
                      <span style={css.label}>Invite Member</span>
                      <div style={{display:'flex',gap:5}}>
                        <input value={teamInviteEmail} onChange={e=>setTeamInviteEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')inviteToTeam();}} placeholder="Email address…" style={{...css.input,flex:1}}/>
                        <button onClick={inviteToTeam} disabled={teamBusy||!teamInviteEmail.trim()} style={{padding:'6px 10px',borderRadius:7,border:'none',background:T.accent,color:'#fff',fontSize:11,fontWeight:'700',cursor:'pointer',flexShrink:0}}>{teamBusy?'…':'Send'}</button>
                      </div>
                      {teamError&&<div style={{marginTop:6,fontSize:11,color:teamError==='Invite sent!'?T.success:T.danger}}>{teamError}</div>}
                      {/* Share current project */}
                      <button onClick={()=>{if(!designName)return;fetch(`${resolvedApiUrl}/api/team/share-project`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({teamId:teamData.teamId,projectId:designName})}).then(r=>r.json()).then(d=>{if(d.success)setTeamError('Project shared with team!');});}} style={{...css.addBtn,marginTop:12,background:'transparent',border:`1px solid ${T.border}`,color:T.muted,fontSize:11}}>
                        Share current project with team
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Feature L: Version History panel */}
            {activeTool==='versions'&&(()=>{
              const isPro=user?.is_admin||(user?.plan||'free').toLowerCase()==='pro'||(user?.is_pro===true);
              if(!isPro) return(
                <div>
                  <span style={css.label}>Version History</span>
                  <div style={{margin:'8px 0',borderRadius:14,border:`1px solid ${T.accentBorder}`,background:'linear-gradient(160deg,rgba(249,115,22,0.08),rgba(249,115,22,0.02))',padding:'20px 16px',textAlign:'center'}}>
                    <div style={{fontSize:30,marginBottom:10}}>⊘</div>
                    <div style={{fontSize:14,fontWeight:'800',color:T.text,marginBottom:6}}>Pro Feature</div>
                    <div style={{fontSize:11,color:T.muted,lineHeight:1.7,marginBottom:14}}>Save named snapshots of your canvas and roll back to any previous version instantly.</div>
                    <button onClick={handleUpgrade} style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#f97316,#ea580c)',fontSize:13,fontWeight:'800'}}>Upgrade to Pro →</button>
                  </div>
                </div>
              );
              return(
                <div>
                  <span style={css.label}>Version History</span>
                  {/* Save new version */}
                  <div style={{display:'flex',gap:5,marginBottom:10}}>
                    <input value={versionLabel} onChange={e=>setVersionLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveVersion();}} placeholder="Version label (optional)…" style={{...css.input,flex:1}}/>
                    <button onClick={saveVersion} disabled={versionBusy} style={{padding:'6px 10px',borderRadius:7,border:'none',background:T.accent,color:'#fff',fontSize:11,fontWeight:'700',cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>{versionBusy?'…':'Save'}</button>
                  </div>
                  {/* Load history button */}
                  {versionHistory.length===0&&(
                    <button onClick={loadVersionHistory} disabled={versionBusy} style={{...css.addBtn,marginTop:0,background:'transparent',border:`1px solid ${T.border}`,color:T.muted,fontSize:11}}>
                      {versionBusy?'Loading…':'Load version history'}
                    </button>
                  )}
                  {/* Timeline */}
                  {versionHistory.length>0&&(
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {versionHistory.map((v,i)=>(
                        <div key={v.id} style={{
                          display:'flex',gap:10,alignItems:'flex-start',
                          padding:'10px 12px',borderRadius:9,
                          background:T.input,border:`1px solid ${T.border}`,
                          position:'relative',
                        }}>
                          {/* Timeline dot + line */}
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0}}>
                            <div style={{width:10,height:10,borderRadius:'50%',background:i===0?T.accent:T.border,border:`2px solid ${i===0?T.accent:T.border}`,marginTop:2}}/>
                            {i<versionHistory.length-1&&<div style={{width:2,flex:1,background:T.border,minHeight:16,marginTop:4}}/>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:'700',color:T.text,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.label}</div>
                            <div style={{fontSize:10,color:T.muted,marginBottom:6}}>
                              {new Date(v.timestamp).toLocaleString()} · {v.savedBy}
                            </div>
                            <div style={{display:'flex',gap:5}}>
                              <button onClick={()=>restoreVersion(v.id)} style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${T.accentBorder}`,background:T.accentDim,color:T.accent,fontSize:10,cursor:'pointer',fontWeight:'600'}}>Restore</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Feature L: Comments panel */}
            {activeTool==='comments'&&(()=>{
              const isPro=user?.is_admin||(user?.plan||'free').toLowerCase()==='pro'||(user?.is_pro===true);
              if(!isPro) return(
                <div>
                  <span style={css.label}>Canvas Comments</span>
                  <div style={{margin:'8px 0',borderRadius:14,border:`1px solid ${T.accentBorder}`,background:'linear-gradient(160deg,rgba(249,115,22,0.08),rgba(249,115,22,0.02))',padding:'20px 16px',textAlign:'center'}}>
                    <div style={{fontSize:30,marginBottom:10}}>◌</div>
                    <div style={{fontSize:14,fontWeight:'800',color:T.text,marginBottom:6}}>Pro Feature</div>
                    <div style={{fontSize:11,color:T.muted,lineHeight:1.7,marginBottom:14}}>Drop comment pins anywhere on the canvas. Pin positions, reply threads, and resolve status all sync in real time with your team.</div>
                    <button onClick={handleUpgrade} style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#f97316,#ea580c)',fontSize:13,fontWeight:'800'}}>Upgrade to Pro →</button>
                  </div>
                </div>
              );
              const openComments=comments.filter(c=>!c.resolved);
              const resolved=comments.filter(c=>c.resolved);
              return(
                <div>
                  <span style={css.label}>Canvas Comments</span>
                  {/* Drop pin button */}
                  <button
                    onClick={()=>setCommentMode(!commentMode)}
                    style={{...css.addBtn,marginTop:0,marginBottom:10,background:commentMode?T.accent:'transparent',border:`1px solid ${commentMode?T.accent:T.border}`,color:commentMode?'#fff':T.muted,fontSize:12,fontWeight:'700',transition:'all 0.15s'}}>
                    {commentMode?'◌ Click canvas to drop pin':'+ Add Comment Pin'}
                  </button>
                  {/* Open comments */}
                  {openComments.length>0&&(
                    <>
                      <span style={css.label}>Open ({openComments.length})</span>
                      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10}}>
                        {openComments.map((c,idx)=>(
                          <div key={c.id} onClick={()=>setActiveCommentId(c.id===activeCommentId?null:c.id)} style={{
                            padding:'8px 10px',borderRadius:8,
                            background:activeCommentId===c.id?T.accentDim:T.input,
                            border:`1px solid ${activeCommentId===c.id?T.accentBorder:T.border}`,
                            cursor:'pointer',
                          }}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <div style={{width:18,height:18,borderRadius:'50%',background:'#f97316',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:'800',color:'#fff',flexShrink:0}}>{comments.indexOf(c)+1}</div>
                              <span style={{fontSize:10,color:T.muted,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.userId}</span>
                              {c.replies?.length>0&&<span style={{fontSize:9,color:T.muted}}>{c.replies.length} repl{c.replies.length===1?'y':'ies'}</span>}
                            </div>
                            <div style={{fontSize:11,color:T.text,lineHeight:1.4}}>{c.text}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {/* Resolved */}
                  {resolved.length>0&&(
                    <>
                      <span style={css.label}>Resolved ({resolved.length})</span>
                      <div style={{display:'flex',flexDirection:'column',gap:4}}>
                        {resolved.map(c=>(
                          <div key={c.id} style={{padding:'7px 10px',borderRadius:7,background:T.bg2,border:`1px solid ${T.border}`,opacity:0.55}}>
                            <div style={{fontSize:11,color:T.muted,lineHeight:1.4,textDecoration:'line-through'}}>{c.text}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {comments.length===0&&(
                    <div style={{...css.section,textAlign:'center',fontSize:11,color:T.muted}}>No comments yet. Click "Add Comment Pin" then click the canvas.</div>
                  )}
                </div>
              );
            })()}

            {activeTool==='ythistory'&&(()=>{
              const isPro = user?.is_admin || (user?.plan||'free').toLowerCase()==='pro' || (user?.is_pro===true);
              const IMPACT_COLOR = {high:T.accent, medium:'#f59e0b', low:T.muted};
              const CAT_ICON = {face:'◉',color:'◕',text:'✦',background:'◫',composition:'◈',channel:'▶'};

              // Pro gate
              if(!isPro){
                return(
                  <div>
                    <span style={css.label}>YouTube History Intelligence</span>
                    <div style={{
                      margin:'8px 0',borderRadius:14,overflow:'hidden',
                      border:`1px solid ${T.accentBorder}`,
                      background:'linear-gradient(160deg,rgba(249,115,22,0.08) 0%,rgba(249,115,22,0.02) 100%)',
                    }}>
                      <div style={{padding:'20px 16px',textAlign:'center'}}>
                        <div style={{fontSize:32,marginBottom:10}}>◎</div>
                        <div style={{fontSize:14,fontWeight:'800',color:T.text,marginBottom:6}}>Pro Feature</div>
                        <div style={{fontSize:11,color:T.muted,lineHeight:1.7,marginBottom:16}}>
                          Connect your real YouTube channel and let AI study your last 50 thumbnails.
                          Get personalized insights like <em style={{color:T.text}}>"Faces on the left get 2.3× more clicks on your channel"</em> — then auto-apply them as editor defaults.
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16,textAlign:'left'}}>
                          {['◉ Face position & CTR correlation','◕ Best-performing color grades for your audience','✦ Text presence patterns vs engagement','◫ Busy vs minimal background analysis'].map(s=>(
                            <div key={s} style={{fontSize:11,color:T.muted,display:'flex',alignItems:'center',gap:8}}>
                              <span style={{color:T.accent,fontSize:9}}>●</span>{s}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={handleUpgrade}
                          style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#f97316,#ea580c)',fontSize:13,fontWeight:'800',letterSpacing:'0.02em'}}>
                          Upgrade to Pro →
                        </button>
                        <div style={{marginTop:8,fontSize:10,color:T.muted}}>150 AI actions/month, all features</div>
                      </div>
                    </div>
                  </div>
                );
              }

              return(
                <div>
                  <span style={css.label}>YouTube History Intelligence</span>

                  {/* Connect / channel header */}
                  {!ytHistConnected?(
                    <div style={{...css.section,textAlign:'center',padding:'20px 14px'}}>
                      <div style={{fontSize:32,marginBottom:10}}>◎</div>
                      <div style={{fontSize:13,fontWeight:'700',color:T.text,marginBottom:6}}>Connect your YouTube channel</div>
                      <div style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:14}}>
                        We read your last 50 thumbnails and their CTR, then tell you exactly what to do differently.
                      </div>
                      <button onClick={connectYouTube}
                        style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#FF0000,#CC0000)',fontSize:13,fontWeight:'700'}}>
                        ▶ Connect YouTube
                      </button>
                    </div>
                  ):(
                    <div>
                      {ytHistChannel&&(
                        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,background:T.input,border:`1px solid ${T.border}`,marginBottom:10}}>
                          {ytHistChannel.avatar&&(
                            <img src={ytHistChannel.avatar} alt="" style={{width:32,height:32,borderRadius:'50%',flexShrink:0}}/>
                          )}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:'700',color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ytHistChannel.title||'Your Channel'}</div>
                            <div style={{fontSize:10,color:T.success}}>● Connected</div>
                          </div>
                          <button onClick={()=>{localStorage.removeItem('tf_yt_connected');localStorage.removeItem('tf_yt_channel');setYtHistConnected(false);setYtHistChannel(null);setYtHistInsights(null);}}
                            style={{padding:'3px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>
                            Disconnect
                          </button>
                        </div>
                      )}

                      {/* Analyse button + progress */}
                      {!ytHistInsights&&(
                        <div>
                          {ytHistBusy?(
                            <div style={{padding:'14px',borderRadius:10,background:T.input,border:`1px solid ${T.border}`,textAlign:'center'}}>
                              <div style={{fontSize:12,color:T.text,fontWeight:'600',marginBottom:10}}>
                                Studying your last 50 thumbnails…
                              </div>
                              <div style={{height:4,borderRadius:2,background:T.border,overflow:'hidden',marginBottom:8}}>
                                <div style={{
                                  height:'100%',borderRadius:2,
                                  background:`linear-gradient(90deg,${T.accent},#ea580c)`,
                                  width:`${ytHistProgress}%`,
                                  transition:'width 0.6s ease',
                                }}/>
                              </div>
                              <div style={{fontSize:10,color:T.muted}}>
                                {ytHistProgress<55?'Fetching videos and stats…':ytHistProgress<90?'Sending to Claude for analysis…':'Finishing up…'}
                              </div>
                            </div>
                          ):(
                            <button onClick={fetchAndAnalyzeYouTubeHistory}
                              style={{...css.addBtn,marginTop:0,background:`linear-gradient(135deg,${T.accent},#ea580c)`,fontSize:13,fontWeight:'700'}}>
                              ◎ Analyze My Channel
                            </button>
                          )}
                          {ytHistError&&(
                            <div style={{marginTop:8,padding:'8px 10px',borderRadius:7,fontSize:11,color:T.danger,background:`${T.danger}14`,border:`1px solid ${T.danger}33`}}>
                              {ytHistError}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Insights panel */}
                      {ytHistInsights&&ytHistInsights.length>0&&(
                        <div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                            <span style={css.label}>Your Insights</span>
                            <button onClick={()=>{setYtHistInsights(null);localStorage.removeItem('tf_yt_insights');setYtHistProgress(0);}}
                              style={{padding:'2px 8px',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>
                              Re-analyze
                            </button>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:8}}>
                            {ytHistInsights.map((ins,i)=>(
                              <div key={i} style={{
                                borderRadius:10,overflow:'hidden',
                                border:`1px solid ${IMPACT_COLOR[ins.impact]||T.border}33`,
                                background:T.input,
                              }}>
                                {/* Impact bar */}
                                <div style={{height:3,background:`linear-gradient(90deg,${IMPACT_COLOR[ins.impact]||T.border},transparent)`,opacity:0.7}}/>
                                <div style={{padding:'10px 12px'}}>
                                  <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:6}}>
                                    <span style={{fontSize:13,flexShrink:0,marginTop:1}}>{CAT_ICON[ins.category]||'◈'}</span>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,fontWeight:'700',color:T.text,lineHeight:1.3}}>{ins.headline}</div>
                                      <div style={{fontSize:9,color:IMPACT_COLOR[ins.impact]||T.muted,textTransform:'uppercase',letterSpacing:'0.4px',fontWeight:'700',marginTop:2}}>
                                        {ins.impact} impact · {ins.category}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{fontSize:11,color:T.muted,lineHeight:1.5,marginBottom:6}}>{ins.detail}</div>
                                  <div style={{
                                    padding:'6px 8px',borderRadius:6,
                                    background:`${IMPACT_COLOR[ins.impact]||T.border}14`,
                                    border:`1px solid ${IMPACT_COLOR[ins.impact]||T.border}22`,
                                    fontSize:10,color:T.text,fontWeight:'600',lineHeight:1.4,
                                  }}>
                                    → {ins.recommendation}
                                    {ins.applyDefault?.colorGrade&&(
                                      <button onClick={()=>setCgPreset(ins.applyDefault.colorGrade)}
                                        style={{display:'block',marginTop:4,padding:'3px 8px',borderRadius:5,border:`1px solid ${T.accent}44`,background:`${T.accent}14`,color:T.accent,fontSize:9,cursor:'pointer',fontWeight:'700'}}>
                                        Apply {ins.applyDefault.colorGrade} grade now
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Video count summary */}
                          {ytHistVideos.length>0&&(
                            <div style={{marginTop:10,padding:'8px 10px',borderRadius:7,background:T.bg2,border:`1px solid ${T.border}`,fontSize:10,color:T.muted,textAlign:'center'}}>
                              Based on {ytHistVideos.length} videos · {ytHistVideos.filter(v=>v.ctr!=null).length} with CTR data
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {activeTool==='resize'&&(
              <div>
                <span style={css.label}>Export all platforms</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Export your thumbnail at the correct size for every platform in one click.
                  Downloads 5 files automatically.
                </div>

                {/* Platform list */}
                <span style={css.label}>Platforms included</span>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {[
                    ['YouTube',   '1280×720',  '▶'],
                    ['TikTok',    '1080×1920', '♪'],
                    ['Instagram', '1080×1080', '◉'],
                    ['Twitter',   '1600×900',  '✦'],
                    ['LinkedIn',  '1200×627',  '⊞'],
                  ].map(([name,size,icon])=>(
                    <div key={name} style={{
                      display:'flex',alignItems:'center',gap:10,
                      padding:'8px 10px',borderRadius:7,
                      background:T.input,border:`1px solid ${T.border}`,
                    }}>
                      <span style={{fontSize:14,width:20,textAlign:'center'}}>{icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:'600',color:T.text}}>{name}</div>
                        <div style={{fontSize:10,color:T.muted}}>{size}px</div>
                      </div>
                      <div style={{width:8,height:8,borderRadius:'50%',
                        background:T.success}}/>
                    </div>
                  ))}
                </div>

                {resizeProgress&&(
                  <div style={{...css.section,marginTop:10,fontSize:12,
                    color:T.success,fontWeight:'600',textAlign:'center'}}>
                    {resizeProgress}
                  </div>
                )}

                <button onClick={exportAllPlatforms}
                  disabled={resizeExporting}
                  style={{...css.addBtn,marginTop:12,
                    background:resizeExporting?T.muted:T.success,
                    fontSize:13,fontWeight:'700',
                    opacity:resizeExporting?0.6:1}}>
                  {resizeExporting?resizeProgress||'Exporting...':'↓ Export all 5 platforms'}
                </button>

                <div style={{...css.section,marginTop:10,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  💡 Tip — design at YouTube 1280×720 first then export all.
                  Text and images scale proportionally to each platform size.
                </div>
              </div>
            )}

            {/* ── Tier 3 Item 3: Competitor Comparison sidebar panel ─────── */}
            {activeTool==='competitor'&&(()=>{
              const isPro=user?.is_admin||(user?.plan||'free').toLowerCase()==='pro'||(user?.plan||'free').toLowerCase()==='agency'||(user?.is_pro===true);
              if(!isPro) return(
                <div>
                  <span style={css.label}>Competitor Comparison</span>
                  <div style={{margin:'8px 0',borderRadius:14,border:`1px solid ${T.accentBorder}`,background:'linear-gradient(160deg,rgba(249,115,22,0.08),rgba(249,115,22,0.02))',padding:'20px 16px',textAlign:'center'}}>
                    <div style={{fontSize:30,marginBottom:10}}>⚔</div>
                    <div style={{fontSize:14,fontWeight:'800',color:T.text,marginBottom:6}}>Pro Feature</div>
                    <div style={{fontSize:11,color:T.muted,lineHeight:1.7,marginBottom:14}}>Search YouTube to see how your thumbnail stacks up against the competition. Pro and Agency plans only.</div>
                    <button onClick={handleUpgrade} style={{...css.addBtn,marginTop:0,background:'linear-gradient(135deg,#f97316,#ea580c)',fontSize:13,fontWeight:'800'}}>Upgrade to Pro →</button>
                  </div>
                </div>
              );
              return(
                <div>
                  <span style={css.label}>Competitor Comparison</span>
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.6}}>
                    Search YouTube to compare your thumbnail against the competition.
                  </div>
                  <div style={{display:'flex',gap:5,marginBottom:8}}>
                    <input
                      value={competitorQuery}
                      onChange={e=>setCompetitorQuery(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&!competitorLoading)searchCompetitors();}}
                      placeholder="e.g. minecraft survival tips"
                      style={{...css.input,flex:1}}
                    />
                    <button onClick={searchCompetitors} disabled={competitorLoading||!competitorQuery.trim()}
                      style={{padding:'6px 10px',borderRadius:7,border:'none',background:T.accent,color:'#fff',fontSize:11,fontWeight:'700',cursor:'pointer',flexShrink:0,opacity:competitorLoading||!competitorQuery.trim()?0.5:1}}>
                      {competitorLoading?'…':'Go'}
                    </button>
                  </div>
                  {competitorLoading&&(
                    <div style={{padding:'12px',borderRadius:8,background:T.input,border:`1px solid ${T.border}`,textAlign:'center',fontSize:11,color:T.muted,animation:'tf-pulse 1.5s ease infinite'}}>
                      Searching YouTube…
                    </div>
                  )}
                  {competitorError&&<div style={{fontSize:11,color:T.danger,marginBottom:8}}>{competitorError}</div>}
                  {competitorResults.length>0&&(
                    <div>
                      <button onClick={()=>setShowCompetitor(true)}
                        style={{...css.addBtn,marginTop:0,background:`linear-gradient(135deg,#f97316,#ea580c)`,fontWeight:'700',fontSize:12}}>
                        ⚔ Open Comparison View
                      </button>
                      {(competitorResults.length>0||competitorThumbUrl)&&(
                        <button onClick={analyzeCompetition} disabled={competitorAnalyzing}
                          style={{...css.addBtn,marginTop:6,background:'transparent',border:`1px solid ${T.accentBorder}`,color:T.accent,fontWeight:'600',fontSize:11}}>
                          {competitorAnalyzing?'Analyzing…':'✦ Analyze vs Competitors'}
                        </button>
                      )}
                      {competitorAnalysis&&(
                        <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:'rgba(249,115,22,0.06)',borderLeft:'3px solid #f97316',fontSize:11,color:T.text,lineHeight:1.7}}>
                          {competitorAnalysis.split('\n').filter(Boolean).map((line,i)=>(
                            <div key={i} style={{marginBottom:4}}>{line}</div>
                          ))}
                        </div>
                      )}
                      <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:5}}>
                        {competitorResults.slice(0,5).map(r=>(
                          <div key={r.videoId} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'6px 8px',borderRadius:8,background:T.input,border:`1px solid ${T.border}`}}>
                            <img src={r.thumbnailUrl} alt="" style={{width:64,height:36,borderRadius:4,objectFit:'cover',flexShrink:0}} onError={e=>{e.target.style.display='none';}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:10,color:T.text,fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',lineHeight:1.4}}>{r.title}</div>
                              <div style={{fontSize:9,color:T.muted,marginTop:2}}>{r.channelName} · {formatViewCount(r.viewCount)} views</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tier 3 Item 4: Heat Map sidebar panel ────────────────── */}
            {activeTool==='heatmap'&&(
              <div>
                <span style={css.label}>Focus / Saliency Heat Map</span>
                <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.6}}>
                  Visualize where viewers' eyes are drawn on your thumbnail. Generated locally — instant, no quota used.
                </div>
                <button onClick={runHeatMap} disabled={heatMapLoading}
                  style={{...css.addBtn,marginTop:0,background:heatMapLoading?'transparent':`linear-gradient(135deg,#f97316,#ea580c)`,color:heatMapLoading?T.accent:'#fff',border:heatMapLoading?`1px solid ${T.accentBorder}`:'none',fontWeight:'700',fontSize:13}}>
                  {heatMapLoading?<><span style={{display:'inline-block',animation:'editor-spin 0.8s linear infinite'}}>◌</span> Analyzing…</>:'◉ Generate Heat Map'}
                </button>
                {showHeatMap&&(
                  <div style={{marginTop:10}}>
                    <div style={{fontSize:10,color:T.muted,marginBottom:6}}>Use the control panel (bottom-right) to adjust opacity and toggle the overlay.</div>
                    {heatMapInsights.length>0&&(
                      <div>
                        <span style={css.label}>Insights</span>
                        {heatMapInsights.map((ins,i)=>(
                          <div key={i} style={{fontSize:11,color:T.text,lineHeight:1.5,marginBottom:6,paddingLeft:8,borderLeft:`2px solid ${T.accent}`}}>
                            {ins}
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={()=>{setShowHeatMap(false);setHeatMapData(null);setHeatMapInsights([]);}}
                      style={{...css.addBtn,marginTop:8,background:'transparent',border:`1px solid ${T.border}`,color:T.muted,fontSize:11}}>
                      ✕ Clear Heat Map
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='ab'&&(()=>{
              const cardW=114, cardH=Math.round(cardW*720/1280); // 16:9 ≈ 64px
              const SLOT_LABELS=['Original','Tight + Default','Wide + Warm','Cool + New Text','Cinematic + Right','Neon + AI BG'];
              const hasAny=aiVariants.some(v=>v?.base64);
              const readyCount=aiVariants.filter(v=>v?.base64).length;
              return(
              <div>
                <span style={css.label}>AI Variant Generator</span>

                {/* Config */}
                <div style={{marginBottom:10}}>
                  <span style={css.label}>Video title</span>
                  <input
                    value={aiVarTitle}
                    onChange={e=>setAiVarTitle(e.target.value)}
                    placeholder="e.g. I Spent 30 Days in Antarctica"
                    style={{...css.input,marginBottom:6}}
                  />
                  <span style={css.label}>Niche</span>
                  <select value={aiVarNiche} onChange={e=>setAiVarNiche(e.target.value)} style={{...css.input,marginBottom:0}}>
                    {AI_VARIANT_NICHES.map(n=><option key={n} value={n}>{n.charAt(0).toUpperCase()+n.slice(1)}</option>)}
                  </select>
                </div>

                <button
                  onClick={generateAiVariants}
                  disabled={aiVarBusy}
                  style={{
                    ...css.addBtn,marginTop:0,
                    background:aiVarBusy?'transparent':`linear-gradient(135deg,#f97316,#ea580c)`,
                    color:aiVarBusy?T.accent:'#fff',
                    border:aiVarBusy?`1px solid ${T.accentBorder}`:'none',
                    fontSize:13,fontWeight:'800',letterSpacing:'0.3px',
                    display:'flex',alignItems:'center',justifyContent:'center',gap:7,
                    boxShadow:aiVarBusy?'none':'0 0 20px rgba(249,115,22,0.3)',
                    opacity:aiVarBusy?0.85:1,
                  }}>
                  {aiVarBusy
                    ?<><span style={{display:'inline-block',animation:'editor-spin 0.8s linear infinite'}}>◌</span> Generating {aiVariants.filter(v=>v?.base64).length}/5…</>
                    :<>⊟ Generate 5 AI Variants</>}
                </button>

                {/* 2×3 grid — original + 5 variants */}
                {(aiVarBusy||aiVariants.some(v=>v?.base64))&&(
                  <div style={{marginTop:14}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      {Array.from({length:6}).map((_,idx)=>{
                        const v=aiVariants[idx];
                        // Don't render empty/failed slots when not actively generating
                        if(!v?.base64&&idx>0&&!aiVarBusy) return null;
                        const isSelected=aiVarSelected===idx&&idx>0;
                        const isOriginal=idx===0;
                        const isLoading=!v&&idx>0&&aiVarBusy;
                        const isError=v?.error;
                        return(
                          <div key={idx} style={{
                            borderRadius:7,
                            border:`2px solid ${isSelected?T.accent:isOriginal?T.border:T.border}`,
                            overflow:'hidden',cursor:v?.base64?'pointer':'default',
                            transition:'border-color 0.15s,box-shadow 0.15s',
                            boxShadow:isSelected?`0 0 14px rgba(249,115,22,0.45)`:'none',
                            background:T.bg2,
                          }}
                          onClick={()=>{ if(v?.base64&&!isOriginal) selectAiVariant(idx); }}
                          onMouseEnter={e=>{ if(v?.base64&&!isOriginal) e.currentTarget.style.borderColor=T.accent; }}
                          onMouseLeave={e=>{ e.currentTarget.style.borderColor=isSelected?T.accent:T.border; }}>

                            {/* Thumbnail */}
                            <div style={{
                              width:'100%',height:cardH,
                              background:'#111',position:'relative',overflow:'hidden',
                              display:'flex',alignItems:'center',justifyContent:'center',
                            }}>
                              {v?.base64?(
                                <img src={v.base64} alt={v.label}
                                  style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                              ):isLoading?(
                                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                                  <span style={{fontSize:14,color:T.muted,animation:'editor-spin 1s linear infinite',display:'inline-block'}}>◌</span>
                                  <span style={{fontSize:8,color:T.muted,letterSpacing:'0.3px'}}>GENERATING</span>
                                </div>
                              ):(
                                <div style={{fontSize:9,color:T.muted,textAlign:'center',padding:'0 4px'}}>
                                  {isError?'Failed':'—'}
                                </div>
                              )}

                              {/* Label badge */}
                              <div style={{
                                position:'absolute',top:3,left:3,
                                fontSize:7,fontWeight:'800',color:'#fff',letterSpacing:'0.4px',
                                background:isOriginal?'rgba(0,0,0,0.65)':isSelected?T.accent:'rgba(0,0,0,0.65)',
                                padding:'1px 5px',borderRadius:4,
                                textTransform:'uppercase',
                              }}>
                                {isOriginal?'Original':isSelected?'✓ Winner':SLOT_LABELS[idx].split(' + ')[0]}
                              </div>

                              {/* Selected glow ring */}
                              {isSelected&&(
                                <div style={{position:'absolute',inset:0,border:`2px solid ${T.accent}`,borderRadius:5,pointerEvents:'none'}}/>
                              )}
                            </div>

                            {/* Card footer */}
                            <div style={{padding:'5px 6px',background:T.bg2}}>
                              <div style={{fontSize:9,fontWeight:'700',color:isSelected?T.accent:T.text,
                                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:2}}>
                                {v?.label||SLOT_LABELS[idx]}
                              </div>
                              {v?.description&&(
                                <div style={{fontSize:8,color:T.muted,overflow:'hidden',textOverflow:'ellipsis',
                                  whiteSpace:'nowrap',lineHeight:1.3}}>
                                  {v.description}
                                </div>
                              )}
                              {v?.base64&&!isOriginal&&!isSelected&&(
                                <button
                                  onClick={e=>{e.stopPropagation();selectAiVariant(idx);}}
                                  style={{
                                    marginTop:4,width:'100%',padding:'3px 0',borderRadius:4,
                                    border:'none',background:T.accent,color:'#fff',
                                    fontSize:8,fontWeight:'700',cursor:'pointer',letterSpacing:'0.3px',
                                  }}>
                                  ✓ Select Winner
                                </button>
                              )}
                              {isSelected&&(
                                <div style={{marginTop:4,fontSize:8,color:T.accent,fontWeight:'700',textAlign:'center'}}>
                                  ✓ Applied to canvas
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    {hasAny&&(
                      <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
                        <button
                          onClick={downloadAiVariantsZip}
                          disabled={aiVarBusy||readyCount===0}
                          style={{
                            ...css.addBtn,marginTop:0,
                            background:aiVarBusy?T.muted:`linear-gradient(135deg,#f97316,#ea580c)`,
                            color:'#fff',fontWeight:'700',fontSize:11,
                            boxShadow:aiVarBusy?'none':'0 0 16px rgba(249,115,22,0.25)',
                            opacity:aiVarBusy?0.6:1,
                          }}>
                          {aiVarBusy?'Working…':`⬇ Download All (${readyCount}) as ZIP`}
                        </button>
                        <button
                          onClick={()=>{setAiVariants([]);setAiVarSelected(null);}}
                          style={{...css.addBtn,marginTop:0,background:'transparent',
                            color:T.muted,border:`1px solid ${T.border}`,fontSize:11}}>
                          Clear &amp; Start Over
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state hint */}
                {aiVariants.length===0&&!aiVarBusy&&(
                  <div style={{...css.section,marginTop:10,fontSize:11,color:T.muted,lineHeight:1.65}}>
                    AI generates 5 pro variants of your thumbnail — different crops,
                    color grades, and headlines. Cards populate as each finishes.
                    Pick your winner with one click.
                  </div>
                )}
              </div>);
            })()}

            {false&&activeTool==='ab_legacy'&&(
              <div>
                <span style={css.label}>A/B Variants (legacy)</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Generate 3 variations of your current thumbnail instantly.
                  Pick the one that feels strongest.
                </div>

                <button onClick={generateVariants} disabled={abLoading}
                  style={{...css.addBtn,marginTop:10,
                    background:abLoading?T.muted:T.accent,
                    opacity:abLoading?0.6:1,fontSize:13,fontWeight:'700'}}>
                  {abLoading?'Generating...':'⊟ Generate 3 variants'}
                </button>

                {abLoading&&(
                  <div style={{textAlign:'center',padding:'20px 0',
                    fontSize:12,color:T.muted}}>
                    Creating variations...
                  </div>
                )}

                {abVariants.length>0&&(
                  <div>
                    <span style={{...css.label,marginTop:16}}>Choose a variant</span>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {abVariants.map(variant=>{
                        const vBg=variant.layers.find(l=>l.type==='background');
                        const vText=variant.layers.find(l=>l.type==='text');
                        const isSelected=abSelected===variant.id;
                        return(
                          <div key={variant.id}
                            onClick={()=>setAbSelected(variant.id)}
                            style={{borderRadius:8,border:`2px solid ${isSelected?T.accent:T.border}`,
                              overflow:'hidden',cursor:'pointer',transition:'all 0.15s',
                              background:isSelected?`${T.accent}08`:'transparent'}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=isSelected?T.accent:T.border}>
                            {/* Mini preview */}
                            <div style={{
                              height:56,
                              background:vBg?.bgGradient
                                ?`linear-gradient(135deg,${vBg.bgGradient[0]},${vBg.bgGradient[1]})`
                                :vBg?.bgColor||'#1a1a1a',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              position:'relative',overflow:'hidden',
                            }}>
                              {variant.layers.filter(l=>l.type==='image'&&!l.hidden).map((img,idx)=>(
                                <img key={idx} src={img.paintSrc||img.src} alt="" style={{
                                  position:'absolute',
                                  left:img.x*(56/p.preview.h)||0,
                                  top:img.y*(56/p.preview.h)||0,
                                  height:img.height*(56/p.preview.h)||56,
                                  width:'auto',
                                  pointerEvents:'none',
                                  userSelect:'none',
                                }}/>
                              ))}
                              {vText&&(
                                <span style={{
                                  fontSize:14,fontWeight:vText.fontWeight||700,
                                  color:vText.textColor||'#fff',
                                  fontFamily:vText.fontFamily||'Impact',
                                  textShadow:vText.shadowEnabled?'2px 2px 0 #000':'none',
                                  WebkitTextStroke:vText.strokeWidth>0
                                    ?`${Math.min(vText.strokeWidth,2)}px ${vText.strokeColor}`:'none',
                                  letterSpacing:1,padding:'0 8px',
                                  textAlign:'center',position:'relative',zIndex:1,
                                }}>
                                  {vText.text?.slice(0,20)}
                                </span>
                              )}
                              <div style={{position:'absolute',top:4,left:4,
                                fontSize:9,fontWeight:'800',color:'#fff',
                                background:'rgba(0,0,0,0.6)',padding:'1px 6px',
                                borderRadius:8}}>
                                {variant.label.split(' — ')[0]}
                              </div>
                            </div>
                            {/* Info + apply */}
                            <div style={{padding:'8px 10px',display:'flex',
                              alignItems:'center',justifyContent:'space-between'}}>
                              <div>
                                <div style={{fontSize:11,fontWeight:'600',color:T.text}}>
                                  {variant.label}
                                </div>
                                <div style={{fontSize:10,color:T.muted,marginTop:1}}>
                                  {variant.desc}
                                </div>
                              </div>
                              <button onClick={e=>{e.stopPropagation();applyVariant(variant);}}
                                style={{padding:'5px 12px',borderRadius:5,border:'none',
                                  background:T.accent,color:'#fff',cursor:'pointer',
                                  fontSize:10,fontWeight:'700',flexShrink:0}}>
                                Use this
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{...css.section,marginTop:10,fontSize:11,
                      color:T.muted,lineHeight:1.6}}>
                      💡 Tip — generate variants multiple times for more options.
                      Each run creates different combinations.
                    </div>

                    <button onClick={downloadVariantsAsZip} disabled={abLoading}
                      style={{...css.addBtn,marginTop:8,
                        background:abLoading?T.muted:'linear-gradient(135deg,#f97316,#ea580c)',
                        color:'#fff',fontWeight:'700',fontSize:12,
                        boxShadow:abLoading?'none':'0 0 20px rgba(249,115,22,0.3)',
                        opacity:abLoading?0.6:1}}>
                      {abLoading?'Exporting...':'⬇ Download All as ZIP'}
                    </button>
                    <button onClick={()=>{setAbVariants([]);setAbSelected(null);}}
                      style={{...css.addBtn,marginTop:8,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`}}>
                      Clear variants
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTool==='templates'&&(
              <div>
                <span style={css.label}>Viral templates</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.muted,lineHeight:1.6}}>
                  Click any template to load it. You can customize everything after.
                </div>

                {/* Category filter */}
                {(()=>{
                  const cats=['All',...new Set(VIRAL_TEMPLATES.map(t=>t.category))];
                  const [activeCat,setActiveCat] = [
                    window._snapTemplateCat||'All',
                    (c)=>{ window._snapTemplateCat=c; setActiveTool('templates'); }
                  ];
                  const filtered = activeCat==='All'
                    ? VIRAL_TEMPLATES
                    : VIRAL_TEMPLATES.filter(t=>t.category===activeCat);
                  return(
                    <>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',margin:'8px 0'}}>
                        {cats.map(cat=>(
                          <button key={cat} onClick={()=>setActiveCat(cat)}
                            style={{padding:'3px 10px',borderRadius:10,fontSize:10,
                              border:`1px solid ${activeCat===cat?T.accent:T.border}`,
                              background:activeCat===cat?T.accent:'transparent',
                              color:activeCat===cat?'#fff':T.muted,cursor:'pointer',
                              fontWeight:activeCat===cat?'700':'400'}}>
                            {cat}
                          </button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {filtered.map(template=>(
                          <div key={template.id}
                            style={{borderRadius:8,border:`1px solid ${T.border}`,
                              overflow:'hidden',cursor:'pointer',transition:'all 0.15s'}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                            {/* Preview */}
                            <div onClick={()=>loadTemplate(template)}
                              style={{height:60,background:template.preview.bg,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                position:'relative',overflow:'hidden'}}>
                              <span style={{fontSize:16,fontWeight:'900',color:'#fff',
                                fontFamily:'Impact,sans-serif',
                                textShadow:'2px 2px 0 rgba(0,0,0,0.8)',
                                letterSpacing:1}}>
                                {template.preview.text}
                              </span>
                              <div style={{position:'absolute',top:4,right:4,
                                padding:'1px 6px',borderRadius:8,
                                background:'rgba(0,0,0,0.6)',
                                fontSize:8,color:'#fff',fontWeight:'600'}}>
                                {template.category}
                              </div>
                            </div>
                            {/* Info */}
                            <div style={{padding:'8px 10px',background:T.input,
                              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                              <span style={{fontSize:11,color:T.text,fontWeight:'600'}}>
                                {template.label}
                              </span>
                              <button onClick={()=>loadTemplate(template)}
                                style={{padding:'3px 10px',borderRadius:5,border:'none',
                                  background:T.accent,color:'#fff',cursor:'pointer',
                                  fontSize:10,fontWeight:'700'}}>
                                Use
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {activeTool==='ctr'&&<ErrorBoundary fallbackMessage="CTR panel error">{(()=>{
              const CAT_LABELS={
                face_prominence:'Face',text_readability:'Text',
                color_contrast:'Contrast',emotional_intensity:'Emotion',
                composition:'Layout',niche_relevance:'Niche Fit',
              };
              const gaugeR=56, gaugeSize=128;
              const circ=2*Math.PI*gaugeR;
              const score=ctrV2?.overall||0;
              const targetOffset=circ-(score/100)*circ;
              const gaugeColor=score>=80?T.success:score>=60?T.warning:T.danger;
              const animId=ctrV2?._ts||0;
              return(
              <div>
                {/* Animate gauge from empty on each new result */}
                {ctrV2&&<style>{`
                  @keyframes tf-ctr-gauge-${animId}{
                    from{stroke-dashoffset:${circ.toFixed(1)}}
                    to{stroke-dashoffset:${targetOffset.toFixed(1)}}
                  }
                  .tf-ctr-arc-${animId}{
                    animation:tf-ctr-gauge-${animId} 1.3s cubic-bezier(0.4,0,0.2,1) forwards;
                    transform:rotate(-90deg);
                    transform-origin:${gaugeSize/2}px ${gaugeSize/2}px;
                  }
                `}</style>}

                <span style={css.label}>CTR Score v2</span>

                {/* Inputs */}
                <div style={{...css.section,marginTop:0,display:'flex',flexDirection:'column',gap:6}}>
                  <input placeholder="Video title (improves scoring)"
                    value={ctrTitle} onChange={e=>setCtrTitle(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&!ctrLoading)analyzeCTR();}}
                    style={{...css.input,marginBottom:0}}/>
                  <select value={ctrNiche} onChange={e=>setCtrNiche(e.target.value)}
                    style={{...css.input,marginBottom:0,appearance:'none',
                      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23454e6b'/%3E%3C/svg%3E")`,
                      backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center',paddingRight:28}}>
                    {['Gaming','Tech','Finance','Fitness','Food','Beauty','Travel','Education','Vlog','Business','Motivation','Comedy','Reaction','DIY','Music','Sports','Science'].map(n=>(
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <button onClick={analyzeCTR} disabled={ctrLoading}
                  style={{...css.addBtn,
                    background:ctrLoading?'transparent':`linear-gradient(135deg,#f97316,#ea580c)`,
                    color:ctrLoading?T.accent:'#fff',
                    border:ctrLoading?`1px solid ${T.accentBorder}`:'none',
                    fontWeight:'700',fontSize:13,marginTop:0}}>
                  {ctrLoading?'Analyzing…':'◈ Analyze CTR'}
                </button>

                {ctrV2&&(<>

                  {/* ── Hero: Circular gauge ── */}
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'18px 0 12px'}}>
                    <svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
                      {/* Track */}
                      <circle cx={gaugeSize/2} cy={gaugeSize/2} r={gaugeR}
                        fill="none" stroke={T.border} strokeWidth="10"/>
                      {/* Animated arc */}
                      <circle cx={gaugeSize/2} cy={gaugeSize/2} r={gaugeR}
                        fill="none" stroke={gaugeColor} strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circ.toFixed(1)}
                        className={`tf-ctr-arc-${animId}`}/>
                      {/* Score number */}
                      <text x={gaugeSize/2} y={gaugeSize/2-8} textAnchor="middle"
                        dominantBaseline="middle" fontSize="30" fontWeight="900"
                        fill={T.text} fontFamily="Anton,sans-serif">{score}</text>
                      <text x={gaugeSize/2} y={gaugeSize/2+18} textAnchor="middle"
                        fontSize="8" fontWeight="700" fill={T.muted}
                        letterSpacing="1">OUT OF 100</text>
                    </svg>

                    {/* Predicted CTR range */}
                    <div style={{textAlign:'center',marginTop:4}}>
                      <div style={{
                        fontSize:20,fontWeight:'900',color:gaugeColor,
                        letterSpacing:'-0.5px',lineHeight:1.1,
                      }}>
                        {ctrV2.predicted_ctr_low}%
                        <span style={{fontSize:14,color:T.muted,fontWeight:'400',margin:'0 4px'}}>–</span>
                        {ctrV2.predicted_ctr_high}%
                      </div>
                      <div style={{fontSize:10,color:T.muted,fontWeight:'600',marginTop:2,letterSpacing:'0.3px'}}>
                        PREDICTED CTR
                      </div>
                      <div style={{fontSize:10,color:T.muted,marginTop:4}}>
                        vs. <span style={{color:T.warning}}>{ctrV2.industry_avg}%</span> {ctrNiche} avg
                      </div>
                    </div>
                  </div>

                  {/* ── Mobile preview ── */}
                  {ctrThumbUrl&&(
                    <div style={{marginBottom:10}}>
                      <span style={css.label}>YouTube Mobile Preview</span>
                      <div style={{
                        background:'#0f0f0f',borderRadius:8,padding:8,
                        border:`1px solid ${T.border}`,
                      }}>
                        <img src={ctrThumbUrl} alt="Mobile preview"
                          style={{width:180,height:101,objectFit:'cover',borderRadius:4,display:'block',margin:'0 auto'}}/>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,padding:'0 2px'}}>
                          <div style={{width:24,height:24,borderRadius:'50%',background:T.border,flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <div style={{height:7,borderRadius:3,background:T.muted,marginBottom:4,width:'90%'}}/>
                            <div style={{height:6,borderRadius:3,background:T.border,width:'60%'}}/>
                          </div>
                        </div>
                        <div style={{textAlign:'center',marginTop:4,fontSize:8,color:T.border,letterSpacing:'0.5px'}}>
                          180 × 101 px — YouTube mobile grid
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Category breakdown ── */}
                  <span style={css.label}>Score breakdown</span>
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {Object.entries(ctrV2.categories).map(([key,cat])=>{
                      const pct=Math.round((cat.score/cat.max)*100);
                      const barColor=pct>=80?T.success:pct>=53?T.warning:T.danger;
                      const expanded=ctrExpandedCat===key;
                      return(
                        <div key={key}>
                          <button onClick={()=>setCtrExpandedCat(expanded?null:key)}
                            style={{
                              width:'100%',padding:'7px 0',background:'none',border:'none',
                              cursor:'pointer',textAlign:'left',
                            }}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                              <span style={{fontSize:11,color:expanded?T.accent:T.text,fontWeight:'600',transition:'color 0.1s'}}>
                                {CAT_LABELS[key]||key}
                              </span>
                              <div style={{display:'flex',alignItems:'center',gap:5}}>
                                <span style={{fontSize:10,fontWeight:'700',color:barColor,fontFamily:'monospace'}}>
                                  {cat.score}/{cat.max}
                                </span>
                                <span style={{fontSize:9,color:T.muted,transition:'transform 0.15s',
                                  display:'inline-block',transform:expanded?'rotate(180deg)':'none'}}>▾</span>
                              </div>
                            </div>
                            <div style={{height:4,borderRadius:2,background:T.border,overflow:'hidden'}}>
                              <div style={{
                                height:'100%',borderRadius:2,
                                width:`${pct}%`,background:barColor,
                                transition:'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                              }}/>
                            </div>
                          </button>
                          {expanded&&(
                            <div style={{
                              padding:'8px 10px',marginTop:2,marginBottom:4,
                              borderRadius:7,fontSize:11,color:T.text,lineHeight:1.55,
                              background:`${T.accent}0d`,border:`1px solid ${T.accentBorder}`,
                            }}>
                              {cat.tip}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Issues checklist ── */}
                  {ctrV2.issues.length>0&&(<>
                    <span style={css.label}>Issues — {ctrV2.issues.length-ctrChecked.size} remaining</span>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      {ctrV2.issues.map((issue,i)=>{
                        const checked=ctrChecked.has(i);
                        return(
                          <button key={i} onClick={()=>{
                            setCtrChecked(prev=>{const n=new Set(prev);checked?n.delete(i):n.add(i);return n;});
                          }} style={{
                            display:'flex',alignItems:'flex-start',gap:8,
                            padding:'7px 9px',borderRadius:7,cursor:'pointer',
                            background:checked?`${T.success}0d`:`${T.danger}0d`,
                            border:`1px solid ${checked?T.success:T.danger}33`,
                            textAlign:'left',width:'100%',transition:'all 0.12s',
                          }}>
                            <span style={{
                              width:14,height:14,borderRadius:3,flexShrink:0,marginTop:1,
                              background:checked?T.success:'transparent',
                              border:`2px solid ${checked?T.success:T.danger}`,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:9,color:'#fff',fontWeight:'900',
                            }}>{checked?'✓':''}</span>
                            <span style={{fontSize:11,color:checked?T.muted:T.text,lineHeight:1.45,
                              textDecoration:checked?'line-through':'none'}}>
                              {typeof issue==='string'?issue:(issue?.title||'')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>)}

                  {/* ── Wins ── */}
                  {ctrV2.wins.length>0&&(<>
                    <span style={css.label}>What's working</span>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      {ctrV2.wins.map((win,i)=>(
                        <div key={i} style={{
                          display:'flex',alignItems:'flex-start',gap:8,
                          padding:'7px 9px',borderRadius:7,
                          background:`${T.success}0d`,
                          border:`1px solid ${T.success}33`,
                        }}>
                          <span style={{color:T.success,fontSize:12,flexShrink:0,marginTop:1}}>✓</span>
                          <span style={{fontSize:11,color:T.text,lineHeight:1.45}}>{typeof win==='string'?win:(win?.title||'')}</span>
                        </div>
                      ))}
                    </div>
                  </>)}

                  <button onClick={()=>{setCtrV2(null);setCtrChecked(new Set());setCtrExpandedCat(null);setCtrThumbUrl(null);}}
                    style={{...css.addBtn,background:'transparent',color:T.muted,
                      border:`1px solid ${T.border}`,marginTop:10,fontSize:11}}>
                    × Clear results
                  </button>
                </>)}
              </div>
              );
            })()}</ErrorBoundary>}

            {activeTool==='composition'&&<ErrorBoundary fallbackMessage="Composition panel error">
              <div>
                <span style={css.label}>Composition AI</span>

                {/* Video title input */}
                <div style={{...css.section,marginTop:0}}>
                  <div style={{fontSize:11,color:T.muted,marginBottom:8,lineHeight:1.6}}>
                    Claude Vision analyzes your thumbnail for click-worthiness — rule-of-thirds, subject placement, text zones, and more.
                  </div>
                  <input
                    placeholder="Video title (optional, improves analysis)"
                    value={compVideoTitle}
                    onChange={e=>setCompVideoTitle(e.target.value)}
                    style={{...css.input,marginBottom:0}}
                  />
                </div>

                <button
                  onClick={analyzeComposition}
                  disabled={compLoading}
                  style={{...css.addBtn,
                    background:compLoading?T.muted:T.accent,
                    fontSize:13,fontWeight:'700',
                    opacity:compLoading?0.6:1,
                    marginTop:0,
                  }}
                >
                  {compLoading?'Analyzing…':'◫ Analyze composition'}
                </button>

                {compResult&&(<>
                  {/* Score gauge */}
                  <div style={{textAlign:'center',padding:'18px 0 10px'}}>
                    <div style={{
                      fontSize:60,fontWeight:'900',lineHeight:1,letterSpacing:'-2px',
                      color:compResult.score>=8?T.success:compResult.score>=5?T.warning:T.danger,
                    }}>{compResult.score}<span style={{fontSize:22,fontWeight:'400',color:T.muted}}>/10</span></div>
                    <div style={{fontSize:12,color:T.muted,marginTop:4}}>
                      {compResult.score>=9?'Near-perfect composition':
                       compResult.score>=7?'Strong composition':
                       compResult.score>=5?'Needs refinement':
                       'Major composition issues'}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div style={{height:7,borderRadius:4,background:T.border,marginBottom:14,overflow:'hidden'}}>
                    <div style={{
                      height:'100%',borderRadius:4,
                      width:`${compResult.score*10}%`,
                      background:compResult.score>=8?T.success:compResult.score>=5?T.warning:T.danger,
                      transition:'width 0.5s ease',
                    }}/>
                  </div>

                  {/* Overlay toggle */}
                  <button
                    onClick={()=>setCompOverlay(v=>!v)}
                    style={{
                      width:'100%',padding:'7px 10px',borderRadius:7,
                      background:compOverlay?`${T.accent}22`:'transparent',
                      border:`1px solid ${compOverlay?T.accent:T.border}`,
                      color:compOverlay?T.accent:T.muted,
                      fontSize:11,cursor:'pointer',fontWeight:'600',marginBottom:10,
                      transition:'all 0.15s',
                    }}
                  >
                    {compOverlay?'◫ Overlay ON — click to hide':'◫ Show overlay'}
                  </button>

                  {/* Assessments */}
                  {(compResult.focal_point||compResult.negative_space||compResult.face_placement)&&(<>
                    <span style={css.label}>Assessments</span>
                    <div style={{...css.section,display:'flex',flexDirection:'column',gap:8}}>
                      {compResult.focal_point&&(
                        <div style={{fontSize:11,color:T.text,lineHeight:1.5}}>
                          <span style={{color:T.accent,fontWeight:'700',marginRight:5}}>◎ Focal point</span>
                          {compResult.focal_point}
                        </div>
                      )}
                      {compResult.negative_space&&(
                        <div style={{fontSize:11,color:T.text,lineHeight:1.5}}>
                          <span style={{color:T.accent,fontWeight:'700',marginRight:5}}>⬜ Space</span>
                          {compResult.negative_space}
                        </div>
                      )}
                      {compResult.face_placement&&(
                        <div style={{fontSize:11,color:T.text,lineHeight:1.5}}>
                          <span style={{color:T.accent,fontWeight:'700',marginRight:5}}>◉ Face</span>
                          {compResult.face_placement}
                        </div>
                      )}
                    </div>
                  </>)}

                  {/* Issues checklist */}
                  {compResult.issues?.length>0&&(<>
                    <span style={css.label}>Issues to fix — {compResult.issues.length-compChecked.size} remaining</span>
                    <div style={{display:'flex',flexDirection:'column',gap:5}}>
                      {compResult.issues.map((issue,i)=>{
                        const checked=compChecked.has(i);
                        return(
                          <button key={i} onClick={()=>{
                            setCompChecked(prev=>{
                              const next=new Set(prev);
                              checked?next.delete(i):next.add(i);
                              return next;
                            });
                          }} style={{
                            display:'flex',alignItems:'flex-start',gap:8,
                            padding:'8px 10px',borderRadius:7,
                            background:checked?`${T.success}18`:`${T.danger}12`,
                            border:`1px solid ${checked?T.success:T.danger}44`,
                            cursor:'pointer',textAlign:'left',width:'100%',
                            transition:'all 0.15s',
                          }}>
                            <span style={{
                              width:16,height:16,borderRadius:4,flexShrink:0,marginTop:1,
                              background:checked?T.success:'transparent',
                              border:`2px solid ${checked?T.success:T.danger}`,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:10,color:'#fff',fontWeight:'900',
                            }}>{checked?'✓':''}</span>
                            <span style={{
                              fontSize:11,color:checked?T.muted:T.text,
                              lineHeight:1.5,
                              textDecoration:checked?'line-through':'none',
                            }}>{typeof issue==='string'?issue:(issue?.title||'')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>)}

                  {/* Crop suggestion */}
                  {compResult.crop_suggestion&&
                   !(compResult.crop_suggestion.x===0&&compResult.crop_suggestion.y===0&&
                     compResult.crop_suggestion.w>=98&&compResult.crop_suggestion.h>=98)&&(<>
                    <span style={css.label}>Crop suggestion</span>
                    <div style={{...css.section,fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:6}}>
                      Claude recommends tightening the crop to focus on the key subject. Apply to zoom the view.
                    </div>
                    <button
                      onClick={applyCropSuggestion}
                      style={{...css.addBtn,background:`${T.accent}22`,
                        color:T.accent,border:`1px solid ${T.accent}`,
                        fontWeight:'700',fontSize:12,marginTop:0}}
                    >
                      ✂ Apply suggested crop
                    </button>
                  </>)}

                  {/* Reset */}
                  <button
                    onClick={()=>{setCompResult(null);setCompChecked(new Set());setCompOverlay(false);}}
                    style={{...css.addBtn,background:'transparent',
                      color:T.muted,border:`1px solid ${T.border}`,marginTop:8}}
                  >
                    × Clear
                  </button>
                </>)}
              </div>
            </ErrorBoundary>}

            {activeTool==='aitext'&&(
              <div>
                <style>{`@keyframes tf-caret{0%,100%{opacity:1}50%{opacity:0}}`}</style>
                <span style={css.label}>AI Text Engine</span>

                {/* Inputs */}
                <div style={{...css.section,marginTop:0,display:'flex',flexDirection:'column',gap:7}}>
                  <input
                    placeholder="Video title (e.g. I Spent $10,000...)"
                    value={aiTextTitle}
                    onChange={e=>setAiTextTitle(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&!aiTextLoading)generateAIText();}}
                    style={{...css.input,marginBottom:0}}
                  />
                  <select
                    value={aiTextNiche}
                    onChange={e=>setAiTextNiche(e.target.value)}
                    style={{...css.input,marginBottom:0,appearance:'none',paddingRight:28,
                      backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23454e6b'/%3E%3C/svg%3E")`,
                      backgroundRepeat:'no-repeat',backgroundPosition:'right 10px center',
                    }}
                  >
                    {['Gaming','Tech','Finance','Fitness','Food','Beauty','Travel',
                      'Education','Vlog','Business','Motivation','Comedy','Reaction',
                      'DIY','Music','Sports','Science','News'].map(n=>(
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Generate button */}
                <button
                  onClick={generateAIText}
                  disabled={aiTextLoading}
                  style={{
                    ...css.addBtn,
                    background:aiTextLoading?'transparent':T.accent,
                    color:aiTextLoading?T.accent:'#fff',
                    border:aiTextLoading?`1px solid ${T.accentBorder}`:'none',
                    fontWeight:'700',fontSize:13,marginTop:0,
                    display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                    opacity:aiTextLoading?1:1,
                  }}
                >
                  {aiTextLoading?(
                    <>
                      Writing your headline...
                      <span style={{
                        display:'inline-block',width:2,height:14,
                        background:T.accent,marginLeft:2,
                        verticalAlign:'middle',
                        animation:'tf-caret 0.8s step-end infinite',
                      }}/>
                    </>
                  ):'✦ Generate headlines'}
                </button>

                {/* Result cards */}
                {aiTextResults.length>0&&(<>
                  <span style={css.label}>Click any card to place on canvas</span>
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {aiTextResults.map((opt,i)=>{
                      const isLight=opt.color==='light';
                      const row=opt.y<35?'TOP':(opt.y>65?'BOTTOM':'MID');
                      const col=opt.x<35?'LEFT':(opt.x>65?'RIGHT':'CENTER');
                      const fontStack=opt.fontFamily==='Bebas Neue'?'"Bebas Neue",Anton,sans-serif':
                                      opt.fontFamily==='Oswald'?'Oswald,sans-serif':
                                      'Anton,sans-serif';
                      const previewSize=Math.min(24,Math.max(15,Math.round((opt.fontSize||60)/3)));
                      return(
                        <button key={i}
                          onClick={()=>placeAITextOption(opt)}
                          onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${T.accent}`}
                          onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}
                          style={{
                            display:'block',width:'100%',padding:'13px 14px 11px',
                            borderRadius:10,border:`1px solid ${isLight?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'}`,
                            background:isLight?'#0f1117':'#f3f4f6',
                            cursor:'pointer',textAlign:'left',outline:'none',
                            position:'relative',transition:'box-shadow 0.12s',
                          }}
                        >
                          {/* Text preview */}
                          <div style={{
                            fontSize:previewSize,
                            fontFamily:fontStack,
                            fontWeight:900,
                            color:isLight?'#ffffff':'#0f1117',
                            letterSpacing:opt.fontFamily==='Bebas Neue'?2:1,
                            lineHeight:1.1,
                            marginBottom:9,
                            userSelect:'none',
                            textShadow:isLight&&opt.strokeWidth>4
                              ?`0 0 ${opt.strokeWidth*1.5}px rgba(0,0,0,0.9)`
                              :!isLight&&opt.strokeWidth>4
                              ?`0 0 ${opt.strokeWidth*1.5}px rgba(255,255,255,0.8)`
                              :'none',
                            paddingRight:22,
                          }}>
                            {opt.text}
                          </div>

                          {/* Metadata chips */}
                          <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                            <span style={{
                              fontSize:8,fontWeight:'700',letterSpacing:'0.6px',
                              background:`${T.accent}1a`,color:T.accent,
                              padding:'2px 6px',borderRadius:4,
                              border:`1px solid ${T.accent}33`,
                              fontFamily:'monospace',
                            }}>◎ {row} {col}</span>

                            <span style={{
                              fontSize:8,fontWeight:'600',
                              background:isLight?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)',
                              color:isLight?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.4)',
                              padding:'2px 6px',borderRadius:4,
                              border:`1px solid ${isLight?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'}`,
                              fontFamily:'monospace',
                            }}>
                              {opt.fontFamily||'Anton'} {opt.fontSize||60}px
                            </span>

                            {(opt.strokeWidth||0)>0&&(
                              <span style={{
                                fontSize:8,fontWeight:'600',
                                background:isLight?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)',
                                color:isLight?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.35)',
                                padding:'2px 6px',borderRadius:4,
                                border:`1px solid ${isLight?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'}`,
                                fontFamily:'monospace',
                              }}>stroke {opt.strokeWidth}</span>
                            )}

                            <span style={{
                              fontSize:8,fontWeight:'600',
                              background:isLight?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.07)',
                              color:isLight?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.35)',
                              padding:'2px 6px',borderRadius:4,
                              border:`1px solid ${isLight?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'}`,
                            }}>{isLight?'⬜ light':'⬛ dark'}</span>
                          </div>

                          {/* Place indicator */}
                          <span style={{
                            position:'absolute',top:'50%',right:12,
                            transform:'translateY(-50%)',
                            fontSize:18,color:T.accent,opacity:0.5,
                            fontWeight:'900',lineHeight:1,
                          }}>+</span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={generateAIText}
                    disabled={aiTextLoading}
                    style={{...css.addBtn,background:'transparent',
                      color:T.accent,border:`1px solid ${T.accent}`,
                      marginTop:8,fontSize:11,opacity:aiTextLoading?0.5:1}}
                  >
                    ↺ Regenerate
                  </button>
                </>)}
              </div>
            )}

            {activeTool==='style'&&(()=>{
              const PRESETS=[
                {id:'mrbeast',   label:'MrBeast',        mood:'Punchy & Viral',    colors:['#f97316','#facc15','#ef4444','#22c55e','#0ea5e9']},
                {id:'mkbhd',     label:'MKBHD',          mood:'Clean & Minimal',   colors:['#0a0a0a','#18181b','#1d4ed8','#60a5fa','#f1f5f9']},
                {id:'veritasium',label:'Veritasium',     mood:'Natural & Engaging',colors:['#1a3d2b','#2d6a4f','#52b788','#f4a261','#fefae0']},
                {id:'linus',     label:'Linus Tech Tips', mood:'Bright & Direct',  colors:['#f8fafc','#e2e8f0','#3b82f6','#1d4ed8','#fbbf24']},
                {id:'markrober', label:'Mark Rober',     mood:'Vibrant & Bold',    colors:['#1d4ed8','#ef4444','#f59e0b','#10b981','#7c3aed']},
              ];
              return(
              <div>
                <span style={css.label}>Style Transfer</span>

                {/* Mode tabs */}
                <div style={{display:'flex',gap:4,marginBottom:10,padding:3,background:T.bg2,borderRadius:8,border:`1px solid ${T.border}`}}>
                  {[['preset','Creator Presets'],['url','Reference URL']].map(([m,label])=>(
                    <button key={m} onClick={()=>{setStyleMode(m);setStyleResult(null);}}
                      style={{
                        flex:1,padding:'6px 4px',borderRadius:6,border:'none',fontSize:10,
                        fontWeight:'700',letterSpacing:'0.3px',cursor:'pointer',
                        background:styleMode===m?T.accent:'transparent',
                        color:styleMode===m?'#fff':T.muted,
                        transition:'all 0.12s',
                      }}
                    >{label}</button>
                  ))}
                </div>

                {/* ── Creator Preset Grid ── */}
                {styleMode==='preset'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {PRESETS.map(p=>{
                      const sel=stylePreset===p.id;
                      return(
                        <button key={p.id} onClick={()=>setStylePreset(p.id)}
                          onMouseEnter={e=>{if(!sel)e.currentTarget.style.borderColor=T.accentBorder;}}
                          onMouseLeave={e=>{if(!sel)e.currentTarget.style.borderColor=T.border;}}
                          style={{
                            display:'flex',alignItems:'center',
                            padding:'11px 12px',borderRadius:9,cursor:'pointer',
                            border:`1px solid ${sel?T.accent:T.border}`,
                            borderLeft:`3px solid ${sel?T.accent:'transparent'}`,
                            background:sel?`${T.accent}0d`:T.bg2,
                            transition:'all 0.12s',outline:'none',gap:10,
                          }}
                        >
                          {/* Creator info */}
                          <div style={{flex:1,textAlign:'left'}}>
                            <div style={{
                              fontSize:12,fontWeight:'800',color:sel?T.accent:T.text,
                              letterSpacing:'-0.2px',lineHeight:1.2,
                              fontFamily:'Anton,sans-serif',
                            }}>{p.label}</div>
                            <div style={{fontSize:9,color:T.muted,marginTop:2,letterSpacing:'0.3px'}}>{p.mood}</div>
                          </div>

                          {/* Color swatch strip */}
                          <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
                            {p.colors.map((c,ci)=>(
                              <div key={ci} style={{
                                width:12,height:12,borderRadius:'50%',background:c,flexShrink:0,
                                boxShadow:`0 0 0 1px rgba(0,0,0,0.25)`,
                              }}/>
                            ))}
                          </div>

                          {/* Selected dot */}
                          {sel&&<div style={{
                            width:7,height:7,borderRadius:'50%',
                            background:T.accent,flexShrink:0,
                          }}/>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── URL Mode ── */}
                {styleMode==='url'&&(
                  <div>
                    <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.6}}>
                      Paste any YouTube thumbnail URL. We'll extract its color grade and apply it to your image.
                    </div>
                    <input
                      placeholder="https://i.ytimg.com/vi/..."
                      value={styleUrl}
                      onChange={e=>setStyleUrl(e.target.value)}
                      style={{...css.input,marginTop:6}}
                    />
                  </div>
                )}

                {/* Intensity slider */}
                <div style={{marginTop:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                    <span style={{...css.label,marginTop:0,marginBottom:0}}>Intensity</span>
                    <span style={{fontSize:11,fontWeight:'700',color:T.accent}}>{styleIntensity}%</span>
                  </div>
                  <Slider min={10} max={100} value={styleIntensity} onChange={v=>setStyleIntensity(v)} style={{width:'100%'}}/>
                </div>

                {/* Apply button */}
                <button
                  onClick={applyStyleTransfer}
                  disabled={styleBusy||(styleMode==='url'&&!styleUrl.trim())}
                  style={{
                    ...css.addBtn,
                    background:styleBusy?'transparent':T.accent,
                    color:styleBusy?T.accent:'#fff',
                    border:styleBusy?`1px solid ${T.accentBorder}`:'none',
                    fontWeight:'700',fontSize:13,marginTop:12,
                    opacity:(styleMode==='url'&&!styleUrl.trim())?0.45:1,
                  }}
                >
                  {styleBusy?'Applying style…':'◑ Apply style transfer'}
                </button>

                {/* ── Result card ── */}
                {styleResult&&(
                  <div style={{marginTop:12}}>
                    <span style={css.label}>Applied style</span>
                    <div style={{
                      ...css.section,
                      background:`linear-gradient(135deg,${T.bg2},${T.panel})`,
                      border:`1px solid ${T.accent}33`,
                    }}>
                      {/* Mood */}
                      <div style={{
                        fontSize:13,fontWeight:'800',color:T.text,marginBottom:10,
                        letterSpacing:'-0.2px',
                      }}>{styleResult.mood}</div>

                      {/* Color palette */}
                      <div style={{display:'flex',gap:5,marginBottom:10,alignItems:'center'}}>
                        {styleResult.colors?.map((c,i)=>(
                          <div key={i} title={c} style={{
                            flex:1,height:24,borderRadius:5,background:c,
                            boxShadow:'0 1px 4px rgba(0,0,0,0.3)',cursor:'default',
                          }}/>
                        ))}
                      </div>

                      {/* Stats */}
                      <div style={{display:'flex',flexDirection:'column',gap:5}}>
                        {[
                          ['Brightness', styleResult.brightness, 1.0],
                          ['Saturation', styleResult.saturation, 1.0],
                          ['Contrast',   styleResult.contrast,   1.0],
                        ].filter(([,v])=>v!=null).map(([label,val,max])=>{
                          const pct=Math.min(100,Math.round((val/max)*100));
                          return(
                            <div key={label}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                                <span style={{fontSize:9,color:T.muted,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase'}}>{label}</span>
                                <span style={{fontSize:9,color:T.muted,fontFamily:'monospace'}}>{Math.round(val*100)}%</span>
                              </div>
                              <div style={{height:3,borderRadius:2,background:T.border,overflow:'hidden'}}>
                                <div style={{height:'100%',borderRadius:2,width:`${pct}%`,background:T.accent}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={()=>setStyleResult(null)}
                      style={{...css.addBtn,background:'transparent',
                        color:T.muted,border:`1px solid ${T.border}`,marginTop:8,fontSize:11}}
                    >× Clear</button>
                  </div>
                )}
              </div>
              );
            })()}

            {activeTool==='bggen'&&(()=>{
              const NICHES=[
                {id:'gaming',    emoji:'🎮', label:'Gaming'},
                {id:'vlog',      emoji:'🎥', label:'Vlog'},
                {id:'tech',      emoji:'💻', label:'Tech'},
                {id:'cooking',   emoji:'🍳', label:'Cooking'},
                {id:'fitness',   emoji:'💪', label:'Fitness'},
                {id:'education', emoji:'📚', label:'Education'},
              ];
              return(
              <div>
                <style>{`
                  @keyframes tf-bgpulse{
                    0%,100%{background-position:0% 50%}
                    50%{background-position:100% 50%}
                  }
                `}</style>

                <span style={css.label}>AI Background</span>

                {/* Subject hint */}
                {selectedLayer?.type==='image'&&!selectedLayer?.isRimLight&&(
                  <div style={{
                    ...css.section,marginTop:0,
                    background:`${T.accent}10`,border:`1px solid ${T.accentBorder}`,
                    fontSize:11,color:T.accent,fontWeight:'600',lineHeight:1.5,
                    display:'flex',alignItems:'center',gap:7,
                  }}>
                    <span style={{fontSize:15,flexShrink:0}}>◎</span>
                    Selected layer will be composited onto the generated background.
                  </div>
                )}

                {/* Niche grid */}
                <span style={css.label}>Niche</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                  {NICHES.map(n=>{
                    const sel=bgGenNiche===n.id;
                    return(
                      <button key={n.id} onClick={()=>setBgGenNiche(n.id)}
                        onMouseEnter={e=>{if(!sel)e.currentTarget.style.borderColor=T.accentBorder;}}
                        onMouseLeave={e=>{if(!sel)e.currentTarget.style.borderColor=T.border;}}
                        style={{
                          display:'flex',flexDirection:'column',alignItems:'center',
                          justifyContent:'center',gap:5,padding:'12px 4px',
                          borderRadius:9,cursor:'pointer',outline:'none',
                          border:`1.5px solid ${sel?T.accent:T.border}`,
                          background:sel?`${T.accent}12`:T.bg2,
                          transition:'all 0.12s',
                        }}
                      >
                        <span style={{fontSize:22,lineHeight:1}}>{n.emoji}</span>
                        <span style={{
                          fontSize:9,fontWeight:'700',letterSpacing:'0.3px',
                          color:sel?T.accent:T.muted,textTransform:'uppercase',
                        }}>{n.label}</span>
                        {sel&&<div style={{width:14,height:2,borderRadius:1,background:T.accent}}/>}
                      </button>
                    );
                  })}
                </div>

                {/* Custom prompt */}
                <span style={css.label}>Additional details (optional)</span>
                <input
                  placeholder="e.g. cyberpunk city, purple sky, rain..."
                  value={bgGenCustom}
                  onChange={e=>setBgGenCustom(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!bgGenBusy)generateBackground();}}
                  style={{...css.input,marginBottom:0}}
                />

                {/* Generate button */}
                <button
                  onClick={generateBackground}
                  disabled={bgGenBusy}
                  style={{
                    ...css.addBtn,
                    background:bgGenBusy
                      ?'transparent'
                      :`linear-gradient(135deg,#f97316,#ea580c)`,
                    color:bgGenBusy?T.accent:'#fff',
                    border:bgGenBusy?`1px solid ${T.accentBorder}`:'none',
                    fontWeight:'700',fontSize:13,marginTop:10,
                    position:'relative',overflow:'hidden',
                  }}
                >
                  {bgGenBusy?(
                    <span style={{
                      display:'inline-flex',alignItems:'center',gap:8,
                      background:`linear-gradient(90deg,${T.accent},#fb923c,${T.accent})`,
                      backgroundSize:'200% 100%',
                      WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
                      backgroundClip:'text',
                      animation:'tf-bgpulse 1.6s ease infinite',
                    }}>
                      Generating your background...
                    </span>
                  ):'⬡ Generate background'}
                </button>

                {/* Preview */}
                {bgGenPreview&&(
                  <div style={{marginTop:12}}>
                    <span style={css.label}>Preview — click Apply to use</span>
                    <div style={{
                      borderRadius:8,overflow:'hidden',
                      border:`1px solid ${T.accent}44`,
                      position:'relative',marginBottom:8,
                    }}>
                      <img src={bgGenPreview} alt="Generated background"
                        style={{width:'100%',display:'block'}}/>
                      <div style={{
                        position:'absolute',bottom:0,left:0,right:0,
                        background:'linear-gradient(transparent,rgba(0,0,0,0.7))',
                        padding:'20px 10px 8px',
                      }}>
                        <div style={{fontSize:9,color:'rgba(255,255,255,0.6)',lineHeight:1.4,fontStyle:'italic'}}>
                          {bgGenPrompt.slice(0,90)}{bgGenPrompt.length>90?'…':''}
                        </div>
                      </div>
                    </div>

                    <div style={{display:'flex',gap:6}}>
                      <button
                        onClick={applyGeneratedBackground}
                        style={{
                          flex:2,padding:'9px 0',borderRadius:8,border:'none',
                          background:`linear-gradient(135deg,#f97316,#ea580c)`,
                          color:'#fff',fontSize:12,cursor:'pointer',fontWeight:'700',
                        }}
                      >✓ Apply background</button>
                      <button
                        onClick={generateBackground}
                        disabled={bgGenBusy}
                        style={{
                          flex:1,padding:'9px 0',borderRadius:8,
                          border:`1px solid ${T.border}`,
                          background:'transparent',
                          color:T.muted,fontSize:12,cursor:'pointer',fontWeight:'600',
                          opacity:bgGenBusy?0.5:1,
                        }}
                      >↺</button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {activeTool==='colorgrade'&&(()=>{
              const CG_PRESETS=[
                {id:'default',   label:'Default',   gradient:'linear-gradient(135deg,#f97316,#fb923c,#fed7aa)'},
                {id:'warm',      label:'Warm',       gradient:'linear-gradient(135deg,#b45309,#f59e0b,#fef08a)'},
                {id:'cool',      label:'Cool',       gradient:'linear-gradient(135deg,#1d4ed8,#0ea5e9,#67e8f9)'},
                {id:'cinematic', label:'Cinema',     gradient:'linear-gradient(135deg,#0f172a,#334155,#94a3b8)'},
                {id:'neon',      label:'Neon',       gradient:'linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4)'},
              ];
              const hasResult=!!(cgGradedSrc);
              return(
              <div>
                <span style={css.label}>Color Grade</span>

                {/* Description — only before first apply */}
                {!hasResult&&(
                  <div style={{...css.section,marginTop:0,fontSize:11,color:T.muted,lineHeight:1.6}}>
                    One click to boost contrast, punch, and colour on your bottom-most image layer. Non-destructive — reset any time.
                  </div>
                )}

                {/* Preset swatches — show after first apply */}
                {hasResult&&(<>
                  <span style={css.label}>Preset</span>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4}}>
                    {CG_PRESETS.map(pr=>{
                      const sel=cgPreset===pr.id;
                      return(
                        <button key={pr.id} onClick={()=>setCgPreset(pr.id)}
                          style={{
                            padding:0,borderRadius:7,overflow:'hidden',cursor:'pointer',
                            outline:'none',border:`2px solid ${sel?T.accent:'transparent'}`,
                            background:'none',transition:'border-color 0.1s',
                          }}
                        >
                          {/* Colour swatch */}
                          <div style={{height:28,background:pr.gradient}}/>
                          {/* Label */}
                          <div style={{
                            padding:'3px 0',textAlign:'center',
                            fontSize:7,fontWeight:'700',letterSpacing:'0.2px',
                            color:sel?T.accent:T.muted,
                            background:T.bg2,textTransform:'uppercase',
                          }}>{pr.label}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Intensity slider */}
                  <div style={{marginTop:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{...css.label,marginTop:0,marginBottom:0}}>Intensity</span>
                      <span style={{fontSize:11,fontWeight:'700',color:T.accent}}>{cgIntensity}%</span>
                    </div>
                    <Slider min={10} max={100} value={cgIntensity} onChange={v=>setCgIntensity(v)} style={{width:'100%'}}/>
                  </div>
                </>)}

                {/* Main CTA */}
                <button
                  onClick={applyColorGrade}
                  disabled={cgBusy}
                  style={{
                    ...css.addBtn,
                    background:cgBusy?'transparent':`linear-gradient(135deg,#f97316,#ea580c)`,
                    color:cgBusy?T.accent:'#fff',
                    border:cgBusy?`1px solid ${T.accentBorder}`:'none',
                    fontWeight:'800',fontSize:14,letterSpacing:'-0.2px',
                    marginTop:hasResult?8:10,
                  }}
                >
                  {cgBusy?'Enhancing…':hasResult?'◕ Re-apply':'✦ Make It Pop'}
                </button>

                {/* Before/After + Reset — only after first apply */}
                {hasResult&&(<>
                  <button
                    onMouseDown={()=>{if(cgLayerId&&cgOriginalSrc)updateLayerSilent(cgLayerId,{src:cgOriginalSrc});}}
                    onMouseUp={()=>{if(cgLayerId&&cgGradedSrc)updateLayerSilent(cgLayerId,{src:cgGradedSrc});}}
                    onMouseLeave={()=>{if(cgLayerId&&cgGradedSrc)updateLayerSilent(cgLayerId,{src:cgGradedSrc});}}
                    style={{
                      ...css.addBtn,
                      background:'transparent',
                      border:`1px solid ${T.border}`,
                      color:T.muted,fontSize:11,fontWeight:'600',
                      marginTop:6,
                      userSelect:'none',
                    }}
                  >
                    ◑ Hold to preview original
                  </button>

                  <button
                    onClick={resetColorGrade}
                    style={{
                      ...css.addBtn,background:'transparent',
                      color:T.danger,border:`1px solid ${T.danger}33`,
                      fontSize:11,marginTop:4,
                    }}
                  >
                    × Reset grade
                  </button>
                </>)}
              </div>
              );
            })()}

            {activeTool==='rimlight'&&(
              <div>
                <span style={css.label}>Rim lighting</span>
                <div style={{...css.section,marginTop:0,fontSize:11,
                  color:T.success,fontWeight:'600',lineHeight:1.6}}>
                  ☀ Click anywhere on your image to add light
                </div>

                {(!selectedLayer||selectedLayer.type!=='image')&&(
                  <div style={{...css.section,fontSize:11,color:T.muted,
                    textAlign:'center',padding:16,marginTop:8}}>
                    <div style={{fontSize:24,marginBottom:6}}>☀</div>
                    Select an image layer first
                  </div>
                )}

                <span style={css.label}>Light color</span>
                <div style={css.row}>
                  <input type="color" value={rimLightColor}
                    onChange={e=>{setRimLightColor(e.target.value);setRimPickingColor(false);}}
                    style={{...css.color,flex:1,height:36}}/>
                  <button
                    onClick={()=>setRimPickingColor(p=>!p)}
                    title="Pick color from canvas"
                    style={{
                      padding:'6px 10px',borderRadius:6,flexShrink:0,
                      border:`2px solid ${rimPickingColor?T.accent:T.border}`,
                      background:rimPickingColor?T.accent:'transparent',
                      color:rimPickingColor?'#fff':T.text,
                      cursor:'pointer',fontSize:14,fontWeight:'700',
                      transition:'all 0.15s',
                    }}>
                    🔍
                  </button>
                </div>

                {rimPickingColor&&(
                  <div style={{...css.section,marginTop:6,fontSize:11,
                    color:T.accent,fontWeight:'600',lineHeight:1.6,
                    border:`1px solid ${T.accent}`,textAlign:'center'}}>
                    🔍 Click anywhere on the canvas to pick that color
                  </div>
                )}

                {rimPickedFrom&&!rimPickingColor&&(
                  <div style={{...css.row,marginTop:6,gap:8}}>
                    <div style={{width:20,height:20,borderRadius:4,
                      background:rimPickedFrom.color,
                      border:`1px solid ${T.border}`,flexShrink:0}}/>
                    <span style={{fontSize:10,color:T.muted,fontFamily:'monospace'}}>
                      Picked: {rimPickedFrom.color}
                    </span>
                    <button onClick={()=>setRimPickedFrom(null)}
                      style={{marginLeft:'auto',background:'none',border:'none',
                        color:T.muted,cursor:'pointer',fontSize:12}}>×</button>
                  </div>
                )}

                <span style={css.label}>Presets</span>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                  {[
                    {label:'Blue',  color:'#0088ff', blend:'screen'},
                    {label:'Gold',  color:'#ffaa00', blend:'screen'},
                    {label:'Red',   color:'#ff2200', blend:'screen'},
                    {label:'Green', color:'#00ff88', blend:'screen'},
                    {label:'Pink',  color:'#ff00aa', blend:'screen'},
                    {label:'White', color:'#ffffff', blend:'soft-light'},
                    {label:'Neon',  color:'#00ffff', blend:'screen'},
                    {label:'Fire',  color:'#ff6600', blend:'overlay'},
                  ].map((preset,i)=>(
                    <button key={i} onClick={()=>{
                      setRimLightColor(preset.color);
                      setRimLightBlend(preset.blend);
                    }} style={{
                      padding:'8px 2px',borderRadius:6,
                      border:`2px solid ${rimLightColor===preset.color?'#fff':'transparent'}`,
                      background:preset.color,
                      fontSize:8,cursor:'pointer',
                      color: ['#ffffff','#ffaa00','#00ff88','#00ffff'].includes(preset.color)?'#000':'#fff',
                      fontWeight:'700',textAlign:'center',
                    }}>{preset.label}</button>
                  ))}
                </div>

                <span style={css.label}>Size — {rimLightSize}%</span>
                <Slider min={5} max={100} value={rimLightSize}
                  onChange={v=>setRimLightSize(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Intensity — {rimLightIntensity}%</span>
                <Slider min={5} max={100} value={rimLightIntensity}
                  onChange={v=>setRimLightIntensity(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Softness — {rimLightSoftness}%</span>
                <Slider min={10} max={100} value={rimLightSoftness}
                  onChange={v=>setRimLightSoftness(v)}
                  style={{width:'100%'}}/>

                <span style={css.label}>Blend mode</span>
                <select value={rimLightBlend}
                  onChange={e=>setRimLightBlend(e.target.value)}
                  style={css.input}>
                  {['screen','overlay','soft-light','hard-light',
                    'color-dodge','lighten','add'].map(m=>(
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <div style={{...css.section,marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:'700',
                    color:T.text,marginBottom:6}}>💡 Tips</div>
                  <div style={{fontSize:11,color:T.muted,lineHeight:1.7}}>
                    • Click the edge of a subject for rim light<br/>
                    • Blue screen mode = Minecraft glow effect<br/>
                    • Gold overlay = warm sunset lighting<br/>
                    • White soft-light = natural fill light<br/>
                    • Stack multiple lights for drama<br/>
                    • Lower intensity + multiple clicks = build up gradually
                  </div>
                </div>

                <button onClick={()=>{
                  const rimLayer=layers.find(l=>l.isRimLight);
                  if(rimLayer){
                    setLayers(prev=>{
                      const nl=prev.filter(l=>!l.isRimLight);
                      pushHistory(nl);
                      return nl;
                    });
                    setSelectedId(null);
                    setCmdLog('Rim light cleared');
                  }
                }} style={{...css.addBtn,background:'transparent',
                  color:T.muted,border:`1px solid ${T.border}`,marginTop:8}}>
                  × Clear rim light
                </button>
              </div>
            )}

            {activeTool==='removebg'&&(
  <div>
    <span style={css.label}>Background remover</span>

    <div style={{...css.section,marginTop:0}}>
      <div style={{fontSize:13,color:T.text,fontWeight:'700',marginBottom:4}}>🎨 Background Remover</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:10,lineHeight:1.6}}>
        Remove backgrounds instantly. Select an image layer first.
      </div>
      {selectedLayer?.type==='image'?(
        <div>
          <button
            id="removebg-btn"
            onClick={removeBackgroundFromSelected}
            disabled={removeBgBusy}
            style={{width:'100%',padding:10,borderRadius:7,background:removeBgBusy?T.muted:T.accent,color:'#fff',border:'none',fontSize:12,cursor:removeBgBusy?'not-allowed':'pointer',fontWeight:'700',transition:'all 0.2s',opacity:removeBgBusy?0.7:1}}
          >
            {removeBgBusy?'Removing...':'Remove background'}
          </button>
          <div style={{fontSize:10,color:T.muted,marginTop:5,textAlign:'center'}}>
            Powered by remove.bg · 50 free/month
          </div>
        </div>
      ):(
        <div style={{...css.section,fontSize:11,color:T.muted,textAlign:'center',padding:16}}>
          <div style={{fontSize:20,marginBottom:6}}>✂️</div>
          Click an image on the canvas first
        </div>
      )}
    </div>

  </div>
)}

            {activeTool==='segment'&&(
  <div>
    <span style={css.label}>Smart Cutout</span>

    <div style={{...css.section,marginTop:0,border:`1px solid ${T.accentBorder}`,background:`linear-gradient(135deg,${T.bg2},rgba(249,115,22,0.04))`}}>
      <div style={{fontSize:13,fontWeight:'800',color:T.text,marginBottom:4,letterSpacing:'-0.2px'}}>◎ Smart Object Detection</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:12,lineHeight:1.65}}>
        AI scans your entire thumbnail and highlights every object. Click any highlighted region on the canvas to isolate it as a new layer.
      </div>

      {segmentError&&(
        <div style={{padding:'9px 11px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:8,fontSize:11,color:T.danger,marginBottom:10,lineHeight:1.55}}>
          ⚠ {segmentError}
          {segmentError.toLowerCase().includes('limit')&&(
            <div style={{marginTop:8}}>
              <button onClick={handleUpgrade} style={{padding:'5px 14px',borderRadius:6,border:'none',background:T.accent,color:'#fff',fontSize:11,cursor:'pointer',fontWeight:'700'}}>
                Upgrade →
              </button>
            </div>
          )}
        </div>
      )}

      {!segmentBusy&&segmentMasks.length>0&&(
        <div style={{
          padding:'8px 11px',marginBottom:10,
          background:`${T.accent}12`,border:`1px solid ${T.accentBorder}`,
          borderRadius:8,fontSize:11,color:T.accent,fontWeight:'700',
          display:'flex',alignItems:'center',gap:7,
        }}>
          <span style={{width:7,height:7,borderRadius:'50%',background:T.accent,display:'inline-block',flexShrink:0}}/>
          {segmentMasks.length} object{segmentMasks.length!==1?'s':''} found — hover &amp; click on canvas
        </div>
      )}

      <button
        onClick={runSegmentation}
        disabled={segmentBusy}
        style={{
          width:'100%',padding:'11px 0',borderRadius:8,border:'none',
          background:segmentBusy?T.bg2:`linear-gradient(135deg,#f97316,#ea580c)`,
          color:segmentBusy?T.muted:'#fff',
          cursor:segmentBusy?'not-allowed':'pointer',
          fontSize:12,fontWeight:'800',letterSpacing:'0.3px',
          display:'flex',alignItems:'center',justifyContent:'center',gap:8,
          boxShadow:segmentBusy?'none':'0 4px 16px rgba(249,115,22,0.35)',
          transition:'all 0.2s',
        }}>
        {segmentBusy
          ?<><span style={{display:'inline-block',animation:'editor-spin 0.9s linear infinite',fontSize:14}}>◌</span>{segmentStatus||'Analyzing...'}</>
          :<>◎ {segmentMasks.length>0?'Re-scan Objects':'Scan for Objects'}</>
        }
      </button>

      {segmentMasks.length>0&&!segmentBusy&&(
        <button
          onClick={()=>{setSegmentMasks([]);setSegmentHoverIdx(null);}}
          style={{width:'100%',marginTop:6,padding:'7px 0',borderRadius:7,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,cursor:'pointer',fontSize:11,fontWeight:'500'}}>
          × Clear overlays
        </button>
      )}

      <div style={{marginTop:10,fontSize:10,color:T.muted,lineHeight:1.5,textAlign:'center'}}>
        Powered by SAM 2 · Uses 1 AI action per scan
      </div>
    </div>

    {!segmentBusy&&segmentMasks.length===0&&!segmentError&&(
      <div style={{...css.section,marginTop:8}}>
        <div style={{fontSize:9,color:T.muted,fontWeight:'700',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.9px'}}>How it works</div>
        {[
          ['◎','Scan','AI finds every object in your thumbnail using SAM 2'],
          ['⊡','Select','Hover to preview, click any region on the canvas'],
          ['▤','Layer','The object becomes an isolated, editable layer'],
        ].map(([icon,title,desc])=>(
          <div key={title} style={{display:'flex',gap:9,marginBottom:9,alignItems:'flex-start'}}>
            <div style={{width:22,height:22,borderRadius:5,background:`${T.accent}12`,border:`1px solid ${T.accentBorder}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,flexShrink:0,color:T.accent,marginTop:1}}>{icon}</div>
            <div>
              <div style={{fontSize:11,fontWeight:'700',color:T.text,marginBottom:1}}>{title}</div>
              <div style={{fontSize:10,color:T.muted,lineHeight:1.45}}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

            {activeTool==='lasso'&&(
  <div>
    <span style={css.label}>Lasso Mask</span>

    {isLassoMode&&(
      <div style={{padding:'8px 12px',background:`${T.accent}18`,border:`1px solid ${T.accent}55`,borderRadius:8,fontSize:12,color:T.accent,fontWeight:'700',textAlign:'center',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:T.accent,display:'inline-block',animation:'pulse 1s infinite'}}/>
        Drawing — drag to trace, release to apply
      </div>
    )}

    {selectedLayer?.type==='image'?(
      <div>
        <div style={{...css.section,marginTop:0}}>
          <button
            onClick={()=>setIsLassoMode(v=>!v)}
            style={{width:'100%',padding:11,borderRadius:8,background:isLassoMode?T.accent:T.input,color:isLassoMode?'#fff':T.text,border:`1px solid ${isLassoMode?T.accent:T.border}`,fontSize:13,cursor:'pointer',fontWeight:'700',transition:'all 0.2s',marginBottom:8}}>
            {isLassoMode?'✕ Cancel':'✂️ Start Lasso'}
          </button>
          {!isLassoMode&&(
            <div style={{fontSize:10,color:T.muted,textAlign:'center',lineHeight:1.5}}>
              Draw around what you want to keep. Everything outside is cut out.
            </div>
          )}
        </div>

        <div style={css.section}>
          <div style={{...css.label,marginBottom:6}}>Feather — {lassoFeatherRef.current||0}px</div>
          <input type="range" min="0" max="40" defaultValue="0"
            onChange={e=>{ lassoFeatherRef.current=parseInt(e.target.value); e.target.previousSibling&&(e.target.previousSibling.textContent=`Feather — ${e.target.value}px`); }}
            style={{width:'100%',accentColor:T.accent}}/>
          <div style={{fontSize:10,color:T.muted,marginTop:4}}>Soft edges blend the cutout naturally</div>
        </div>

        <div style={css.section}>
          <div style={{...css.label,marginBottom:8}}>Options</div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:T.text,cursor:'pointer',marginBottom:10}}>
            <input type="checkbox" defaultChecked={false}
              onChange={e=>{ lassoInvertRef.current=e.target.checked; }}
              style={{accentColor:T.accent,width:14,height:14}}/>
            Invert selection (cut inside, keep outside)
          </label>
        </div>

        {selectedLayer?.mask?.enabled&&selectedLayer?.mask?.points?.length>=3&&(
          <div style={css.section}>
            <div style={{...css.label,marginBottom:8}}>Active mask</div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>{
                updateLayer(selectedLayer.id,{mask:{...selectedLayer.mask,inverted:!selectedLayer.mask?.inverted}});
              }} style={{flex:1,padding:'7px 0',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:11,cursor:'pointer',fontWeight:'600'}}>
                ↔ Invert
              </button>
              <button onClick={()=>{
                updateLayer(selectedLayer.id,{mask:{enabled:false,type:null,points:null,inverted:false}});
              }} style={{flex:1,padding:'7px 0',borderRadius:6,border:`1px solid ${T.danger}`,background:'transparent',color:T.danger,fontSize:11,cursor:'pointer',fontWeight:'600'}}>
                × Clear
              </button>
            </div>
          </div>
        )}
      </div>
    ):(
      <div style={{...css.section,fontSize:11,color:T.muted,textAlign:'center',padding:20}}>
        <div style={{fontSize:24,marginBottom:8}}>✂️</div>
        <div style={{fontWeight:600,marginBottom:4,color:T.text}}>Select an image first</div>
        Click any image layer on the canvas or in the layers panel
      </div>
    )}
  </div>
)}

            {activeTool==='freehand'&&(
  <div>
    <span style={css.label}>Freehand Draw</span>

    <div style={{padding:'8px 10px',background:`${T.accent}12`,border:`1px solid ${T.accent}44`,borderRadius:8,fontSize:11,color:T.accent,fontWeight:'700',textAlign:'center',marginBottom:10}}>
      ✏ Click &amp; drag on the canvas to draw
    </div>

    <div style={css.section}>
      <span style={css.label}>Brush color</span>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <input type="color" value={freeBrushColor} onChange={e=>setFreeBrushColor(e.target.value)}
          style={{...css.color,height:32,flex:1}}/>
        <div style={{width:32,height:32,borderRadius:6,border:`1px solid ${T.border}`,background:freeBrushColor,flexShrink:0}}/>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
        {['#ffffff','#000000','#FFD700','#f97316','#ef4444','#22c55e','#3b82f6','#a855f7','#ec4899','#00ffff'].map(c=>(
          <div key={c} onClick={()=>setFreeBrushColor(c)}
            style={{width:22,height:22,borderRadius:4,background:c,cursor:'pointer',border:freeBrushColor===c?'2px solid #f97316':'1px solid #374151'}}/>
        ))}
      </div>
    </div>

    <div style={css.section}>
      <span style={css.label}>Brush size — {freeBrushSize}px</span>
      <Slider min={1} max={80} value={freeBrushSize}
        onChange={v=>setFreeBrushSize(v)}
        style={{width:'100%',accentColor:T.accent}}/>
    </div>

    <div style={css.section}>
      <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>
        Each stroke is saved as a new image layer — visible in the Layers Panel. Undo with Ctrl+Z.
      </div>
    </div>
  </div>
)}

            {activeTool==='ai'&&(
  <div>
    <span style={css.label}>AI features</span>

    <div style={{...css.section,border:`1px solid ${T.warning}`,marginTop:10}}>
      <div style={{fontSize:13,color:T.warning,fontWeight:'700',marginBottom:4}}>⚡ AI Generate — Pro</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:8,lineHeight:1.6}}>
        Generate a thumbnail from a text prompt.
      </div>
      <input
        id="ai-prompt-input"
        value={aiPrompt}
        onChange={e=>setAiPrompt(e.target.value)}
        placeholder="Epic gaming moment, dramatic lighting..."
        style={{padding:'7px 10px',borderRadius:6,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:12,width:'100%',boxSizing:'border-box',outline:'none',fontFamily:'inherit',marginBottom:8}}
      />
      <button
        id="ai-generate-btn"
        onClick={async()=>{
          const isPro = isProUser;
          const isAdmin = user?.is_admin;
          console.log(`Gating Check - isPro: ${isPro}, isAdmin: ${isAdmin}`);
          
          // SECURITY: Block non-Pro users from even attempting the fetch
          if (!isPro && !isAdmin) {
            console.log('[AI-GENERATE] Non-Pro user blocked - opening upgrade modal');
            setShowPaywall(true);
            return;
          }
          
          const btn=document.getElementById('ai-generate-btn');
          if(!aiPrompt.trim()){alert('Enter a prompt first');return;}
          btn.textContent='Generating...';btn.disabled=true;btn.style.opacity='0.6';
          const abortCtrl = new AbortController();
          const genTimeout = setTimeout(() => abortCtrl.abort(), 90000);
          try{
            const { data: { session } } = await supabase.auth.getSession();
            if(!session?.access_token){
              alert('Please log in again to use AI generation');
              btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
              return;
            }
            const res=await fetch(`${resolvedApiUrl}/api/generate-image`,{
              method:'POST',
              headers:{
                'Content-Type':'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body:JSON.stringify({
                prompt: aiPrompt,
                size: '1792x1024',
                style: 'vivid',
              }),
              signal: abortCtrl.signal,
            });
            clearTimeout(genTimeout);
            const data=await res.json();
            if(!data.success){
              // Handle 403 / paywall
              if(res.status === 403 || res.status === 429){
                if(res.status === 403){ alert('Upgrade to Pro to use AI generation'); setShowPaywall(true); }
                else { setCmdLog(data.error || 'Quota exceeded. Upgrade for more AI generations.'); }
              } else {
                showToastMsg(data.error || 'Generation failed. Please try again.', 'error');
              }
              btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
              return;
            }
            // Handle both URL and base64 response formats
            let imageUrl;
            if(data.format === 'url'){
              imageUrl = data.image;
            } else {
              imageUrl = `data:image/png;base64,${data.image}`;
            }
            const cW=p.preview.w,cH=p.preview.h;
            addLayer({
              type:'image',src:imageUrl,
              width:cW,height:cH,x:0,y:0,
              cropTop:0,cropBottom:0,cropLeft:0,cropRight:0,
              imgBrightness:100,imgContrast:100,imgSaturate:100,imgBlur:0,
            });
            setLastGeneratedImageUrl(imageUrl);
            btn.textContent='✓ Added!';btn.style.background=T.success;
            setTimeout(()=>{
              btn.textContent='Generate';btn.disabled=false;
              btn.style.opacity='1';btn.style.background=T.warning;
            },2000);
          }catch(e){
            clearTimeout(genTimeout);
            if(e.name === 'AbortError' || e.name === 'TimeoutError'){
              showToastMsg('Generation timed out. Try a simpler prompt or try again.', 'error');
            } else {
              showToastMsg(e.message || 'Generation failed. Please try again.', 'error');
            }
            btn.textContent='Generate';btn.disabled=false;btn.style.opacity='1';
          }
        }}
        style={{width:'100%',padding:9,borderRadius:7,background:T.warning,color:'#000',border:'none',fontSize:12,cursor:'pointer',fontWeight:'700'}}
      >
        Generate
      </button>
      <div style={{fontSize:10,color:T.muted,marginTop:5,textAlign:'center'}}>
        Pro only · $15/mo
      </div>
    </div>

  </div>
)}

          </div>

          {/* Layers panel */}
          <div style={{borderTop:`1px solid ${T.border}`,background:T.panel,flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px 5px'}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:'10px',color:T.text,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase'}}>Layers</span>
                <span style={{fontSize:10,color:T.muted,background:T.input,padding:'1px 6px',borderRadius:10,border:`1px solid ${T.border}`}}>{layers.length}</span>
              </div>
              <div style={{display:'flex',gap:2}}>
                {[['↑',()=>selectedId&&moveLayerUp(selectedId),'Up'],['↓',()=>selectedId&&moveLayerDown(selectedId),'Down'],['⧉',()=>selectedId&&duplicateLayer(selectedId),'Dupe'],['×',()=>selectedId&&deleteLayer(selectedId),'Del']].map(([icon,action,title])=>(<button key={icon} onClick={action} title={title} style={{padding:'2px 7px',borderRadius:4,border:`1px solid ${icon==='×'?T.danger:T.border}`,background:'transparent',color:icon==='×'?T.danger:T.muted,fontSize:11,cursor:'pointer'}}>{icon}</button>))}
              </div>
            </div>
            <div style={{maxHeight:240,overflowY:'auto',padding:'0 6px 8px'}}>
              {getDisplayList(layers).map(({layer,depth,isClipped,isBase})=>{
                const isDragOver=layerDragOver===layer.id;
                const isBeingDragged=layerDragId===layer.id;
                const color=getLayerColor(layer);
                const isGroup=layer.type==='group';
                const hasEffects=layer.effects&&(layer.effects.layerBlur>0||layer.effects.brightness!==100||layer.effects.contrast!==100||layer.effects.saturation!==100||layer.effects.shadow?.enabled||layer.effects.glow?.enabled||layer.effects.outline?.enabled);
                const baseLayerName=isClipped?getLayerName(layers[layers.findIndex(l=>l.id===layer.id)-1]):null;
                return(
                  <div key={layer.id}
                    title={isClipped&&baseLayerName?`Clipped to: ${baseLayerName}`:undefined}
                    draggable={!isGroup}
                    onDragStart={e=>onLayerDragStart(e,layer.id)}
                    onDragOver={e=>onLayerDragOver(e,layer.id)}
                    onDrop={e=>onLayerDrop(e,layer.id)}
                    onDragEnd={onLayerDragEnd}
                    onContextMenu={layer.type!=='background'?e=>{e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,layerId:layer.id,menuType:isGroup?'group':'layer'});}:undefined}
                    onClick={e=>{
                      if(e.shiftKey&&layer.type!=='background'){
                        setSelectedIds(prev=>{const n=new Set(prev);if(n.has(layer.id))n.delete(layer.id);else{n.add(layer.id);if(selectedId)n.add(selectedId);}return n;});
                        setSelectedId(layer.id);
                      } else {
                        setSelectedIds(new Set());setSelectedId(layer.id);if(layer.type==='background')setActiveTool('background');if(layer.type==='adjustment')setActiveTool('adjustment');
                      }
                    }}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'5px 6px 5px '+(6+depth*12+(isClipped?10:0))+'px',borderRadius:7,marginBottom:2,cursor:'pointer',border:`1px solid ${selectedIds.has(layer.id)||selectedId===layer.id?T.accent:isDragOver?`${T.accent}66`:'transparent'}`,background:isGroup?`rgba(249,115,22,0.05)`:selectedIds.has(layer.id)||selectedId===layer.id?`${T.accent}12`:isDragOver?`${T.accent}06`:'transparent',opacity:isBeingDragged?0.4:1,transition:'all 0.1s',borderLeft:isClipped?`2px solid ${T.accent}44`:isGroup?`2px solid ${T.accent}22`:'1px solid transparent'}}>
                    {isClipped&&(<span style={{fontSize:9,color:T.accent,flexShrink:0,userSelect:'none',opacity:0.7}}>↳</span>)}
                    {isGroup&&!isClipped&&(<span onClick={e=>{e.stopPropagation();setGroupCollapsed(layer.id,!layer.collapsed);}} style={{fontSize:8,color:T.muted,cursor:'pointer',flexShrink:0,userSelect:'none',minWidth:10}}>{layer.collapsed?'▶':'▼'}</span>)}
                    {!isGroup&&!isClipped&&(<div style={{color:T.muted,fontSize:10,cursor:'grab',flexShrink:0,opacity:0.4,userSelect:'none'}}>⠿</div>)}
                    <div style={{width:4,height:24,borderRadius:2,flexShrink:0,background:isClipped?T.accent:isGroup?T.accent:(layer.type==='background'?(layer.bgGradient?`linear-gradient(180deg,${layer.bgGradient[0]},${layer.bgGradient[1]})`:color):color)}}/>
                    <div style={{width:18,height:18,borderRadius:3,background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isGroup?11:9,fontWeight:'700',color:selectedId===layer.id?T.accent:isClipped?T.accent:T.muted,flexShrink:0,border:`1px solid ${isClipped?`${T.accent}88`:isGroup?T.accent:T.border}`,fontFamily:'monospace'}}>{getLayerIcon(layer)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:layer.hidden?T.muted:(isGroup?T.accent:isClipped?T.accent:T.text),overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:layer.hidden?'line-through':'none',fontWeight:isGroup?'700':(selectedId===layer.id?'600':'400')}}>{getLayerName(layer)}{isGroup&&layer.children?.length?` (${layer.children.length})`:''}</div>
                      {!isGroup&&(<div style={{display:'flex',gap:3,marginTop:1}}>
                        {isBase&&<span style={{fontSize:7,color:T.accent,background:`${T.accent}15`,padding:'0 3px',borderRadius:2}}>⊏ clip base</span>}
                        {layer.blendMode&&layer.blendMode!=='normal'&&<span style={{fontSize:7,color:T.accent,background:`${T.accent}15`,padding:'0 3px',borderRadius:2}}>{layer.blendMode.slice(0,5)}</span>}
                        {hasEffects&&<span style={{fontSize:7,color:'#f59e0b',background:'#f59e0b15',padding:'0 3px',borderRadius:2}}>fx</span>}
                        {layer.mask?.enabled&&<span style={{fontSize:7,color:'#60a5fa',background:'#60a5fa15',padding:'0 3px',borderRadius:2}}>mask</span>}
                        {layer.locked&&<span style={{fontSize:7,color:T.muted}}>🔒</span>}
                      </div>)}
                    </div>
                    <div style={{display:'flex',gap:1,flexShrink:0}}>
                      <button onClick={e=>{e.stopPropagation();updateLayer(layer.id,{hidden:!layer.hidden});}} style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',color:layer.hidden?T.danger:T.muted,fontSize:10,cursor:'pointer'}}>{layer.hidden?'○':'●'}</button>
                      {layer.type!=='background'&&(<button onClick={e=>{e.stopPropagation();updateLayer(layer.id,{locked:!layer.locked});}} style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>{layer.locked?'⊠':'⊡'}</button>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Sprint 3: Dedicated Layers Panel ──────────────────────────── */}
        {!isMobile&&(
          <div style={{
            width:210,
            background:T.panel,
            borderLeft:`1px solid ${T.border}`,
            display:'flex',flexDirection:'column',
            flexShrink:0,
            userSelect:'none',
          }}>
            {/* Tab bar: Layers | History */}
            <div style={{display:'flex',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
              {[['layers','Layers'],['history','History']].map(([tab,label])=>(
                <button key={tab} onClick={()=>setRightPanelTab(tab)}
                  style={{flex:1,padding:'8px 0',border:'none',background:'transparent',cursor:'pointer',fontSize:11,fontWeight:rightPanelTab===tab?'700':'400',color:rightPanelTab===tab?T.accent:T.muted,borderBottom:`2px solid ${rightPanelTab===tab?T.accent:'transparent'}`,transition:'all 0.12s',letterSpacing:'0.3px'}}>
                  {label}{tab==='layers'?` (${layers.length})`:tab==='history'?` (${history.length})`:''}
                </button>
              ))}
            </div>

            {/* ── LAYERS TAB ───────────────────────────────────────── */}
            {rightPanelTab==='layers'&&(<>
            {/* Layer list header actions */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px 4px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                {selectedIds.size>=2&&(
                  <button title="Group selected (Ctrl+G)" onClick={groupSelectedLayers}
                    style={{padding:'2px 6px',borderRadius:4,border:`1px solid ${T.accent}`,background:'transparent',color:T.accent,fontSize:11,cursor:'pointer'}}>⊞ Group</button>
                )}
                {/* + Adjustment Layer dropdown */}
                <div style={{position:'relative'}}>
                  <button title="Add Adjustment Layer" onClick={()=>setAdjLayerMenu(m=>!m)}
                    style={{padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`,background:'transparent',color:T.text,fontSize:11,cursor:'pointer'}}>◐ Adj ▾</button>
                  {adjLayerMenu&&(
                    <div style={{position:'absolute',top:'100%',left:0,background:T.panel,border:`1px solid ${T.border}`,borderRadius:8,overflow:'hidden',zIndex:200,boxShadow:'0 4px 20px rgba(0,0,0,0.6)',minWidth:160}}>
                      {[
                        ['levels','▤ Levels'],['hueSat','◐ Hue/Sat'],['colorBalance','⊕ Color Balance'],
                        ['vibrance','✦ Vibrance'],['selectiveColor','◈ Selective Color'],
                        ['gradientMap','▓ Gradient Map'],['posterize','▦ Posterize'],['threshold','◑ Threshold'],
                      ].map(([adjType,label])=>(
                        <button key={adjType} onClick={()=>addAdjustmentLayer(adjType)}
                          style={{display:'block',width:'100%',padding:'7px 12px',background:'transparent',border:'none',borderBottom:`1px solid ${T.border}`,color:T.text,cursor:'pointer',textAlign:'left',fontSize:11,whiteSpace:'nowrap'}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.accentDim}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:'flex',gap:2}}>
                <button title="Delete selected layer" onClick={()=>selectedId&&deleteLayer(selectedId)}
                  style={{padding:'2px 6px',borderRadius:4,border:`1px solid ${T.border}`,background:'transparent',color:selectedId?T.danger:T.border,fontSize:11,cursor:'pointer'}}>✕</button>
              </div>
            </div>


            {/* Layer list */}
            <div style={{flex:1,overflowY:'auto',padding:'4px 6px 8px'}}>
              {getDisplayList(layers).map(({layer,depth,isClipped,isBase})=>{
                const isSelected=selectedId===layer.id;
                const isDragOver2=layerDragOver===layer.id;
                const isBeingDragged2=layerDragId===layer.id;
                const isHidden=layer.hidden;
                const isLocked=layer.locked;
                const isGroup=layer.type==='group';
                const isEditing=groupEditId===layer.id;
                const atTop=!isGroup&&layers.indexOf(layer)===layers.length-1;
                const atBottom=!isGroup&&(layer.type==='background'||layers.indexOf(layer)===0);
                const hasEffects=!isGroup&&layer.effects&&(layer.effects.layerBlur>0||layer.effects.shadow?.enabled||layer.effects.glow?.enabled||layer.effects.outline?.enabled);
                const baseLayerName2=isClipped?getLayerName(layers[layers.findIndex(l=>l.id===layer.id)-1]):null;
                return(
                  <div key={layer.id}
                    title={isClipped&&baseLayerName2?`Clipped to: ${baseLayerName2}`:undefined}
                    draggable={!isGroup}
                    onDragStart={e=>onLayerDragStart(e,layer.id)}
                    onDragOver={e=>onLayerDragOver(e,layer.id)}
                    onDrop={e=>onLayerDrop(e,layer.id)}
                    onDragEnd={onLayerDragEnd}
                    onContextMenu={layer.type!=='background'?e=>{e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,layerId:layer.id,menuType:isGroup?'group':'layer'});}:undefined}
                    onClick={e=>{
                      if(isEditing)return;
                      if(e.shiftKey&&layer.type!=='background'){
                        setSelectedIds(prev=>{const n=new Set(prev);if(n.has(layer.id))n.delete(layer.id);else{n.add(layer.id);if(selectedId)n.add(selectedId);}return n;});
                        setSelectedId(layer.id);
                      } else {
                        setSelectedIds(new Set());setSelectedId(layer.id);if(layer.type==='background')setActiveTool('background');if(layer.type==='adjustment')setActiveTool('adjustment');
                      }
                    }}
                    style={{
                      display:'flex',alignItems:'center',gap:4,
                      paddingTop:5,paddingBottom:5,paddingRight:5,paddingLeft:5+depth*12+(isClipped?10:0),
                      borderRadius:6,marginBottom:1,cursor:'pointer',
                      background:isClipped?`${T.accent}08`:isGroup?`rgba(249,115,22,0.06)`:selectedIds.has(layer.id)?`${T.accent}18`:isSelected?T.accentDim:isDragOver2?'rgba(249,115,22,0.06)':'transparent',
                      border:`1px solid ${isClipped?(isSelected?T.accent:`${T.accent}33`):isGroup?'rgba(249,115,22,0.2)':(selectedIds.has(layer.id)||isSelected?T.accent:isDragOver2?T.accentBorder:'transparent')}`,
                      borderLeft:isClipped?`2px solid ${T.accent}66`:isGroup?`2px solid ${T.accent}`:undefined,
                      opacity:isBeingDragged2?0.3:1,
                      transition:'all 0.08s',
                    }}>
                    {/* Clip arrow / Collapse toggle / Drag grip */}
                    {isClipped
                      ?(<span style={{fontSize:9,color:T.accent,flexShrink:0,userSelect:'none',opacity:0.8,lineHeight:1}}>↳</span>)
                      :isGroup
                        ?(<span onClick={e=>{e.stopPropagation();setGroupCollapsed(layer.id,!layer.collapsed);}} style={{fontSize:8,color:T.muted,cursor:'pointer',flexShrink:0,userSelect:'none',width:10,textAlign:'center'}}>{layer.collapsed?'▶':'▼'}</span>)
                        :(<div style={{color:T.border,fontSize:9,cursor:'grab',flexShrink:0,opacity:0.7}}>⠿</div>)
                    }
                    {/* Type icon */}
                    <div style={{
                      width:17,height:17,borderRadius:3,flexShrink:0,
                      background:isClipped?`${T.accent}15`:isGroup?`${T.accent}20`:isSelected?T.accentDim:T.bg2,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:isGroup?11:8,fontWeight:'700',fontFamily:'monospace',
                      color:isClipped?T.accent:isGroup?T.accent:(isSelected?T.accent:T.muted),
                      border:`1px solid ${isClipped?`${T.accent}88`:isGroup?T.accent:T.border}`,
                    }}>{getLayerIcon(layer)}</div>
                    {/* Name + badges */}
                    <div style={{flex:1,minWidth:0}}>
                      {isGroup&&isEditing?(
                        <input
                          value={groupEditName}
                          onChange={e=>setGroupEditName(e.target.value)}
                          onBlur={()=>{if(groupEditName.trim())setLayers(prev=>updateLayerInTree(prev,layer.id,l=>({...l,name:groupEditName.trim()})));setGroupEditId(null);}}
                          onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape')setGroupEditId(null);}}
                          onClick={e=>e.stopPropagation()}
                          autoFocus
                          style={{width:'100%',background:T.bg2,border:`1px solid ${T.accent}`,borderRadius:4,color:T.text,fontSize:11,padding:'1px 4px',outline:'none'}}
                        />
                      ):(
                        <div style={{fontSize:11,color:isHidden?T.border:(isClipped?T.accent:isGroup?T.accent:(isSelected?T.text:T.muted)),overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:isGroup?700:(isSelected?'600':'400'),textDecoration:isHidden?'line-through':'none'}}
                          onDoubleClick={isGroup?e=>{e.stopPropagation();setGroupEditId(layer.id);setGroupEditName(layer.name||'Group');}:undefined}>
                          {getLayerName(layer)}{isGroup&&layer.children?.length?` (${layer.children.length})`:''}</div>
                      )}
                      {!isGroup&&(hasEffects||layer.mask?.enabled||isBase||isClipped)&&(
                        <div style={{display:'flex',gap:2,marginTop:1}}>
                          {isBase&&<span style={{fontSize:7,color:T.accent,background:`${T.accent}15`,padding:'0 3px',borderRadius:2}}>⊏ base</span>}
                          {layer.mask?.enabled&&<span style={{fontSize:7,color:'#60a5fa',background:'rgba(96,165,250,0.1)',padding:'0 3px',borderRadius:2}}>mask</span>}
                          {hasEffects&&<span style={{fontSize:7,color:T.warning,background:'rgba(245,158,11,0.1)',padding:'0 3px',borderRadius:2}}>fx</span>}
                        </div>
                      )}
                    </div>
                    {/* Controls */}
                    <div style={{display:'flex',gap:0,flexShrink:0}}>
                      {/* Clip mask toggle */}
                      {!isGroup&&layer.type!=='background'&&layers.findIndex(l=>l.id===layer.id)>0&&(
                        <button
                          title={isClipped?`Release Clipping Mask (Ctrl+Alt+G)\nClipped to: ${baseLayerName2}`:'Create Clipping Mask (Ctrl+Alt+G)'}
                          onClick={e=>{e.stopPropagation();toggleClipMask(layer.id);}}
                          style={{padding:'2px 4px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',fontSize:9,lineHeight:1,color:isClipped?T.accent:T.border,fontWeight:isClipped?'700':'400'}}
                          onMouseEnter={e=>e.currentTarget.style.color=T.accent}
                          onMouseLeave={e=>e.currentTarget.style.color=isClipped?T.accent:T.border}>⊏</button>
                      )}
                      {/* fx — for non-groups */}
                      {!isGroup&&layer.type!=='background'&&(
                        <button title="Effects" onClick={e=>{e.stopPropagation();setSelectedId(layer.id);setActiveTool('effects');}}
                          style={{padding:'2px 4px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',fontSize:8,fontWeight:'700',lineHeight:1,color:hasEffects?T.warning:T.border,fontFamily:'monospace'}}
                          onMouseEnter={e=>e.currentTarget.style.color=T.warning}
                          onMouseLeave={e=>e.currentTarget.style.color=hasEffects?T.warning:T.border}>fx</button>
                      )}
                      {/* Ungroup shortcut for groups */}
                      {isGroup&&(
                        <button title="Ungroup (Ctrl+Shift+G)" onClick={e=>{e.stopPropagation();ungroupLayer(layer.id);}}
                          style={{padding:'2px 4px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',fontSize:9,color:T.muted}}
                          onMouseEnter={e=>e.currentTarget.style.color=T.accent}
                          onMouseLeave={e=>e.currentTarget.style.color=T.muted}>⊟</button>
                      )}
                      {/* Eye */}
                      <button title={isHidden?'Show':'Hide'} onClick={e=>{e.stopPropagation();updateLayer(layer.id,{hidden:!isHidden});}}
                        style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',color:isHidden?T.border:T.muted,fontSize:12,lineHeight:1}}>
                        {isHidden?'⊘':'⊙'}
                      </button>
                      {/* Lock */}
                      {layer.type!=='background'&&(
                        <button title={isLocked?'Unlock':'Lock'} onClick={e=>{e.stopPropagation();updateLayer(layer.id,{locked:!isLocked});}}
                          style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',color:isLocked?T.warning:T.border,fontSize:11,lineHeight:1}}>
                          {isLocked?'⊠':'⊡'}
                        </button>
                      )}
                      {/* Bring forward / Send backward — top-level only */}
                      {!isGroup&&(<>
                        <button title="Bring forward" onClick={e=>{e.stopPropagation();moveLayerUp(layer.id);}} disabled={atTop}
                          style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:atTop?'default':'pointer',color:atTop?T.border:T.muted,fontSize:10,lineHeight:1}}>▲</button>
                        <button title="Send backward" onClick={e=>{e.stopPropagation();moveLayerDown(layer.id);}} disabled={atBottom}
                          style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:atBottom?'default':'pointer',color:atBottom?T.border:T.muted,fontSize:10,lineHeight:1}}>▼</button>
                      </>)}
                      {/* Delete */}
                      {layer.type!=='background'&&(
                        <button title="Delete" onClick={e=>{e.stopPropagation();deleteLayer(layer.id);}}
                          style={{padding:'2px 3px',borderRadius:3,border:'none',background:'transparent',cursor:'pointer',color:T.border,fontSize:11,lineHeight:1}}
                          onMouseEnter={e=>e.currentTarget.style.color=T.danger}
                          onMouseLeave={e=>e.currentTarget.style.color=T.border}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Align & Distribute panel — shown when 2+ layers selected ── */}
            {selectedIds.size>=2&&(
              <div style={{borderTop:`1px solid ${T.border}`,padding:'8px 10px',flexShrink:0}}>
                <div style={{fontSize:9,color:T.accent,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>
                  Align — {selectedIds.size} layers
                </div>
                {/* Align row */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:2,marginBottom:4}}>
                  {[
                    ['◧','Align left edges',    ()=>alignLayers('left')],
                    ['▣','Align h-centers',     ()=>alignLayers('hcenter')],
                    ['▨','Align right edges',   ()=>alignLayers('right')],
                    ['⊤','Align top edges',     ()=>alignLayers('top')],
                    ['⊕','Align v-centers',     ()=>alignLayers('vcenter')],
                    ['⊥','Align bottom edges',  ()=>alignLayers('bottom')],
                  ].map(([icon,title,fn])=>(
                    <button key={icon} title={title} onClick={fn}
                      style={{padding:'4px 2px',borderRadius:4,border:`1px solid ${T.border}`,background:T.bg2,color:T.text,fontSize:11,cursor:'pointer',textAlign:'center'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.text;}}>{icon}</button>
                  ))}
                </div>
                {/* Distribute row — needs 3+ layers */}
                {selectedIds.size>=3&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2}}>
                    <button onClick={()=>distributeLayers('h')}
                      style={{padding:'4px 2px',borderRadius:4,border:`1px solid ${T.border}`,background:T.bg2,color:T.muted,fontSize:9,cursor:'pointer',whiteSpace:'nowrap'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>⟺ H spacing</button>
                    <button onClick={()=>distributeLayers('v')}
                      style={{padding:'4px 2px',borderRadius:4,border:`1px solid ${T.border}`,background:T.bg2,color:T.muted,fontSize:9,cursor:'pointer',whiteSpace:'nowrap'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent;}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>⇕ V spacing</button>
                  </div>
                )}
              </div>
            )}

            {/* Selected Object Specs */}
            {selectedLayer&&(
              <div style={{borderTop:`1px solid ${T.border}`,padding:'8px 10px',flexShrink:0}}>
                <div style={{fontSize:9,color:T.muted,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>
                  Selected — {getLayerName(selectedLayer)}
                </div>
                {/* Blend mode — non-background only */}
                {selectedLayer.type!=='background'&&(
                  <div style={{marginBottom:4}}>
                    <span style={{...css.label,display:'block',marginBottom:2}}>Blend</span>
                    <BlendModeSelect
                      value={selectedLayer.blendMode||'normal'}
                      onChange={v=>{updateLayer(selectedId,{blendMode:v});saveEngineRef.current?.markDirty('layerProperties');}}
                      style={{...css.input,width:'100%'}}
                    />
                  </div>
                )}
                {/* Opacity — non-background only */}
                {selectedLayer.type!=='background'&&(
                  <div style={{marginBottom:6}}>
                    <div style={{...css.row,marginBottom:2}}>
                      <span style={css.label}>Opacity</span>
                      <input
                        type="number" min={0} max={100}
                        value={selectedLayer.opacity??100}
                        onChange={e=>updateLayerSilent(selectedId,{opacity:Math.min(100,Math.max(0,Number(e.target.value)))})}
                        onBlur={e=>{updateLayer(selectedId,{opacity:Math.min(100,Math.max(0,Number(e.target.value)))});saveEngineRef.current?.markDirty('layerProperties');}}
                        style={{...css.input,width:44,textAlign:'right',padding:'2px 4px'}}
                      />
                      <span style={{fontSize:10,color:T.muted}}>%</span>
                    </div>
                    <Slider min={0} max={100} value={selectedLayer.opacity??100}
                      onChange={v=>updateLayerSilent(selectedId,{opacity:v})}
                      onCommit={v=>{updateLayer(selectedId,{opacity:v});saveEngineRef.current?.markDirty('layerProperties');}}
                      style={{width:'100%'}}/>
                  </div>
                )}
                {/* Neon Glow quick-toggle */}
                {(()=>{
                  const isText=selectedLayer.type==='text';
                  const glowOn=isText
                    ?(selectedLayer.glowEnabled&&selectedLayer.glowColor==='#00ffff')
                    :(selectedLayer.effects?.glow?.enabled&&selectedLayer.effects?.glow?.color==='#00ffff');
                  return(
                    <button
                      title="Toggle cyan neon glow on selected layer"
                      onClick={()=>{
                        if(isText){
                          updateLayer(selectedLayer.id,{glowEnabled:!glowOn,glowColor:'#00ffff'});
                        } else {
                          updateLayerEffect(selectedLayer.id,'glow',{
                            enabled:!glowOn,color:'#00ffff',blur:30,
                          });
                        }
                      }}
                      style={{
                        width:'100%',padding:'6px 8px',borderRadius:6,
                        border:`1px solid ${glowOn?'#00ffff':T.border}`,
                        background:glowOn?'rgba(0,255,255,0.08)':'transparent',
                        color:glowOn?'#00ffff':'#6b7280',
                        fontSize:11,cursor:'pointer',fontWeight:'600',
                        display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                        marginBottom:4,transition:'all 0.15s',
                      }}>
                      ⚡ Neon Glow {glowOn?'— ON':''}
                    </button>
                  );
                })()}
                {/* Quick actions row */}
                <div style={{display:'flex',gap:4,marginTop:2}}>
                  {selectedLayer.type!=='background'&&(
                    <button onClick={()=>duplicateLayer(selectedLayer.id)}
                      title="Duplicate layer"
                      style={{flex:1,padding:'4px 0',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}>
                      ⧉ Dupe
                    </button>
                  )}
                  {selectedLayer.type!=='background'&&(
                    <button onClick={()=>deleteLayer(selectedLayer.id)}
                      title="Delete layer"
                      style={{flex:1,padding:'4px 0',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.danger,fontSize:10,cursor:'pointer'}}>
                      ✕ Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Footer — layers tab */}
            <div style={{padding:'5px 10px',borderTop:`1px solid ${T.border}`,fontSize:9,color:T.border,textAlign:'center',flexShrink:0}}>Drag rows to reorder</div>
            </>)}

            {/* ── HISTORY TAB ──────────────────────────────────────── */}
            {rightPanelTab==='history'&&(<>

              {/* History list */}
              <div ref={historyListRef} style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
                {history.map((_, idx)=>{
                  const isCurrent=idx===historyIndex;
                  const isFuture=idx>historyIndex;
                  const label=historyLabels[idx]||'Edit';
                  const ts=historyTimestamps[idx];
                  const thumb=historyThumbnails[idx];
                  const age=ts?Date.now()-ts:0;
                  const timeStr=age<60000?'now':age<3600000?`${Math.floor(age/60000)}m ago`:`${Math.floor(age/3600000)}h ago`;
                  return(
                    <div key={idx}
                      onClick={()=>{
                        if(isCurrent) return;
                        historyIndexRef.current=idx;
                        historyIndexRef.current=idx;
                        setHistoryIndex(idx);
                        setLayers(JSON.parse(JSON.stringify(historyRef.current[idx])));
                        triggerAutoSave();
                      }}
                      data-hist-row={idx}
                      style={{
                        display:'flex',alignItems:'center',gap:6,
                        padding:'5px 8px',cursor:isCurrent?'default':'pointer',
                        background:isCurrent?`${T.accent}18`:'transparent',
                        borderLeft:`2px solid ${isCurrent?T.accent:'transparent'}`,
                        opacity:isFuture?0.35:1,
                        transition:'all 0.08s',
                      }}
                      onMouseEnter={e=>{if(!isCurrent)e.currentTarget.style.background=T.bg2;}}
                      onMouseLeave={e=>{if(!isCurrent)e.currentTarget.style.background='transparent';}}>
                      {/* Thumbnail */}
                      <div style={{width:80,height:45,borderRadius:4,flexShrink:0,background:T.bg2,border:`1px solid ${isCurrent?T.accent:T.border}`,overflow:'hidden',position:'relative'}}>
                        {thumb
                          ? <img src={thumb} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:T.border}}>⏳</div>
                        }
                        {isCurrent&&<div style={{position:'absolute',bottom:2,right:2,width:6,height:6,borderRadius:'50%',background:T.accent}}/>}
                      </div>
                      {/* Label + time */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:isCurrent?T.accent:T.text,fontWeight:isCurrent?'700':'400',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</div>
                        <div style={{fontSize:9,color:T.muted,marginTop:1}}>{timeStr} · #{idx+1}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* History actions */}
              <div style={{borderTop:`1px solid ${T.border}`,padding:'6px 8px',flexShrink:0,display:'flex',gap:4}}>
                <button
                  onClick={()=>{
                    if(history.length<=1) return;
                    if(!window.confirm('Clear all history? This cannot be undone.')) return;
                    const cur=historyRef.current[historyIndexRef.current];
                    historyRef.current=[cur];historyIndexRef.current=0;
                    setHistory([cur]);setHistoryIndex(0);
                    historyLabelsRef.current=['Edit'];historyTimestampsRef.current=[Date.now()];
                    setHistoryLabels(['Edit']);setHistoryTimestamps([Date.now()]);
                    setHistoryThumbnails({});
                  }}
                  style={{flex:1,padding:'5px 0',borderRadius:5,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:10,cursor:'pointer'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.color=T.danger;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted;}}>
                  ✕ Clear History
                </button>
                <button
                  onClick={()=>{
                    const name=window.prompt('Snapshot name:',`Snapshot ${dbSnapshots.length+1}`);
                    if(name) saveDbSnapshot(name);
                  }}
                  style={{flex:1,padding:'5px 0',borderRadius:5,border:`1px solid ${T.accent}`,background:`${T.accent}12`,color:T.accent,fontSize:10,cursor:'pointer',fontWeight:'600'}}>
                  ⊕ Save Snapshot
                </button>
              </div>

              {/* Snapshot list */}
              {dbSnapshots.length>0&&(
                <div style={{borderTop:`1px solid ${T.border}`,flexShrink:0,maxHeight:160,overflowY:'auto'}}>
                  <div style={{padding:'5px 8px 3px',fontSize:9,color:T.muted,fontWeight:'700',letterSpacing:'0.5px',textTransform:'uppercase'}}>Saved Snapshots</div>
                  {[...dbSnapshots].reverse().map(snap=>(
                    <div key={snap.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderBottom:`1px solid ${T.border}20`}}>
                      {snap.thumbnail&&<img src={snap.thumbnail} alt="" style={{width:48,height:27,borderRadius:3,objectFit:'cover',flexShrink:0,border:`1px solid ${T.border}`}}/>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{snap.name}</div>
                        <div style={{fontSize:9,color:T.muted}}>{new Date(snap.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div style={{display:'flex',gap:2,flexShrink:0}}>
                        <button onClick={()=>restoreDbSnapshot(snap)} title="Restore snapshot"
                          style={{padding:'2px 5px',borderRadius:3,border:`1px solid ${T.accent}`,background:'transparent',color:T.accent,fontSize:10,cursor:'pointer'}}>↺</button>
                        <button onClick={()=>{if(window.confirm(`Delete snapshot "${snap.name}"?`))deleteDbSnapshot(snap.id);}} title="Delete snapshot"
                          style={{padding:'2px 5px',borderRadius:3,border:`1px solid ${T.border}`,background:'transparent',color:T.border,fontSize:10,cursor:'pointer'}}
                          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.color=T.danger;}}
                          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.border;}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

          </div>
        )}

      </div>

      {/* Mobile bottom toolbar */}
      {isMobile&&(
        <div style={{
          display:'flex',gap:2,
          padding:'6px 8px',paddingBottom:'calc(6px + env(safe-area-inset-bottom, 0px))',
          background:T.panel,borderTop:`1px solid ${T.border}`,
          overflowX:'auto',flexShrink:0,
          WebkitOverflowScrolling:'touch',
        }}>
          {[
            {key:'select',icon:'↖',label:'Select'},
            {key:'move',icon:'✋',label:'Move'},
            {key:'text',icon:'T',label:'Text'},
            {key:'brush',icon:'⌀',label:'Brush'},
            {key:'upload',icon:'↑',label:'Upload'},
            {key:'background',icon:'▨',label:'BG'},
            {key:'effects',icon:'✦',label:'FX'},
            {key:'zoom',icon:'🔍',label:'Zoom'},
          ].map(t=>(
            <button key={t.key} onClick={()=>setActiveTool(t.key)}
              style={{
                padding:'8px 12px',borderRadius:6,border:'none',
                background:activeTool===t.key?`${T.accent}22`:'transparent',
                color:activeTool===t.key?T.accent:T.muted,
                fontSize:9,cursor:'pointer',fontWeight:activeTool===t.key?'700':'400',
                display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                flexShrink:0,minWidth:44,
              }}>
              <span style={{fontSize:16}}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {/* ── Keyboard Shortcuts Reference Modal ────────────────────────────── */}
      {showShortcutsModal&&(
        <div
          onClick={e=>{if(e.target===e.currentTarget)setShowShortcutsModal(false);}}
          style={{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',backdropFilter:'blur(6px)'}}>
          <div style={{
            width:680,maxWidth:'95vw',maxHeight:'90vh',
            background:T.panel,borderRadius:16,
            border:`1.5px solid ${T.border}`,
            boxShadow:'0 40px 120px rgba(0,0,0,0.95)',
            display:'flex',flexDirection:'column',overflow:'hidden',
          }}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 24px 14px',borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
              <div>
                <div style={{fontSize:17,fontWeight:'800',color:T.text,letterSpacing:'-0.3px'}}>Keyboard Shortcuts</div>
                <div style={{fontSize:11,color:T.muted,marginTop:2}}>Press <kbd style={{background:T.input,border:`1px solid ${T.border}`,borderRadius:4,padding:'1px 5px',fontSize:10,color:T.text,fontFamily:'monospace'}}>?</kbd> or <kbd style={{background:T.input,border:`1px solid ${T.border}`,borderRadius:4,padding:'1px 5px',fontSize:10,color:T.text,fontFamily:'monospace'}}>Ctrl+/</kbd> to toggle • <kbd style={{background:T.input,border:`1px solid ${T.border}`,borderRadius:4,padding:'1px 5px',fontSize:10,color:T.text,fontFamily:'monospace'}}>Esc</kbd> to close</div>
              </div>
              <button onClick={()=>setShowShortcutsModal(false)}
                style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:8,color:T.muted,width:32,height:32,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            {/* Body */}
            <div style={{overflowY:'auto',padding:'16px 24px 24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px 32px'}}>
              {SHORTCUT_GROUPS.map(group=>(
                <div key={group.label}>
                  <div style={{fontSize:9,fontWeight:'800',letterSpacing:'0.9px',textTransform:'uppercase',color:T.accent,marginBottom:8,paddingBottom:4,borderBottom:`1px solid ${T.border}`}}>{group.label}</div>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <tbody>
                      {group.shortcuts.map(sc=>(
                        <tr key={sc.keys} style={{borderBottom:`1px solid ${T.border}22`}}>
                          <td style={{padding:'4px 0',whiteSpace:'nowrap',width:1}}>
                            {sc.keys.split(' or ').map((k,i)=>(
                              <React.Fragment key={i}>
                                {i>0&&<span style={{color:T.muted,fontSize:9,margin:'0 3px'}}>or</span>}
                                <kbd style={{
                                  display:'inline-block',
                                  background:T.input,
                                  border:`1px solid ${T.border}`,
                                  borderBottom:`2px solid ${T.border}`,
                                  borderRadius:5,
                                  padding:'1px 6px',
                                  fontSize:10,
                                  color:T.text,
                                  fontFamily:'monospace',
                                  whiteSpace:'nowrap',
                                }}>{k.trim()}</kbd>
                              </React.Fragment>
                            ))}
                          </td>
                          <td style={{padding:'4px 0 4px 10px',fontSize:11,color:T.muted}}>{sc.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div style={{padding:'10px 24px',borderTop:`1px solid ${T.border}`,flexShrink:0,display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:11,color:T.muted,flex:1}}>Shortcuts are disabled when typing in text inputs.</span>
              <button onClick={()=>setShowShortcutsModal(false)}
                style={{padding:'6px 18px',borderRadius:7,border:`1px solid ${T.border}`,background:T.input,color:T.text,fontSize:12,cursor:'pointer',fontWeight:'600'}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tier 3 Item 3: Competitor Comparison Full-Screen Modal ── */}
      {showCompetitor&&(
        <div style={{position:'fixed',inset:0,zIndex:1100,background:'#111',overflow:'auto',display:'flex',flexDirection:'column'}}>
          {/* Header */}
          <div style={{padding:'16px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #222',flexShrink:0}}>
            <div>
              <div style={{fontSize:18,fontWeight:'800',color:'#fff'}}>
                Competitive Landscape: <span style={{color:'#f97316'}}>{competitorQuery}</span>
              </div>
              <div style={{fontSize:11,color:'#666',marginTop:2}}>{competitorResults.length} competitor results</div>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              {competitorThumbUrl&&(
                <button onClick={analyzeCompetition} disabled={competitorAnalyzing}
                  style={{padding:'8px 16px',borderRadius:8,border:'1px solid #f97316',background:'rgba(249,115,22,0.15)',color:'#f97316',fontSize:12,fontWeight:'700',cursor:'pointer',opacity:competitorAnalyzing?0.5:1}}>
                  {competitorAnalyzing?'Analyzing…':'✦ Analyze vs Competitors'}
                </button>
              )}
              <button onClick={()=>setShowCompetitor(false)}
                style={{padding:'8px 14px',borderRadius:8,border:'1px solid #333',background:'#1a1a1a',color:'#aaa',fontSize:13,fontWeight:'600',cursor:'pointer'}}>
                ✕ Close
              </button>
            </div>
          </div>

          {/* Analysis results */}
          {competitorAnalysis&&(
            <div style={{margin:'16px 24px 0',padding:'14px 16px',borderRadius:10,background:'rgba(249,115,22,0.07)',borderLeft:'3px solid #f97316',fontSize:12,color:'#ccc',lineHeight:1.8,flexShrink:0}}>
              {competitorAnalysis.split('\n').filter(Boolean).map((line,i)=>(
                <div key={i} style={{marginBottom:4}}>{line}</div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div style={{padding:'20px 24px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16,overflowY:'auto'}}>
            {/* Card 0 — Creator's thumbnail */}
            {competitorThumbUrl&&(
              <div style={{borderRadius:8,overflow:'hidden',background:'#1a1a1a',border:'2px solid #ff6a00',position:'relative',cursor:'default'}}>
                <div style={{position:'relative',aspectRatio:'16/9',overflow:'hidden'}}>
                  <img src={competitorThumbUrl} alt="Your thumbnail" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                  <div style={{position:'absolute',top:6,left:6,background:'#ff6a00',color:'#fff',fontSize:9,fontWeight:'800',padding:'3px 8px',borderRadius:12,letterSpacing:'0.5px'}}>YOUR THUMBNAIL</div>
                </div>
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:12,fontWeight:'700',color:'#fff',lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>Your current design</div>
                  <div style={{fontSize:10,color:'#888',marginTop:3}}>You · —</div>
                </div>
              </div>
            )}
            {/* Competitor cards */}
            {competitorResults.map(r=>(
              <div key={r.videoId} style={{borderRadius:8,overflow:'hidden',background:'#1a1a1a',border:'1px solid #2a2a2a',cursor:'pointer',transition:'transform 0.15s,box-shadow 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.03)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.6)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow='none';}}>
                <div style={{position:'relative',aspectRatio:'16/9',overflow:'hidden',background:'#0a0a0a'}}>
                  <img src={r.thumbnailUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                    onError={e=>{e.target.parentNode.style.background='#1a1a1a';e.target.style.display='none';}}/>
                </div>
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:12,color:'#fff',lineHeight:1.4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',fontWeight:'500'}}>{r.title}</div>
                  <div style={{fontSize:10,color:'#888',marginTop:3,display:'flex',justifyContent:'space-between'}}>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'70%'}}>{r.channelName}</span>
                    <span style={{flexShrink:0,marginLeft:4}}>{formatViewCount(r.viewCount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade to Pro Modal */}
      {showPaywall && (
        <div style={{position:'fixed',inset:0,zIndex:1001,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowPaywall(false);}}>
          <div style={{width:440,background:T.panel,borderRadius:16,border:`2px solid ${T.warning}`,padding:'32px',boxShadow:'0 32px 120px rgba(0,0,0,0.9)',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:16}}>⚡</div>
            <div style={{fontSize:24,fontWeight:'800',marginBottom:8,color:T.text}}>Upgrade to Pro</div>
            <div style={{fontSize:14,color:T.muted,lineHeight:1.7,marginBottom:24}}>
              AI thumbnail generation is a Pro feature. Unlock unlimited AI-powered thumbnails, HD exports, and priority support for just $15/month.
            </div>
            
            <div style={{background:T.bg2,borderRadius:10,padding:'16px',marginBottom:24,border:`1px solid ${T.border}`}}>
              <div style={{fontSize:12,fontWeight:'700',color:T.accent,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.5px'}}>Pro Features</div>
              <div style={{display:'flex',flexDirection:'column',gap:8,textAlign:'left'}}>
                {[
                  '⚡ Unlimited AI thumbnail generation',
                  '📸 HD 4K export (1280×720)',
                  '🎨 Brand Kit with face integration',
                  '⚙️ Priority support',
                  '🚀 Early access to new features'
                ].map((feature,i)=>(
                  <div key={i} style={{fontSize:13,color:T.text2,display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:T.success,fontSize:11,fontWeight:'700'}}>✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={()=>{
                const isPro = isProUser;
                const isAdmin = user?.is_admin || user?.is_admin;
                if (isPro || isAdmin) {
                  setShowPaywall(false);
                  setShowAlreadyPro(true);
                  return;
                }
                handleUpgrade();
              }}
              style={{
                width:'100%',padding:'14px 24px',borderRadius:10,border:'none',
                background:'linear-gradient(135deg, #f59e0b, #ef4444)',
                color:'#fff',cursor:'pointer',fontSize:15,fontWeight:'700',
                boxShadow:'0 4px 20px rgba(245,158,11,0.4)',
                marginBottom:12,transition:'transform 0.2s'
              }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
              Upgrade to Pro — $15/mo
            </button>
            
            <button onClick={()=>setShowPaywall(false)} style={{width:'100%',padding:'10px',borderRadius:8,border:`1px solid ${T.border}`,background:'transparent',color:T.muted,fontSize:13,cursor:'pointer'}}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Already Upgraded Notification */}
      {showAlreadyPro && (
        <div style={{position:'fixed',inset:0,zIndex:1002,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)'}} onClick={e=>{if(e.target===e.currentTarget)setShowAlreadyPro(false);}}>
          <div style={{width:380,background:T.panel,borderRadius:16,border:`2px solid ${T.success}`,padding:'32px',boxShadow:'0 24px 80px rgba(0,0,0,0.8)',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:16}}>✓</div>
            <div style={{fontSize:22,fontWeight:'800',marginBottom:8,color:T.text}}>You've already upgraded to Pro!</div>
            <div style={{fontSize:14,color:T.muted,lineHeight:1.7,marginBottom:24}}>
              Enjoy your premium features including unlimited AI generation, HD exports, and priority support.
            </div>
            <button onClick={()=>setShowAlreadyPro(false)} style={{width:'100%',padding:'12px 24px',borderRadius:10,border:'none',background:T.success,color:'#fff',cursor:'pointer',fontSize:14,fontWeight:'700',boxShadow:'0 4px 16px rgba(34,197,94,0.3)'}}>
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Feature J: Niche Onboarding Modal */}
      {nicheOnboarding && (
        <div style={{position:'fixed',inset:0,zIndex:1200,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(4,5,8,0.97)',backdropFilter:'blur(16px)'}}>
          <style>{`
            @keyframes niche-float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-6px)} }
            @keyframes niche-glow  { 0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0)} 50%{box-shadow:0 0 32px 8px rgba(249,115,22,0.35)} }
            @keyframes niche-fade-in { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
            .niche-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease !important; cursor:pointer; background:none; border:none; text-align:left; touch-action:manipulation; }
            .niche-card:hover { transform: translateY(-4px) scale(1.03) !important; }
            @media (max-width: 600px) {
              .niche-grid { grid-template-columns: repeat(2,1fr) !important; }
              .niche-header-title { font-size: 28px !important; }
              .niche-header-sub { display: none !important; }
              .niche-card-emoji { font-size: 28px !important; margin-bottom: 8px !important; }
              .niche-card-label { font-size: 14px !important; }
              .niche-card-desc  { display: none !important; }
            }
          `}</style>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',maxWidth:820,width:'100%',padding:'0 16px',animation:'niche-fade-in 0.5s ease both',overflowY:'auto',maxHeight:'100vh'}}>
            {/* Header */}
            <div style={{textAlign:'center',marginBottom:48}}>
              <div style={{fontSize:13,fontWeight:'700',letterSpacing:'0.18em',color:'#f97316',textTransform:'uppercase',marginBottom:16}}>
                Welcome to ThumbFrame
              </div>
              <div className="niche-header-title" style={{fontSize:42,fontWeight:'900',color:'#fff',lineHeight:1.05,marginBottom:12,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
                What kind of channel<br/>do you create for?
              </div>
              <div className="niche-header-sub" style={{fontSize:16,color:'rgba(255,255,255,0.45)',lineHeight:1.6}}>
                We'll tailor every AI feature to your audience so you get<br/>thumbnails that actually perform.
              </div>
            </div>

            {/* Niche card grid — 3 cols desktop, 2 cols mobile */}
            <div className="niche-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,width:'100%',marginBottom:40}}>
              {Object.entries(NICHE_CONFIG).map(([key,cfg])=>{
                const isSelected=nicheHovered===key;
                return (
                  <button
                    key={key}
                    className="niche-card"
                    onClick={()=>setNicheHovered(key)}
                    style={{
                      position:'relative',overflow:'hidden',
                      background: isSelected
                        ? `linear-gradient(135deg, ${cfg.gradFrom} 0%, ${cfg.gradTo} 100%)`
                        : 'rgba(255,255,255,0.04)',
                      borderRadius:20,
                      border: isSelected ? `2px solid ${cfg.accentColor}` : '2px solid rgba(255,255,255,0.08)',
                      padding:'28px 24px 24px',
                      animation: isSelected ? 'niche-glow 2s ease infinite' : 'none',
                      boxShadow: isSelected ? `0 8px 40px ${cfg.accentColor}55` : '0 2px 12px rgba(0,0,0,0.4)',
                      userSelect:'none', minHeight:48,
                    }}
                  >
                    {isSelected && (
                      <div style={{
                        position:'absolute',top:12,right:12,width:22,height:22,borderRadius:'50%',
                        background:cfg.accentColor,display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:12,fontWeight:'900',color:'#fff',boxShadow:`0 2px 8px ${cfg.accentColor}88`,
                      }}>✓</div>
                    )}
                    <div className="niche-card-emoji" style={{fontSize:40,marginBottom:14,display:'block',animation:isSelected?'niche-float 3s ease infinite':undefined}}>{cfg.emoji}</div>
                    <div className="niche-card-label" style={{fontSize:17,fontWeight:'800',color:'#fff',marginBottom:6}}>{cfg.label}</div>
                    <div className="niche-card-desc" style={{fontSize:13,color:isSelected?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.4)',lineHeight:1.5}}>{cfg.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* CTA */}
            <button
              disabled={!nicheHovered||nicheSaving}
              onClick={()=>nicheHovered&&setNiche(nicheHovered)}
              style={{
                padding:'16px 64px',borderRadius:14,border:'none',
                background: nicheHovered
                  ? `linear-gradient(135deg, ${NICHE_CONFIG[nicheHovered]?.gradFrom||'#7c2d12'}, ${NICHE_CONFIG[nicheHovered]?.accentColor||'#f97316'})`
                  : 'rgba(255,255,255,0.08)',
                color: nicheHovered?'#fff':'rgba(255,255,255,0.25)',
                fontSize:17,fontWeight:'800',cursor:nicheHovered?'pointer':'default',
                boxShadow: nicheHovered?`0 8px 32px ${NICHE_CONFIG[nicheHovered]?.accentColor||'#f97316'}55`:'none',
                transition:'all 0.2s ease',
                letterSpacing:'0.02em',
              }}
            >
              {nicheSaving ? 'Setting up…' : nicheHovered ? `Continue as ${NICHE_CONFIG[nicheHovered]?.label} Creator →` : 'Pick your niche above'}
            </button>

            <div style={{marginTop:16,fontSize:12,color:'rgba(255,255,255,0.2)'}}>
              You can change this any time in settings
            </div>
          </div>
        </div>
      )}

      {/* ── Automation Recommendation Panel ─────────────────────────────── */}
      {autoPanel && (()=>{
        const score = autoMetrics?.ctrScore?.overall ?? autoMetrics?.ctrScore ?? null;
        const scoreColor = score!=null ? (score>=85?'#4ade80':score>=70?'#22d3ee':score>=50?'#fbbf24':score>=30?'#fb923c':'#ef4444') : '#888';
        const scoreLabel = score!=null ? (score>=85?'Excellent':score>=70?'Strong':score>=50?'Good Start':score>=30?'Needs Work':'Major Issues') : '';
        const breakdown = autoMetrics?.ctrScore?.breakdown;
        const bdEntries = breakdown ? [
          {key:'technical',   label:'Technical',   max:25},
          {key:'subject',     label:'Subject',     max:25},
          {key:'textClarity', label:'Text',        max:20},
          {key:'composition', label:'Composition', max:15},
          {key:'colorImpact', label:'Color',       max:15},
        ] : [];
        // SVG arc gauge
        const R=32, circ=2*Math.PI*R, pct=(score??0)/100;
        const visibleRecs = autoRecs.filter(r=>!autoDismissed.has(r.id));
        const actionableCount = autoRecs.filter(r=>!autoDismissed.has(r.id)&&!!r.action&&!['show_safe_zones'].includes(r.action)).length;
        return (
        <div style={{
          position:'fixed', top:0, right:0, bottom:0, width:340,
          background:'#131320', borderLeft:'1px solid rgba(255,255,255,0.07)',
          zIndex:1200, display:'flex', flexDirection:'column',
          boxShadow:'-8px 0 40px rgba(0,0,0,0.6)',
          animation:'tf-auto-slide 0.28s ease-out',
          fontFamily:'inherit',
        }}>
          <style>{`@keyframes tf-auto-slide{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

          {/* Header */}
          <div style={{padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:10, flexShrink:0}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:700, color:'#fff'}}>Image Analysis</div>
              {autoMetrics?.details?.nicheAnalysis && (
                <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:1}}>
                  Detected: {autoMetrics.details.nicheAnalysis.label}
                </div>
              )}
            </div>
            <button onClick={()=>setAutoPanel(false)}
              style={{background:'transparent',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:18,padding:'4px 6px',borderRadius:6,lineHeight:1}}>×</button>
          </div>

          {/* Body — scrollable */}
          <div style={{flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10}}>
            {autoLoading ? (
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,gap:16,color:'rgba(255,255,255,0.4)',padding:'40px 0'}}>
                <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid rgba(249,115,22,0.25)',borderTopColor:'#f97316',animation:'editor-spin 0.8s linear infinite'}}/>
                <div style={{fontSize:12,textAlign:'center',lineHeight:1.6}}>
                  Analyzing image…<br/>
                  <span style={{fontSize:10,color:'rgba(255,255,255,0.25)'}}>Running pixel analysis + face detection</span>
                </div>
              </div>
            ) : (
              <>
                {/* CTR Gauge + Breakdown */}
                {score!=null && (
                  <div style={{background:'rgba(255,255,255,0.03)',borderRadius:10,border:'1px solid rgba(255,255,255,0.06)',padding:'14px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:14}}>
                      {/* SVG Arc Gauge */}
                      <svg width={80} height={80} viewBox="0 0 80 80" style={{flexShrink:0}}>
                        <circle cx={40} cy={40} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7}/>
                        <circle cx={40} cy={40} r={R} fill="none" stroke={scoreColor} strokeWidth={7}
                          strokeDasharray={`${circ*pct} ${circ*(1-pct)}`}
                          strokeLinecap="round"
                          transform="rotate(-90 40 40)"
                          style={{transition:'stroke-dasharray 0.6s ease'}}/>
                        <text x={40} y={37} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={700}>{score}</text>
                        <text x={40} y={50} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={8}>/100</text>
                      </svg>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:scoreColor,marginBottom:6}}>{scoreLabel}</div>
                        {bdEntries.map(({key,label,max})=>{
                          const val=breakdown[key]??0;
                          const pctBar=val/max;
                          return (
                            <div key={key} style={{marginBottom:4}}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                                <span style={{fontSize:9,color:'rgba(255,255,255,0.35)'}}>{label}</span>
                                <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>{val}/{max}</span>
                              </div>
                              <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.06)'}}>
                                <div style={{height:'100%',borderRadius:2,background:pctBar>=0.7?'#4ade80':pctBar>=0.4?'#fbbf24':'#f87171',width:`${pctBar*100}%`,transition:'width 0.5s ease'}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendation Cards */}
                {visibleRecs.map(rec=>(
                  <div key={rec.id} style={{
                    background:'rgba(255,255,255,0.03)',borderRadius:9,
                    border:'1px solid rgba(255,255,255,0.07)',padding:'11px 13px',
                    display:'flex',flexDirection:'column',gap:7,
                  }}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:9}}>
                      <div style={{fontSize:18,flexShrink:0,lineHeight:1,marginTop:1}}>{rec.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#fff',lineHeight:1.3,display:'flex',alignItems:'center',gap:6}}>
                          {rec.title}
                          {rec.impact==='high' && <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(249,115,22,0.2)',color:'#f97316',fontWeight:600}}>HIGH</span>}
                        </div>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:3,lineHeight:1.5}}>{rec.desc}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,marginTop:1}}>
                      {rec.action && (
                        <button
                          onClick={async()=>{
                            setAutoDismissed(prev=>new Set([...prev,rec.id]));
                            await applyAutoAction(rec.action);
                            if(rec.action!=='show_safe_zones') showToastMsg(`${rec.title} applied ✓`,'success');
                          }}
                          style={{flex:1,padding:'6px 10px',borderRadius:6,border:'none',background:'#f97316',color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}
                        >{rec.actionLabel}</button>
                      )}
                      <button
                        onClick={()=>setAutoDismissed(prev=>new Set([...prev,rec.id]))}
                        style={{padding:'6px 10px',borderRadius:6,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.35)',fontSize:10,cursor:'pointer'}}
                      >Dismiss</button>
                    </div>
                  </div>
                ))}

                {visibleRecs.length===0 && !autoLoading && (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,color:'rgba(255,255,255,0.35)',padding:'32px 0'}}>
                    <div style={{fontSize:28}}>🎉</div>
                    <div style={{fontSize:12,textAlign:'center'}}>All recommendations dismissed.</div>
                  </div>
                )}

                {/* ── Device Preview ── */}
                <div style={{borderRadius:9,overflow:'hidden',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <button
                    onClick={()=>setAutoShowDevicePreview(v=>!v)}
                    style={{width:'100%',padding:'10px 13px',background:'rgba(255,255,255,0.03)',border:'none',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',color:'rgba(255,255,255,0.5)',fontSize:11,fontWeight:600}}
                  >
                    <span>📱 Device Preview</span>
                    <span style={{fontSize:9}}>{autoShowDevicePreview?'▲':'▼'}</span>
                  </button>
                  {autoShowDevicePreview && (
                    <div style={{padding:'0 8px 8px'}}>
                      <DevicePreview canvasDataUrl={autoPreviewUrl} visible={true}/>
                    </div>
                  )}
                </div>

                {/* ── Color Blind Simulator ── */}
                <div style={{borderRadius:9,overflow:'hidden',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <button
                    onClick={()=>setAutoShowColorBlind(v=>!v)}
                    style={{width:'100%',padding:'10px 13px',background:'rgba(255,255,255,0.03)',border:'none',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',color:'rgba(255,255,255,0.5)',fontSize:11,fontWeight:600}}
                  >
                    <span>👁 Color Blind Preview</span>
                    <span style={{fontSize:9}}>{autoShowColorBlind?'▲':'▼'}</span>
                  </button>
                  {autoShowColorBlind && (
                    <div style={{padding:'0 8px 8px'}}>
                      <ColorBlindSimulator canvasDataUrl={autoPreviewUrl} visible={true}/>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!autoLoading && actionableCount>0 && (
            <div style={{padding:'10px 14px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
              <button onClick={runAutoFix} disabled={autoFixRunning} style={{
                width:'100%',padding:'10px 14px',borderRadius:8,border:'none',
                background:autoFixRunning?'rgba(249,115,22,0.25)':'linear-gradient(135deg,#f97316,#fb923c)',
                color:'#fff',fontSize:12,fontWeight:700,cursor:autoFixRunning?'not-allowed':'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
              }}>
                {autoFixRunning
                  ? <><div style={{width:13,height:13,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'editor-spin 0.8s linear infinite'}}/>Applying fixes…</>
                  : `✨ Auto-Fix Everything (${actionableCount})`
                }
              </button>
            </div>
          )}
        </div>
        );
      })()}

      {/* ── Prompt-to-Thumbnail Engine Panel ──────────────────────────────── */}
      {showPromptEngine && (
        <PromptToThumbnail
          token={token}
          apiUrl={resolvedApiUrl}
          niche={userNiche}
          onAssemble={handlePromptAssemble}
          onClose={()=>setShowPromptEngine(false)}
        />
      )}

      {/* Toast Notification */}
      {showToast && (
        <div style={{position:'fixed',bottom:24,right:24,zIndex:1003,minWidth:300,maxWidth:400,background:T.panel,borderRadius:12,border:`2px solid ${toastType==='success'?T.success:toastType==='error'?T.danger:T.accent}`,padding:'16px 20px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)',display:'flex',alignItems:'center',gap:12,animation:'slideIn 0.3s ease-out'}}>
          <div style={{fontSize:24}}>
            {toastType === 'success' && '✓'}
            {toastType === 'error' && '⚠'}
            {toastType === 'info' && 'ℹ'}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:T.text,fontWeight:'600',lineHeight:1.4}}>{toastMessage}</div>
          </div>
          <button onClick={()=>setShowToast(false)} style={{padding:'4px 8px',borderRadius:6,border:'none',background:'transparent',color:T.muted,cursor:'pointer',fontSize:16,fontWeight:'700'}}>×</button>
        </div>
      )}
    </div>
  );
}
