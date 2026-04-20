// ShootingStars — procedural streaks with painterly white-amber trail.
//
// Spec §6:
//   • Random single streaks every 6-18s
//   • Meteor shower burst (5-8 streaks at once) every 60-120s
//   • Both time-based, not scroll-driven
//   • Respects prefers-reduced-motion: halves frequency when reduced
//
// Implementation:
//   Pool of STREAK_POOL slots pre-allocated as points primitives driving
//   a custom shader. Each slot has: active flag, birthTime, duration,
//   start position (world space), direction vector, length.
//   useFrame runs the scheduler (next single-streak time, next shower
//   time) and updates per-slot attributes each frame.
//
// The streak renders as a narrow tapered line with a tail fade — the
// painterly post-process smooths it into a watercolor arc.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STREAK_POOL = 14;        // max concurrent streaks (covers meteor bursts)
const STREAK_SEGMENTS = 24;    // points per streak trail
const STREAK_LIFETIME = 0.6;   // seconds
const STREAK_LENGTH = 16;      // world units traveled across lifetime

// Scene-space spawn volume — streaks appear on the far side of the camera
// frustum and travel diagonally toward the viewer.
const SPAWN_SPREAD_X = 40;
const SPAWN_SPREAD_Y = 18;
const SPAWN_Z = -28;           // behind the ship, in front of the nebula

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Each slot is one streak worth of points. Pre-allocate the full pool so
// no buffer reallocation happens at runtime.
function makePool() {
  const total = STREAK_POOL * STREAK_SEGMENTS;
  const positions = new Float32Array(total * 3);
  const ageAttr   = new Float32Array(total);  // 0..1 along trail (seg / (STREAK_SEGMENTS-1))
  const lifeAttr  = new Float32Array(total);  // current lifetime progress per slot, 0..1+

  // Pre-fill the segment index once — never changes.
  for (let s = 0; s < STREAK_POOL; s++) {
    for (let i = 0; i < STREAK_SEGMENTS; i++) {
      ageAttr[s * STREAK_SEGMENTS + i] = i / (STREAK_SEGMENTS - 1);
    }
  }

  // Slot metadata (CPU-side, not GPU).
  const slots = [];
  for (let s = 0; s < STREAK_POOL; s++) {
    slots.push({
      active: false,
      birth: 0,
      duration: STREAK_LIFETIME,
      start: new THREE.Vector3(),
      dir:   new THREE.Vector3(),
      length: STREAK_LENGTH,
    });
  }

  return { positions, ageAttr, lifeAttr, slots };
}

function spawnStreak(slot, now) {
  // Random entry point on the back plane — spread across the screen.
  slot.start.set(
    randRange(-SPAWN_SPREAD_X, SPAWN_SPREAD_X),
    randRange(-SPAWN_SPREAD_Y * 0.3, SPAWN_SPREAD_Y),
    SPAWN_Z + randRange(-4, 4),
  );
  // Diagonal trajectory — varied but generally downward-forward.
  slot.dir.set(
    randRange(-0.7, 0.7),
    randRange(-0.9, -0.15),
    randRange(0.6, 1.2),
  ).normalize();
  slot.length = randRange(10, 20);
  slot.duration = randRange(0.45, 0.75);
  slot.birth = now;
  slot.active = true;
}

export default function ShootingStars({ enabled = true }) {
  const pointsRef = useRef();
  const matRef = useRef();

  const pool = useMemo(makePool, []);

  // Scheduler state. Refs so we don't re-render on tick.
  const scheduler = useRef({
    nextSingle: 0,
    nextShower: 0,
    reduced: prefersReducedMotion(),
    initialized: false,
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    if (!enabled) return;
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    const sched = scheduler.current;
    if (!sched.initialized) {
      // First-arm delay so nothing fires on mount.
      sched.nextSingle = t + randRange(3, 8);
      sched.nextShower = t + randRange(60, 120);
      sched.initialized = true;
    }

    // Reduced motion halves cadence by pushing the next-fire times out.
    const cadenceMul = sched.reduced ? 2.0 : 1.0;

    // Single streak scheduler.
    if (t >= sched.nextSingle) {
      const freeSlot = pool.slots.find((s) => !s.active);
      if (freeSlot) spawnStreak(freeSlot, t);
      sched.nextSingle = t + randRange(6, 18) * cadenceMul;
    }

    // Meteor shower burst.
    if (t >= sched.nextShower) {
      const burst = 5 + Math.floor(Math.random() * 4);
      let spawned = 0;
      for (const s of pool.slots) {
        if (spawned >= burst) break;
        if (!s.active) {
          // Stagger each meteor within the burst by a tiny amount so they
          // don't fire on the exact same frame.
          spawnStreak(s, t + spawned * 0.08);
          spawned += 1;
        }
      }
      sched.nextShower = t + randRange(60, 120) * cadenceMul;
    }

    // Update positions for every slot, active or not.
    const { positions, lifeAttr, slots } = pool;
    let anyActive = false;
    for (let s = 0; s < STREAK_POOL; s++) {
      const slot = slots[s];
      const base = s * STREAK_SEGMENTS;
      if (!slot.active) {
        // Park this slot offscreen. Writing zeros every frame is cheap and
        // avoids branching in the shader.
        for (let i = 0; i < STREAK_SEGMENTS; i++) {
          const idx = (base + i) * 3;
          positions[idx]     = 0;
          positions[idx + 1] = 0;
          positions[idx + 2] = -9999;
          lifeAttr[base + i] = 1.1;  // >1 forces full fade
        }
        continue;
      }

      const elapsed = t - slot.birth;
      if (elapsed < 0) {
        // Delayed spawn (meteor burst stagger) — park until birth time.
        for (let i = 0; i < STREAK_SEGMENTS; i++) {
          const idx = (base + i) * 3;
          positions[idx]     = 0;
          positions[idx + 1] = 0;
          positions[idx + 2] = -9999;
          lifeAttr[base + i] = 1.1;
        }
        continue;
      }
      const life = elapsed / slot.duration;
      if (life > 1.0) {
        slot.active = false;
        continue;
      }
      anyActive = true;

      // The "head" of the streak has moved slot.length * life along dir.
      const headX = slot.start.x + slot.dir.x * slot.length * life;
      const headY = slot.start.y + slot.dir.y * slot.length * life;
      const headZ = slot.start.z + slot.dir.z * slot.length * life;

      // Each segment trails the head by a fraction of the full length.
      // Segment 0 = head (brightest); segment N-1 = tail tip (fully faded).
      const trailSpan = slot.length * 0.35;  // visible tail length (world units)
      for (let i = 0; i < STREAK_SEGMENTS; i++) {
        const along = i / (STREAK_SEGMENTS - 1);   // 0 head → 1 tail
        const offset = trailSpan * along;
        const idx = (base + i) * 3;
        positions[idx]     = headX - slot.dir.x * offset;
        positions[idx + 1] = headY - slot.dir.y * offset;
        positions[idx + 2] = headZ - slot.dir.z * offset;
        lifeAttr[base + i] = life;
      }
    }

    const geom = pointsRef.current?.geometry;
    if (geom) {
      geom.attributes.position.needsUpdate = true;
      geom.attributes.aLife.needsUpdate = true;
      // Swap the draw range between 0 and full to skip rasterization
      // entirely on idle frames.
      geom.setDrawRange(0, anyActive ? STREAK_POOL * STREAK_SEGMENTS : 0);
    }
  });

  const total = STREAK_POOL * STREAK_SEGMENTS;

  const vert = /* glsl */ `
    attribute float aAge;   // position along trail, 0 (head) → 1 (tail)
    attribute float aLife;  // lifetime progress of the streak, 0 → 1
    varying float vAge;
    varying float vLife;
    void main(){
      vAge = aAge;
      vLife = aLife;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      // Head is slightly larger; tail tapers.
      float size = mix(3.8, 0.9, aAge);
      gl_PointSize = size * 260.0 / max(-mv.z, 0.1);
      gl_Position = projectionMatrix * mv;
    }
  `;

  const frag = /* glsl */ `
    varying float vAge;
    varying float vLife;
    void main(){
      if (vLife >= 1.0) discard;
      vec2 d = gl_PointCoord - vec2(0.5);
      float r = length(d);
      if (r > 0.5) discard;

      float soft = smoothstep(0.5, 0.02, r);
      // Head white-hot → tail amber
      vec3 head = vec3(1.00, 0.96, 0.86);
      vec3 tail = vec3(1.00, 0.68, 0.22);
      vec3 color = mix(head, tail, vAge);

      // Alpha fades along trail AND over streak lifetime (in-out easing).
      float trailFade = pow(1.0 - vAge, 1.3);
      float lifeFade = 1.0 - smoothstep(0.7, 1.0, vLife);
      float alpha = soft * trailFade * lifeFade;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={pool.positions}
          count={total}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aAge"
          array={pool.ageAttr}
          count={total}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aLife"
          array={pool.lifeAttr}
          count={total}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
