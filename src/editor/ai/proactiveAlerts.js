// src/editor/ai/proactiveAlerts.js
// Silent canvas checks that fire proactive ThumbFriend alerts.
// Each alert type fires at most once per session (tracked in FIRED_ALERTS Set).
//
// Checks:
//  1. Timestamp zone violation — layer overlaps bottom-right 100×24px
//  2. Text too small for mobile — fontSize < 61px (reads <8px at 168×94 postage stamp)
//  3. Low brightness — all image layers have very low brightness adjustments

const FIRED_ALERTS = new Set();

// YouTube timestamp badge: bottom-right corner, 100px wide × 24px tall
const TIMESTAMP = { x: 1280 - 100, y: 720 - 24, w: 100, h: 24 };

function layerBounds(layer) {
  const ax = layer.anchorX ?? 0.5;
  const ay = layer.anchorY ?? 0.5;
  return {
    left:   layer.x - layer.width  * ax,
    top:    layer.y - layer.height * ay,
    right:  layer.x + layer.width  * (1 - ax),
    bottom: layer.y + layer.height * (1 - ay),
  };
}

function overlapsTimestamp(layer) {
  if (!layer.visible) return false;
  const b = layerBounds(layer);
  return !(
    b.right  < TIMESTAMP.x ||
    b.left   > TIMESTAMP.x + TIMESTAMP.w ||
    b.bottom < TIMESTAMP.y ||
    b.top    > TIMESTAMP.y + TIMESTAMP.h
  );
}

/**
 * Check layers for critical issues. Returns array of new alert objects.
 * Already-fired alerts are skipped. Call this on an interval.
 *
 * @param  {Array} layers — layer array from store
 * @returns {Array<{ type, message, layerId? }>}
 */
export function checkProactiveAlerts(layers) {
  const alerts = [];

  for (const layer of layers) {
    // ── 1. Timestamp zone violation ───────────────────────────────────────
    const tsKey = `timestamp_${layer.id}`;
    if (!FIRED_ALERTS.has(tsKey) && overlapsTimestamp(layer)) {
      FIRED_ALERTS.add(tsKey);
      alerts.push({
        type:    'timestamp_zone',
        layerId: layer.id,
        message: `"${layer.name}" is hidden behind YouTube's timestamp badge.`,
      });
    }

    // ── 2. Text too small for mobile ─────────────────────────────────────
    if (layer.type === 'text' && layer.textData) {
      const smKey = `small_text_${layer.id}`;
      if (!FIRED_ALERTS.has(smKey) && (layer.textData.fontSize || 0) < 61) {
        FIRED_ALERTS.add(smKey);
        const preview = (layer.textData.content || layer.name).slice(0, 24);
        alerts.push({
          type:    'small_text',
          layerId: layer.id,
          message: `Text "${preview}" is too small to read on mobile. Try 80px+ font size.`,
        });
      }
    }
  }

  // ── 3. Low brightness (once per session, heuristic via adjustments) ────
  if (!FIRED_ALERTS.has('low_brightness')) {
    const visible = layers.filter(l => l.type === 'image' && l.visible);
    if (visible.length > 0) {
      const avg = visible.reduce((s, l) => s + (l.adjustments?.brightness ?? 0), 0) / visible.length;
      if (avg < -60) {
        FIRED_ALERTS.add('low_brightness');
        alerts.push({
          type:    'low_brightness',
          message: 'Thumbnail brightness is very low — nearly invisible in YouTube dark mode.',
        });
      }
    }
  }

  return alerts;
}

/** Reset all fired alerts — call on project load / new session. */
export function resetFiredAlerts() {
  FIRED_ALERTS.clear();
}
