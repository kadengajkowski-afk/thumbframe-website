// Engine plume — 4 concentric noise-displaced shells for a clear temperature
// gradient (white-hot core → amber → orange → deep red). Emissive nozzle disc
// and rim ring prevent the "dark hole" at the ship/flame interface.
// Spark particle system with large HDR points trailing behind the plume.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Shared simplex noise for vertex shaders ─────────────────────────────────

const simplexNoise = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g,l.zxy);
    vec3 i2=max(g,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

// ── Flame shell — one layer of the stacked volumetric flame ─────────────────

const shellVert = /* glsl */ `
  uniform float uTime;
  uniform float uDisplace;
  uniform float uFreq;
  uniform float uSeed;
  varying float vProgress;
  ${simplexNoise}

  void main() {
    // uv.y: 0 at base (wide end), 1 at tip (narrow end) on a cylinder side
    vProgress = uv.y;

    float baseFactor = 1.0 - vProgress * 0.5; // displace mostly at base
    float n1 = snoise(position * uFreq + vec3(uSeed, uTime * 3.5, 0.0));
    float n2 = snoise(position * uFreq * 2.1 + vec3(uTime * 2.3, uSeed * 1.7, uTime * 1.9));
    float disp = (n1 * 0.65 + n2 * 0.35) * uDisplace * baseFactor;

    vec3 radDir = vec3(position.x, 0.0, position.z);
    float rl = length(radDir);
    if (rl > 0.001) radDir /= rl;

    vec3 displaced = position + radDir * disp;

    // Jitter the tip elongation
    displaced.y += snoise(vec3(uTime * 4.0 + uSeed, position.x * 3.0, position.z * 3.0))
                   * 0.10 * vProgress;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const shellFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uAlpha;
  uniform float uTime;
  uniform float uSeed;
  uniform float uTipFade;   // 0..1 — fraction of length over which alpha fades to 0
  varying float vProgress;
  ${simplexNoise}

  void main() {
    // Alpha fades axially from base → tip
    float fadeStart = 1.0 - uTipFade;
    float axial = 1.0 - smoothstep(fadeStart, 1.0, vProgress);
    axial = pow(axial, 1.3);

    // Flicker (breaks uniform banding)
    float flicker = 0.82 + 0.18 * snoise(vec3(vProgress * 3.5, uSeed * 2.1, uTime * 3.0));

    vec3 color = uColor * uIntensity * flicker;
    float alpha = uAlpha * axial;

    gl_FragColor = vec4(color, alpha);
  }
`;

function FlameShell({
  baseRad, tipRad, length, color, intensity, alpha,
  displace, freq, seed, tipFade,
}) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uIntensity: { value: intensity },
    uAlpha: { value: alpha },
    uDisplace: { value: displace },
    uFreq: { value: freq },
    uSeed: { value: seed },
    uTipFade: { value: tipFade },
  }), [color, intensity, alpha, displace, freq, seed, tipFade]);

  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  // Cylinder: Y-axis aligned, top=+Y=tipRad, bottom=-Y=baseRad.
  // Rotate Z by +π/2 so +Y → -X (flame trails rearward).
  // Shift by -length/2 so base sits at world x = 0.
  return (
    <mesh rotation={[0, 0, Math.PI / 2]} position={[-length / 2, 0, 0]}>
      <cylinderGeometry args={[tipRad, baseRad, length, 32, 20, true]} />
      <shaderMaterial
        vertexShader={shellVert}
        fragmentShader={shellFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Flame stack — 4 concentric shells give automatic radial gradient ────────

function FlameStack() {
  return (
    <>
      {/* Outer shell — deep red #c82020 at the fringe */}
      <FlameShell
        baseRad={0.46} tipRad={0.08} length={2.8}
        color="#c82020" intensity={0.9} alpha={0.35}
        displace={0.38} freq={1.8} seed={0.3} tipFade={0.85}
      />
      {/* Mid shell — orange #f97316 body */}
      <FlameShell
        baseRad={0.34} tipRad={0.055} length={2.4}
        color="#f97316" intensity={1.4} alpha={0.42}
        displace={0.28} freq={2.4} seed={1.7} tipFade={0.75}
      />
      {/* Inner shell — bright amber #ffd890 */}
      <FlameShell
        baseRad={0.22} tipRad={0.04} length={1.95}
        color="#ffd890" intensity={1.8} alpha={0.55}
        displace={0.2} freq={2.9} seed={3.1} tipFade={0.65}
      />
      {/* Hot core — white-hot #fff5e0 emissive */}
      <FlameShell
        baseRad={0.11} tipRad={0.02} length={1.35}
        color="#fff5e0" intensity={2.4} alpha={0.85}
        displace={0.1} freq={3.6} seed={5.4} tipFade={0.55}
      />
    </>
  );
}

// ── Nozzle — emissive disc + rim ring replaces the "dark hole" ──────────────

function Nozzle() {
  // Pulse the rim slightly so heat looks alive
  const discRef = useRef();
  const ringRef = useRef();
  const outerRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 0.9 + 0.1 * Math.sin(t * 6.0);
    if (discRef.current) discRef.current.material.opacity = 0.95 * pulse;
    if (ringRef.current) ringRef.current.material.opacity = 0.95 * pulse;
    if (outerRef.current) outerRef.current.material.opacity = 0.45 * pulse;
  });

  return (
    <group>
      {/* Emissive amber disc — the glowing opening */}
      <mesh
        ref={discRef}
        position={[0.02, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <circleGeometry args={[0.42, 40]} />
        <meshBasicMaterial
          color="#ffb060"
          toneMapped={false}
          transparent
          opacity={0.95}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bright rim ring around the opening */}
      <mesh
        ref={ringRef}
        position={[0.025, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <ringGeometry args={[0.4, 0.5, 40]} />
        <meshBasicMaterial
          color="#ffe0a0"
          toneMapped={false}
          transparent
          opacity={0.95}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Softer outer heat bloom */}
      <mesh
        ref={outerRef}
        position={[0.03, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <ringGeometry args={[0.48, 0.68, 40]} />
        <meshBasicMaterial
          color="#ff7020"
          toneMapped={false}
          transparent
          opacity={0.45}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── Spark particles ─────────────────────────────────────────────────────────

const SPARK_COUNT = 60;

function initSpark(pos, vel, i) {
  // Spawn along the first ~30% of the flame trail, with small lateral scatter
  const spawnX = -Math.random() * 0.8;
  const scatter = 0.1 + Math.abs(spawnX) * 0.2;
  pos[i * 3]     = spawnX;
  pos[i * 3 + 1] = (Math.random() - 0.5) * scatter;
  pos[i * 3 + 2] = (Math.random() - 0.5) * scatter;

  const speed = 1.2 + Math.random() * 2.2;
  const angle = Math.random() * Math.PI * 2;
  const spread = 0.25 + Math.random() * 0.5; // radial component
  vel[i * 3]     = -speed;                          // mostly rearward
  vel[i * 3 + 1] = Math.cos(angle) * speed * spread * 0.35;
  vel[i * 3 + 2] = Math.sin(angle) * speed * spread * 0.35;
}

function Sparks() {
  const pRef = useRef();

  const { positions, velocities, ages, lifetimes, sizes } = useMemo(() => {
    const positions = new Float32Array(SPARK_COUNT * 3);
    const velocities = new Float32Array(SPARK_COUNT * 3);
    const ages = new Float32Array(SPARK_COUNT);
    const lifetimes = new Float32Array(SPARK_COUNT);
    const sizes = new Float32Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) {
      sizes[i] = 0.14 + Math.random() * 0.14;
      lifetimes[i] = 0.65 + Math.random() * 0.25;
      initSpark(positions, velocities, i);
      ages[i] = Math.random() * lifetimes[i];
    }
    return { positions, velocities, ages, lifetimes, sizes };
  }, []);

  useFrame((_, dt) => {
    const clampedDt = Math.min(dt, 0.05);
    for (let i = 0; i < SPARK_COUNT; i++) {
      ages[i] += clampedDt;
      if (ages[i] >= lifetimes[i]) {
        initSpark(positions, velocities, i);
        ages[i] = 0;
      }
      positions[i * 3]     += velocities[i * 3]     * clampedDt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * clampedDt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * clampedDt;
      velocities[i * 3]     *= 0.96;
      velocities[i * 3 + 1] *= 0.96;
      velocities[i * 3 + 2] *= 0.96;
    }
    if (pRef.current) {
      pRef.current.geometry.attributes.position.needsUpdate = true;
      pRef.current.geometry.attributes.aAge.needsUpdate = true;
    }
  });

  const vert = /* glsl */ `
    attribute float aSize;
    attribute float aAge;
    attribute float aLifetime;
    varying float vLife;
    void main(){
      vLife = clamp(aAge / aLifetime, 0.0, 1.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      // Large, distance-scaled points so sparks actually read
      gl_PointSize = aSize * 520.0 / max(-mv.z, 0.1);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const frag = /* glsl */ `
    varying float vLife;
    void main(){
      vec2 d = gl_PointCoord - vec2(0.5);
      float dist = length(d);
      if (dist > 0.5) discard;
      float soft = smoothstep(0.5, 0.05, dist);
      // Warm amber at birth → dark red at death
      vec3 birth = vec3(1.5, 0.85, 0.32);
      vec3 death = vec3(0.55, 0.08, 0.03);
      vec3 col = mix(birth, death, vLife);
      float alpha = soft * (1.0 - vLife * 0.92);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  return (
    <points ref={pRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={SPARK_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={SPARK_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aAge" array={ages} count={SPARK_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aLifetime" array={lifetimes} count={SPARK_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{}}
        transparent
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Depth proxy ─────────────────────────────────────────────────────────────
// All flame shells use depthWrite=false (required for clean additive
// stacking), so the ship's own silhouette leaks through the flame region
// and the depth-Sobel OutlineEffect traces a zigzag behind the shells.
// Kuwahara sees the flame pixels as "far" (clear depth) and applies the
// big painterly kernel, which shreds the crisp gradient.
//
// Fix: a color-silent cone whose envelope matches the outermost flame
// shell. It writes depth but nothing else, so the painterly passes treat
// flame pixels as "near" geometry and stop chewing at the edges.
function FlameDepthProxy() {
  return (
    <mesh
      rotation={[0, 0, Math.PI / 2]}
      position={[-2.8 / 2, 0, 0]}
      renderOrder={-1}
    >
      <cylinderGeometry args={[0.08, 0.46, 2.8, 32, 1, true]} />
      <meshBasicMaterial colorWrite={false} depthWrite={true} />
    </mesh>
  );
}

// ── Export ──────────────────────────────────────────────────────────────────

export default function EnginePlume({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Proxy renders first so its depth is visible to the post-process
          passes even though the subsequent shells paint over it. */}
      <FlameDepthProxy />
      <Nozzle />
      <FlameStack />
      <Sparks />
    </group>
  );
}
