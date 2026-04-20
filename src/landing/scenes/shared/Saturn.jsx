// PlanetThumb (Saturn) — day-side utopia for /features.
//
// Emerald continents, teal oceans, cream cloud wisps. Painterly
// watercolor style with ink-outlined coastlines. Yellow-gradient ring
// with drifting sparkles. Planet body rotates on its axis;
// continents, oceans, clouds all visibly carry with it.
//
// No night side, no terminator, no city lights, no fireworks.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TILT_X = 1.22;

const RING_CONFIGS = [
  { inner: 0.75, outer: 1.00 },
];

// Ring is split circumferentially into two halves — lavender and
// pink — with soft blends where they meet. The shader uses uCInner
// as the "A" half (pink) and uCOuter as the "B" half (lavender).
// uCMid is unused here but kept in the uniform block for parity.
const RING_COLOR_INNER = new THREE.Color('#f8c0d0'); // soft pink (half A)
const RING_COLOR_MID   = new THREE.Color('#ffffff'); // unused
const RING_COLOR_OUTER = new THREE.Color('#c8a8e8'); // soft lavender (half B)

const PLANET_RADIUS = 0.6;

// Fireworks scheduler config.
const FIREWORK_SLOTS     = 8;
const FIREWORK_SPARKS    = 30;
const FIREWORK_LAUNCH_S  = 1.0;
const FIREWORK_EXPLODE_S = 1.2;

function randRange(min, max) { return min + Math.random() * (max - min); }

// ─── Planet shader ─────────────────────────────────────────────────────────

const PLANET_VERT = /* glsl */ `
  varying vec3 vObjectPos;
  varying vec3 vViewNormal;
  void main() {
    vObjectPos  = position;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLANET_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec3  vObjectPos;
  varying vec3  vViewNormal;

  vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 perm(vec4 x) { return mod289v4(((x*34.0)+1.0)*x); }
  float noise3(vec3 p) {
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d*d*(3.0-2.0*d);
    vec4 b = a.xxyy + vec4(0.0,1.0,0.0,1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);
    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);
    vec4 o1 = fract(k3 * (1.0/41.0));
    vec4 o2 = fract(k4 * (1.0/41.0));
    vec4 o3 = o2*d.z + o1*(1.0-d.z);
    vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
    return o4.y*d.y + o4.x*(1.0-d.y);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise3(p);
      p = p * 2.0 + vec3(100.0);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Landmasses — fBm threshold near 0.5 gives organic coastlines.
    float landmass = fbm(vObjectPos * 1.8 + vec3(47.3));
    float isLand   = smoothstep(0.48, 0.52, landmass);

    // Ocean — teal/aqua gradient keyed to shore proximity so
    // shallows brighten toward the coast.
    float shoreProx = smoothstep(0.30, 0.48, landmass); // 0 deep, 1 at shore
    vec3 oceanDeep    = vec3(0.102, 0.290, 0.345); // #1a4a58
    vec3 oceanMid     = vec3(0.165, 0.502, 0.565); // #2a8090
    vec3 oceanShallow = vec3(0.290, 0.753, 0.784); // #4ac0c8
    vec3 oceanCol = mix(oceanDeep, oceanMid, smoothstep(0.0, 0.55, shoreProx));
    oceanCol      = mix(oceanCol, oceanShallow, smoothstep(0.55, 1.0, shoreProx));

    // Continents — lavender interior → mauve → coral at the coast.
    // Inlandness = how far past the coast threshold we sit.
    float inlandness = smoothstep(0.52, 0.75, landmass);
    vec3 landCoast  = vec3(0.941, 0.627, 0.565); // #f0a090 coral
    vec3 landMid    = vec3(0.753, 0.596, 0.690); // #c098b0 mauve
    vec3 landInner  = vec3(0.659, 0.565, 0.816); // #a890d0 lavender
    vec3 landCol = mix(landCoast, landMid, smoothstep(0.0, 0.55, inlandness));
    landCol      = mix(landCol,  landInner, smoothstep(0.55, 1.0, inlandness));

    vec3 col = mix(oceanCol, landCol, isLand);

    // Painterly ink coastline — narrow dark band around the land edge.
    float coastLine = 1.0 - smoothstep(0.004, 0.022, abs(landmass - 0.5));
    col = mix(col, vec3(0.10, 0.06, 0.09), coastLine * 0.55);

    // Golden rivers — thin glowing gold lines traced across inland
    // continents. Ridge-threshold a mid-freq noise so we get curved
    // line-like features, gate by landmass > threshold so rivers
    // don't form at the immediate coast or out in the ocean.
    float riverNoise = fbm(vObjectPos * 7.5 + vec3(333.0));
    float river = 1.0 - smoothstep(0.012, 0.042, abs(riverNoise - 0.5));
    float riverMask = river * smoothstep(0.54, 0.62, landmass);
    vec3 riverGold = vec3(1.00, 0.85, 0.28); // #ffd848
    col = mix(col, riverGold, riverMask * 0.85);
    col += riverGold * riverMask * 0.25; // slight radiant glow

    // Drifting cream-pink cloud wisps — time-animated on X so they
    // sweep past the rotating surface.
    float clouds = fbm(vObjectPos * 3.5 + vec3(uTime * 0.03, 0.0, 0.0));
    float cloudMask = smoothstep(0.55, 0.72, clouds);
    vec3 cloudCol = vec3(1.000, 0.894, 0.816); // #ffe4d0
    col = mix(col, cloudCol, cloudMask * 0.42);

    // Pink-cream atmosphere halo at the limb.
    float viewDot = clamp(dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
    float fresnel = pow(1.0 - viewDot, 2.4);
    vec3 halo = vec3(1.000, 0.800, 0.750); // warm cream-pink
    col += halo * fresnel * 0.50;

    // Ink silhouette darkening — painterly edge.
    float ink = smoothstep(0.0, 0.09, viewDot);
    col *= 0.65 + ink * 0.35;

    // Keep the limb from collapsing to pure black.
    col += oceanDeep * 0.15;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Ring shader ───────────────────────────────────────────────────────────

const RING_VERT = /* glsl */ `
  varying vec2 vLocalXY;
  void main() {
    vLocalXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  precision highp float;
  uniform float uInnerR;
  uniform float uOuterR;
  uniform vec3  uCInner;
  uniform vec3  uCMid;
  uniform vec3  uCOuter;
  varying vec2  vLocalXY;

  void main() {
    float r = length(vLocalXY);
    float t = clamp((r - uInnerR) / max(uOuterR - uInnerR, 0.001), 0.0, 1.0);
    float edge = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.82, t);

    // Angular half-and-half blend: sin(angle) splits the ring into
    // two hemispheres. smoothstep widens the blend zone at the two
    // meeting points so the transition feels soft, not linear.
    float angle = atan(vLocalXY.y, vLocalXY.x);
    float mixT  = smoothstep(0.15, 0.85, sin(angle) * 0.5 + 0.5);
    vec3 col = mix(uCInner, uCOuter, mixT);

    // Retain the fine scatter / dense variation for texture.
    float dense = sin(angle * 7.0) * 0.5 + 0.5;
    float scatter = sin(angle * 23.0 + 2.0) * 0.5 + 0.5;
    float brightness = 0.65 + scatter * 0.35;

    float alpha = edge * (0.55 + dense * 0.45);
    gl_FragColor = vec4(col * brightness * 1.3, alpha);
  }
`;

// ─── Fireworks ─────────────────────────────────────────────────────────────

const FIREWORK_VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aTint;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vAlpha = aAlpha;
    vTint  = aTint;
    gl_PointSize = 12.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FIREWORK_FRAG = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vTint;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.1, d);
    vec3 purple = vec3(0.627, 0.439, 0.878); // #a070e0
    vec3 aqua   = vec3(0.416, 0.878, 0.816); // #6ae0d0
    vec3 pink   = vec3(0.941, 0.627, 0.753); // #f0a0c0
    vec3 silver = vec3(0.816, 0.816, 0.878); // #d0d0e0
    vec3 col;
    if      (vTint < 0.25) col = purple;
    else if (vTint < 0.50) col = aqua;
    else if (vTint < 0.75) col = pink;
    else                   col = silver;
    col = mix(col, vec3(1.0, 1.0, 1.0), smoothstep(0.30, 0.0, d));
    gl_FragColor = vec4(col, edge * vAlpha);
  }
`;

function Fireworks() {
  const launchRef = useRef();
  const burstRef  = useRef();

  const slots = useMemo(() => Array.from({ length: FIREWORK_SLOTS }, () => ({
    phase: 'inactive',
    t0: 0,
    originX: 0, originY: 0, originZ: 0,
    dirX: 0,    dirY: 0,    dirZ: 0,
    peakAlt: 0,
    tint: 0,
    sparks: Array.from({ length: FIREWORK_SPARKS }, () => ({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    })),
  })), []);

  const launchGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FIREWORK_SLOTS * 3), 3));
    g.setAttribute('aAlpha',   new THREE.BufferAttribute(new Float32Array(FIREWORK_SLOTS), 1));
    g.setAttribute('aTint',    new THREE.BufferAttribute(new Float32Array(FIREWORK_SLOTS), 1));
    return g;
  }, []);

  const burstGeo = useMemo(() => {
    const total = FIREWORK_SLOTS * FIREWORK_SPARKS;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    g.setAttribute('aAlpha',   new THREE.BufferAttribute(new Float32Array(total), 1));
    g.setAttribute('aTint',    new THREE.BufferAttribute(new Float32Array(total), 1));
    return g;
  }, []);

  const fireworkMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: FIREWORK_VERT,
    fragmentShader: FIREWORK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const nextArmRef = useRef(randRange(0.5, 1.0));

  function armSlot(slot, now) {
    // No hubs on the day-side planet — bursts happen in orbit.
    // Pick a random direction on the visible hemisphere (world
    // z > threshold after outer tilt) and launch slightly above
    // the atmosphere.
    const cosT = Math.cos(TILT_X);
    const sinT = Math.sin(TILT_X);
    for (let attempt = 0; attempt < 10; attempt++) {
      const u   = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r   = Math.sqrt(1 - u * u);
      const dx = r * Math.cos(phi);
      const dy = u;
      const dz = r * Math.sin(phi);
      const wz = dy * sinT + dz * cosT;
      if (wz > 0.15) {
        const launchAlt = 0.20; // start above atmosphere
        slot.dirX = dx; slot.dirY = dy; slot.dirZ = dz;
        slot.originX = dx * (PLANET_RADIUS + launchAlt);
        slot.originY = dy * (PLANET_RADIUS + launchAlt);
        slot.originZ = dz * (PLANET_RADIUS + launchAlt);
        slot.peakAlt = randRange(0.50, 1.40);
        slot.tint    = Math.random();
        slot.t0      = now;
        slot.phase   = 'launching';
        return;
      }
    }
  }

  function triggerExplode(slot, now) {
    slot.phase = 'exploding';
    slot.t0 = now;
    const cx = slot.originX + slot.dirX * slot.peakAlt;
    const cy = slot.originY + slot.dirY * slot.peakAlt;
    const cz = slot.originZ + slot.dirZ * slot.peakAlt;
    for (let j = 0; j < FIREWORK_SPARKS; j++) {
      const sp = slot.sparks[j];
      const u   = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r   = Math.sqrt(1 - u * u);
      const speed = randRange(0.50, 1.05);
      sp.vx = r * Math.cos(phi) * speed;
      sp.vy = u * speed;
      sp.vz = r * Math.sin(phi) * speed;
      sp.x  = cx; sp.y = cy; sp.z = cz;
    }
  }

  useFrame((_, delta) => {
    const now = performance.now() / 1000;

    nextArmRef.current -= delta;
    if (nextArmRef.current <= 0) {
      for (const s of slots) {
        if (s.phase === 'inactive') { armSlot(s, now); break; }
      }
      nextArmRef.current = randRange(1.5, 2.0);
    }

    if (!launchRef.current || !burstRef.current) return;
    const lPos   = launchRef.current.geometry.attributes.position.array;
    const lAlpha = launchRef.current.geometry.attributes.aAlpha.array;
    const lTint  = launchRef.current.geometry.attributes.aTint.array;
    const bPos   = burstRef.current.geometry.attributes.position.array;
    const bAlpha = burstRef.current.geometry.attributes.aAlpha.array;
    const bTint  = burstRef.current.geometry.attributes.aTint.array;

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const age = now - s.t0;

      if (s.phase === 'launching') {
        if (age >= FIREWORK_LAUNCH_S) {
          triggerExplode(s, now);
        } else {
          const p = age / FIREWORK_LAUNCH_S;
          const alt = s.peakAlt * (p * p);
          lPos[i * 3]     = s.originX + s.dirX * alt;
          lPos[i * 3 + 1] = s.originY + s.dirY * alt;
          lPos[i * 3 + 2] = s.originZ + s.dirZ * alt;
          lAlpha[i] = 1.0;
          lTint[i]  = s.tint;
          for (let j = 0; j < FIREWORK_SPARKS; j++) {
            bAlpha[i * FIREWORK_SPARKS + j] = 0;
          }
        }
      }

      if (s.phase === 'exploding') {
        const p = age / FIREWORK_EXPLODE_S;
        if (p >= 1.0) {
          s.phase = 'inactive';
          lAlpha[i] = 0;
          for (let j = 0; j < FIREWORK_SPARKS; j++) {
            bAlpha[i * FIREWORK_SPARKS + j] = 0;
          }
        } else {
          lAlpha[i] = 0;
          const fade = 1.0 - p;
          for (let j = 0; j < FIREWORK_SPARKS; j++) {
            const sp = s.sparks[j];
            sp.x += sp.vx * delta;
            sp.y += sp.vy * delta;
            sp.z += sp.vz * delta;
            const idx = (i * FIREWORK_SPARKS + j) * 3;
            bPos[idx]     = sp.x;
            bPos[idx + 1] = sp.y;
            bPos[idx + 2] = sp.z;
            bAlpha[i * FIREWORK_SPARKS + j] = fade * 0.95;
            bTint[i * FIREWORK_SPARKS + j]  = s.tint;
          }
        }
      }

      if (s.phase === 'inactive') {
        lAlpha[i] = 0;
      }
    }

    launchRef.current.geometry.attributes.position.needsUpdate = true;
    launchRef.current.geometry.attributes.aAlpha.needsUpdate   = true;
    launchRef.current.geometry.attributes.aTint.needsUpdate    = true;
    burstRef.current.geometry.attributes.position.needsUpdate  = true;
    burstRef.current.geometry.attributes.aAlpha.needsUpdate    = true;
    burstRef.current.geometry.attributes.aTint.needsUpdate     = true;
  });

  return (
    <>
      <points ref={launchRef} geometry={launchGeo} material={fireworkMat} />
      <points ref={burstRef}  geometry={burstGeo}  material={fireworkMat} />
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function Saturn({
  position = [4, 1.5, -2],
  scale = 1,
  emberCount = 12,
}) {
  const outerRef  = useRef();
  const planetRef = useRef();
  const ringsRef  = useRef();
  const emberRef  = useRef();

  const planetMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT,
    fragmentShader: PLANET_FRAG,
    uniforms: { uTime: { value: 0 } },
  }), []);

  const ringMats = useMemo(() => RING_CONFIGS.map((r) => new THREE.ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uInnerR: { value: r.inner },
      uOuterR: { value: r.outer },
      uCInner: { value: RING_COLOR_INNER.clone() },
      uCMid:   { value: RING_COLOR_MID.clone()   },
      uCOuter: { value: RING_COLOR_OUTER.clone() },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })), []);

  // Yellow/amber sparkle pool drifting off the ring.
  const embers = useMemo(() => Array.from({ length: emberCount }, () => ({
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    age: randRange(0, 2.5),
    life: randRange(1.8, 3.0),
    tint: Math.random(),
  })), [emberCount]);

  const emberGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(emberCount * 3), 3));
    geo.setAttribute('aAlpha',   new THREE.BufferAttribute(new Float32Array(emberCount), 1));
    geo.setAttribute('aTint',    new THREE.BufferAttribute(new Float32Array(emberCount), 1));
    return geo;
  }, [emberCount]);

  const emberMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: `
      attribute float aAlpha;
      attribute float aTint;
      varying float vAlpha;
      varying float vTint;
      void main() {
        vAlpha = aAlpha;
        vTint  = aTint;
        gl_PointSize = 5.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vTint;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float edge = smoothstep(0.5, 0.1, d);
        vec3 lavender = vec3(0.784, 0.659, 0.910); // #c8a8e8
        vec3 pink     = vec3(0.973, 0.753, 0.816); // #f8c0d0
        vec3 tinted = vTint < 0.5 ? lavender : pink;
        // Cool white-pearl core — matches the pastel palette.
        vec3 col = mix(tinted, vec3(1.0, 1.0, 1.0), smoothstep(0.3, 0.0, d));
        gl_FragColor = vec4(col, edge * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  function respawnEmber(e) {
    const ring  = RING_CONFIGS[Math.floor(Math.random() * RING_CONFIGS.length)];
    const r     = randRange(ring.inner, ring.outer);
    const theta = Math.random() * Math.PI * 2;
    e.x = Math.cos(theta) * r;
    e.y = 0;
    e.z = Math.sin(theta) * r;
    const speed = randRange(0.12, 0.22);
    e.vx = Math.cos(theta) * speed * 0.6 + randRange(-0.03, 0.03);
    e.vy = randRange(0.18, 0.28);
    e.vz = Math.sin(theta) * speed * 0.6 + randRange(-0.03, 0.03);
    e.age  = 0;
    e.life = randRange(2.0, 3.0);
    e.tint = Math.random();
  }

  useFrame((_, delta) => {
    const t = performance.now() / 1000;
    planetMat.uniforms.uTime.value = t;
    if (planetRef.current) planetRef.current.rotation.y = t * 0.052; // 120 s / rev
    if (ringsRef.current)  ringsRef.current.rotation.y  = t * 0.062; // ~101 s / rev

    if (!emberRef.current) return;
    const pos    = emberRef.current.geometry.attributes.position.array;
    const alphas = emberRef.current.geometry.attributes.aAlpha.array;
    const tints  = emberRef.current.geometry.attributes.aTint.array;
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.age += delta;
      if (e.age > e.life) respawnEmber(e);
      e.x += e.vx * delta;
      e.y += e.vy * delta;
      e.z += e.vz * delta;
      const lifeT = e.age / e.life;
      alphas[i] = Math.max(0, 1 - lifeT) * 0.9;
      tints[i]  = e.tint;
      pos[i * 3]     = e.x;
      pos[i * 3 + 1] = e.y;
      pos[i * 3 + 2] = e.z;
    }
    emberRef.current.geometry.attributes.position.needsUpdate = true;
    emberRef.current.geometry.attributes.aAlpha.needsUpdate   = true;
    emberRef.current.geometry.attributes.aTint.needsUpdate    = true;
  });

  return (
    <group ref={outerRef} position={position} scale={scale} rotation={[TILT_X, 0, 0]}>
      <group ref={planetRef}>
        <mesh material={planetMat}>
          <sphereGeometry args={[PLANET_RADIUS, 48, 32]} />
        </mesh>
      </group>

      <group ref={ringsRef} position={[-0.07, 0, 0]}>
        {RING_CONFIGS.map((r, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]} material={ringMats[i]}>
            <ringGeometry args={[r.inner, r.outer, 128]} />
          </mesh>
        ))}
      </group>

      <points ref={emberRef} geometry={emberGeo} material={emberMat} />

      <Fireworks />
    </group>
  );
}
