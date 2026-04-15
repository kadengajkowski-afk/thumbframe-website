// src/editor/utils/generateTemplatePreviews.js
// Admin-only one-time utility — generates 320×180 JPEG preview thumbnails for
// all seeded templates using Canvas 2D and uploads them to Supabase Storage.
// Only callable when user.is_dev === true.
//
// Preview rendering strategy (no server needed):
//   • Background: gradient derived from template's gradientPreview colors
//   • Image placeholder regions: subtle dashed orange boxes (scaled 1280→320)
//   • Category badge: orange pill top-left
//   • Title text: bottom overlay with largest text layer's content
//   • Template name: small caption below title

import supabase from '../../supabaseClient';
import { SEED_TEMPLATES } from '../templates/seedTemplates';

const THUMB_W = 320;
const THUMB_H = 180;

// ── Color extraction ─────────────────────────────────────────────────────────

function getTemplateColors(template) {
  if (template.gradientPreview) {
    return { from: template.gradientPreview.from, to: template.gradientPreview.to };
  }
  const gLyr = template.layers.find(l => l.type === 'shape' && l.gradientFill?.stops?.length >= 2);
  if (gLyr) {
    const stops = gLyr.gradientFill.stops;
    return { from: stops[0].color, to: stops[stops.length - 1].color };
  }
  const sLyr = template.layers.find(l => l.type === 'shape' && l.shapeData?.fill);
  if (sLyr) return { from: sLyr.shapeData.fill, to: sLyr.shapeData.fill };
  return { from: '#111111', to: '#222222' };
}

// ── Get title text ───────────────────────────────────────────────────────────

function getTitle(template) {
  const textLayers = template.layers.filter(l => l.type === 'text' && l.textData?.content);
  if (!textLayers.length) return template.name;
  const required = textLayers.find(l => l.placeholder?.required === true);
  if (required) return required.textData.content;
  return textLayers.reduce((a, b) =>
    (b.textData?.fontSize ?? 0) > (a.textData?.fontSize ?? 0) ? b : a
  ).textData.content;
}

// ── Manual rounded-rect path (broadest browser support) ─────────────────────

function tracePill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Truncate text to fit a max pixel width ───────────────────────────────────

function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 2 && ctx.measureText(text + '…').width > maxW) {
    text = text.slice(0, -1);
  }
  return text + '…';
}

// ── Render one 320×180 preview canvas ───────────────────────────────────────

function renderPreview(template) {
  const canvas  = document.createElement('canvas');
  canvas.width  = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d');
  const colors = getTemplateColors(template);

  // ── Background gradient (top-left → bottom-right) ─────────────────────────
  const bg = ctx.createLinearGradient(0, 0, THUMB_W, THUMB_H);
  bg.addColorStop(0, colors.from);
  bg.addColorStop(1, colors.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);

  // ── Subtle diagonal line texture ──────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let i = -THUMB_H; i < THUMB_W + THUMB_H; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + THUMB_H, THUMB_H);
    ctx.stroke();
  }
  ctx.restore();

  // ── Image placeholder boxes (scaled from 1280×720 to 320×180) ────────────
  const sx = THUMB_W / 1280;
  const sy = THUMB_H / 720;
  template.layers
    .filter(l => l.type === 'image' && l.placeholder)
    .forEach(layer => {
      const lx = (layer.x - layer.width  / 2) * sx;
      const ly = (layer.y - layer.height / 2) * sy;
      const lw = layer.width  * sx;
      const lh = layer.height * sy;

      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle   = 'rgba(249,115,22,1)';
      ctx.fillRect(lx, ly, lw, lh);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = 'rgba(249,115,22,1)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1);
      ctx.restore();

      // Camera icon centre
      const cx = lx + lw / 2;
      const cy = ly + lh / 2;
      ctx.save();
      ctx.globalAlpha = 0.50;
      ctx.fillStyle   = 'rgba(249,115,22,0.9)';
      ctx.font        = `${Math.max(10, Math.min(lw, lh) * 0.22)}px serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📷', cx, cy);
      ctx.restore();
    });

  // ── Category badge (top-left, orange pill) ────────────────────────────────
  ctx.save();
  ctx.font = 'bold 8px Inter, -apple-system, sans-serif';
  const catLabel  = template.category.toUpperCase();
  const textW     = ctx.measureText(catLabel).width;
  const pillW     = textW + 14;
  const pillH     = 16;
  ctx.fillStyle   = 'rgba(249,115,22,0.90)';
  tracePill(ctx, 8, 8, pillW, pillH, 4);
  ctx.fill();
  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(catLabel, 15, 8 + pillH / 2);
  ctx.restore();

  // ── FREE badge (top-right) ────────────────────────────────────────────────
  if (template.is_free) {
    ctx.save();
    ctx.font = 'bold 8px Inter, -apple-system, sans-serif';
    const freeTw = ctx.measureText('FREE').width;
    const freePW = freeTw + 12;
    const freePH = 16;
    const freeX  = THUMB_W - freePW - 8;
    ctx.fillStyle = 'rgba(34,197,94,0.85)';
    tracePill(ctx, freeX, 8, freePW, freePH, 4);
    ctx.fill();
    ctx.fillStyle    = '#ffffff';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('FREE', freeX + 6, 8 + freePH / 2);
    ctx.restore();
  }

  // ── Bottom overlay with title ─────────────────────────────────────────────
  const overlayH = 44;
  const overlayY = THUMB_H - overlayH;
  ctx.save();
  const overlayGrad = ctx.createLinearGradient(0, overlayY - 8, 0, THUMB_H);
  overlayGrad.addColorStop(0, 'rgba(0,0,0,0)');
  overlayGrad.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = overlayGrad;
  ctx.fillRect(0, overlayY - 8, THUMB_W, overlayH + 8);
  ctx.restore();

  // Title text
  const title = getTitle(template);
  ctx.save();
  ctx.font      = 'bold 14px Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor  = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur   = 4;
  ctx.shadowOffsetY = 1;
  ctx.fillText(truncate(ctx, title, THUMB_W - 16), 8, THUMB_H - 24);
  ctx.restore();

  // Template name (small, muted)
  ctx.save();
  ctx.font         = '8px Inter, -apple-system, sans-serif';
  ctx.fillStyle    = 'rgba(245,245,247,0.50)';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(truncate(ctx, template.name, THUMB_W - 16), 8, THUMB_H - 9);
  ctx.restore();

  return canvas;
}

// ── Canvas → JPEG blob ───────────────────────────────────────────────────────

function toBlob(canvas, quality = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob returned null'));
    }, 'image/jpeg', quality);
  });
}

// ── Ensure storage bucket exists (best-effort) ───────────────────────────────

async function ensureBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === 'templates');
    if (!exists) {
      await supabase.storage.createBucket('templates', { public: true });
    }
  } catch (err) {
    // May fail if bucket already exists or insufficient permissions — non-fatal
    console.warn('[generateTemplatePreviews] ensureBucket:', err.message);
  }
}

// ── Main export ──────────────────────────────────────────────────────────────
//
// onProgress({ done, total, name }) — called before and after each template.
// Returns { done, total, errors[] } when finished.

export async function generateTemplatePreviews(onProgress) {
  await ensureBucket();

  const total  = SEED_TEMPLATES.length;
  let   done   = 0;
  const errors = [];

  for (const template of SEED_TEMPLATES) {
    onProgress?.({ done, total, name: template.name });

    try {
      // Render Canvas 2D preview
      const canvas = renderPreview(template);
      const blob   = await toBlob(canvas);

      // Upload to Supabase Storage
      const path = `template-previews/${template.id}/thumb.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('templates')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) throw uploadErr;

      // Get public URL (sync call — no network round-trip)
      const { data: urlData } = supabase.storage
        .from('templates')
        .getPublicUrl(path);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error('getPublicUrl returned no URL');

      // Update template row
      const { error: updateErr } = await supabase
        .from('templates')
        .update({ preview_thumb_url: publicUrl })
        .eq('id', template.id);

      if (updateErr) throw updateErr;

    } catch (err) {
      console.error(`[generateTemplatePreviews] ${template.id}:`, err);
      errors.push({ id: template.id, name: template.name, message: err.message });
    }

    done++;
    onProgress?.({ done, total, name: template.name });
  }

  return { done, total, errors };
}
