// src/editor-v2/ui/shipAlive.js
// -----------------------------------------------------------------------------
// Purpose:  Orchestrates the 1200ms "ship coming alive" sequence from
//           Phase 4.6.c. Pure JS — returns a progress object with
//           stage flags for React to bind to. Also owns the per-tab
//           session flag that decides whether to replay the animation.
//
// Exports:  useShipAlive(active, onComplete), SHIP_ALIVE_STAGES,
//           SESSION_FLAG, __resetShipAliveForTests
// Depends:  react, ./tokens (for SHIP_ALIVE duration token)
//
// Session semantics (from brief):
//   • per TAB, not per browser  →  sessionStorage, not localStorage
//   • replay on new tab
//   • no replay on reload of the same tab
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { MOTION_TOKENS } from './tokens';

export const SESSION_FLAG = 'thumbframe.editor.shipAlive.v1';

/** Stage timeline in milliseconds, per the brief. */
export const SHIP_ALIVE_STAGES = Object.freeze([
  { t: 0,    key: 'canvasEnter',   duration: 150 },
  { t: 200,  key: 'toolsUnfurl',   duration: 200, stagger: 40 },
  { t: 600,  key: 'panelSlideIn',  duration: 300 },
  { t: 700,  key: 'layersRise',    duration: 300 },
  { t: 800,  key: 'bgBrighten',    duration: 200 },
  { t: 900,  key: 'shipItFadeIn',  duration: 200 },
  { t: 1000, key: 'savePenAppear', duration: 150 },
  { t: 1100, key: 'settle',        duration: 100 },
]);

/** Whether the cinematic has already played in this tab. */
export function hasPlayedThisSession() {
  if (typeof sessionStorage === 'undefined') return false;
  try { return sessionStorage.getItem(SESSION_FLAG) === '1'; }
  catch { return false; }
}

function markPlayed() {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch { /* noop */ }
}

/**
 * React hook that drives the sequence. `active` is the boolean the
 * caller flips to "true" once an upload lands or Start blank is clicked.
 * `onComplete` fires after settle + marks the session flag so the next
 * call short-circuits.
 *
 * @param {boolean} active
 * @param {() => void} [onComplete]
 * @returns {{
 *   running: boolean,
 *   elapsed: number,
 *   stages: Record<string, boolean>,
 *   skip: () => void,
 * }}
 */
export function useShipAlive(active, onComplete) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef(0);
  const rafRef       = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    // Shortcut: already played this tab → no replay.
    if (active && hasPlayedThisSession()) {
      setElapsed(MOTION_TOKENS.shipAlive);
      onComplete?.();
      return;
    }
    if (!active) {
      setElapsed(0);
      setRunning(false);
      completedRef.current = false;
      return;
    }

    setRunning(true);
    completedRef.current = false;
    startedAtRef.current = _now();

    const tick = () => {
      const dt = _now() - startedAtRef.current;
      setElapsed(dt);
      if (dt >= MOTION_TOKENS.shipAlive) {
        setRunning(false);
        if (!completedRef.current) {
          completedRef.current = true;
          markPlayed();
          onComplete?.();
        }
        return;
      }
      rafRef.current = _raf(tick);
    };
    rafRef.current = _raf(tick);
    return () => { _cancelRaf(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const stages = useMemo(() => {
    const out = {};
    for (const s of SHIP_ALIVE_STAGES) out[s.key] = elapsed >= s.t;
    return out;
  }, [elapsed]);

  const skip = () => {
    _cancelRaf(rafRef.current);
    setElapsed(MOTION_TOKENS.shipAlive);
    setRunning(false);
    if (!completedRef.current) {
      completedRef.current = true;
      markPlayed();
      onComplete?.();
    }
  };

  return { running, elapsed, stages, skip };
}

// ── RAF shims (identical pattern to engine/Renderer for test parity) ──────
function _raf(fn) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
  return setTimeout(() => fn(_now()), 16);
}
function _cancelRaf(id) {
  if (!id) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}
function _now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Test helper — wipe the session flag between tests. */
export function __resetShipAliveForTests() {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(SESSION_FLAG); } catch { /* noop */ }
}
