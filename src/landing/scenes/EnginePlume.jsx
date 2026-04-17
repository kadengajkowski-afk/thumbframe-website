// Engine plume — real geometry cone flame with noise displacement,
// inner white-hot core cone, spark particles, dark metal nozzle bell.

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

// ── Outer flame cone — noise-displaced, turbulent silhouette ────────────────

const outerFlameVert = /* glsl */ `
  uniform float uTime;
  varying float vProgress;
  varying float vRadialDist;
  ${simplexNoise}

  void main() {
    // progress: 0 at base (nozzle), 1 at tip
    // ConeGeometry Y goes from -height/2 (base) to +height/2 (tip)
    vProgress = (position.y + 1.25) / 2.5; // height=2.5, centered

    // Radial distance from cone axis (how far from center)
    vRadialDist = length(position.xz);

    // Noise displacement — strongest at base, zero at tip
    float baseFactor = 1.0 - vProgress;
    float n1 = snoise(position * 2.0 + vec3(0.0, uTime * 4.0, 0.0));
    float n2 = snoise(position * 4.0 + vec3(uTime * 3.0, 0.0, uTime * 2.0));
    float displacement = (n1 * 0.6 + n2 * 0.4) * 0.3 * baseFactor;

    // Push outward radially
    vec3 radialDir = vec3(position.x, 0.0, position.z);
    float radLen = length(radialDir);
    if (radLen > 0.001) radialDir /= radLen;

    vec3 displaced = position + radialDir * displacement;

    // Also jitter the tip slightly
    displaced.y += snoise(vec3(uTime * 5.0, position.x * 3.0, position.z * 3.0)) * 0.15 * vProgress;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const outerFlameFrag = /* glsl */ `
  uniform float uTime;
  varying float vProgress;
  varying float vRadialDist;
  ${simplexNoise}

  void main() {
    // Inner turbulence pattern
    float turb = snoise(vec3(vProgress * 5.0, vRadialDist * 8.0, uTime * 3.0)) * 0.5 + 0.5;

    // Color ramp: tip → base
    vec3 tipColor      = vec3(0.16, 0.03, 0.03); // #2a0808 nearly invisible
    vec3 outerRed      = vec3(0.78, 0.13, 0.13); // #c82020
    vec3 orangeMid     = vec3(0.98, 0.45, 0.09); // #f97316
    vec3 hotAmber      = vec3(1.0, 0.85, 0.56);  // #ffd890
    vec3 whiteHot      = vec3(1.0, 0.96, 0.88);  // #fff5e0

    float p = vProgress;
    vec3 color;
    if (p > 0.8) color = mix(outerRed, tipColor, (p - 0.8) / 0.2);
    else if (p > 0.5) color = mix(orangeMid, outerRed, (p - 0.5) / 0.3);
    else if (p > 0.2) color = mix(hotAmber, orangeMid, (p - 0.2) / 0.3);
    else color = mix(whiteHot, hotAmber, p / 0.2);

    // Radial falloff: center is hotter
    float maxRadius = mix(0.4, 0.05, p); // cone radius at this height
    float radialNorm = clamp(vRadialDist / max(maxRadius, 0.01), 0.0, 1.0);
    color = mix(color, mix(color, whiteHot, 0.5), (1.0 - radialNorm) * (1.0 - p));

    // Turbulence modulation
    color *= 0.85 + turb * 0.3;

    // Alpha: base opaque, tip transparent
    float alpha = (1.0 - p) * 0.85;
    alpha *= smoothstep(1.0, 0.5, radialNorm); // soft edges

    gl_FragColor = vec4(color, alpha);
  }
`;

function OuterFlame() {
  const ref = useRef();
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  // Cone: base radius 0.4 (at nozzle), tip radius 0.05, length 2.5
  // Points along +Y by default. We rotate so +Y = rearward (-X in world).
  return (
    <mesh ref={ref} rotation={[0, 0, Math.PI / 2]} position={[-1.25, 0, 0]}>
      <coneGeometry args={[0.05, 2.5, 32, 16, true]} />
      <shaderMaterial
        vertexShader={outerFlameVert}
        fragmentShader={outerFlameFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Inner white-hot core cone — smaller, brighter ───────────────────────────

const innerCoreVert = /* glsl */ `
  uniform float uTime;
  varying float vProgress;
  ${simplexNoise}

  void main() {
    vProgress = (position.y + 0.75) / 1.5;
    float n = snoise(position * 3.0 + vec3(0.0, uTime * 5.0, 0.0));
    vec3 radDir = vec3(position.x, 0.0, position.z);
    float rl = length(radDir);
    if (rl > 0.001) radDir /= rl;
    vec3 displaced = position + radDir * n * 0.08 * (1.0 - vProgress);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const innerCoreFrag = /* glsl */ `
  varying float vProgress;
  void main() {
    vec3 white = vec3(1.0, 0.98, 0.92);
    vec3 amber = vec3(1.0, 0.85, 0.5);
    vec3 color = mix(white, amber, vProgress);
    float alpha = (1.0 - vProgress) * 0.9;
    gl_FragColor = vec4(color, alpha);
  }
`;

function InnerCore() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  return (
    <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.75, 0, 0]}>
      <coneGeometry args={[0.02, 1.5, 16, 8, true]} />
      <shaderMaterial
        vertexShader={innerCoreVert}
        fragmentShader={innerCoreFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Spark particles ─────────────────────────────────────────────────────────

const SPARK_COUNT = 60;

function resetSpark(pos, vel, lt, age, sz, i) {
  pos[i*3]   = 0;
  pos[i*3+1] = (Math.random()-0.5)*0.15;
  pos[i*3+2] = (Math.random()-0.5)*0.15;
  const speed = 1.5 + Math.random()*2.5;
  const spread = 0.35; // ~20° half-angle
  vel[i] = [
    -speed,
    Math.sin((Math.random()-0.5)*spread)*speed*0.2,
    Math.sin((Math.random()-0.5)*spread)*speed*0.2,
  ];
  lt[i] = 0.6 + Math.random()*0.4;
  age[i] = 0;
  sz[i] = 0.05 + Math.random()*0.07;
}

function Sparks() {
  const pRef = useRef();
  const { positions, velocities, lifetimes, ages, sizes } = useMemo(() => {
    const p = new Float32Array(SPARK_COUNT*3);
    const v = Array.from({length:SPARK_COUNT},()=>[0,0,0]);
    const lt = new Float32Array(SPARK_COUNT);
    const a = new Float32Array(SPARK_COUNT);
    const s = new Float32Array(SPARK_COUNT);
    for (let i=0;i<SPARK_COUNT;i++) { resetSpark(p,v,lt,a,s,i); a[i]=Math.random()*lt[i]; }
    return {positions:p,velocities:v,lifetimes:lt,ages:a,sizes:s};
  },[]);

  useFrame((_,dt) => {
    for (let i=0;i<SPARK_COUNT;i++) {
      ages[i]+=dt;
      if (ages[i]>=lifetimes[i]) resetSpark(positions,velocities,lifetimes,ages,sizes,i);
      positions[i*3]  +=velocities[i][0]*dt;
      positions[i*3+1]+=velocities[i][1]*dt;
      positions[i*3+2]+=velocities[i][2]*dt;
      velocities[i][0]*=0.97;
      velocities[i][1]*=0.97;
      velocities[i][2]*=0.97;
    }
    if (pRef.current) {
      pRef.current.geometry.attributes.position.needsUpdate=true;
      pRef.current.geometry.attributes.aAge.needsUpdate=true;
    }
  });

  const vert = /* glsl */ `
    attribute float aSize;
    attribute float aAge;
    attribute float aLifetime;
    varying float vLife;
    void main(){
      vLife=clamp(aAge/aLifetime,0.0,1.0);
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=aSize*(1.0-vLife*0.4)*180.0/-mv.z;
      gl_Position=projectionMatrix*mv;
    }
  `;
  const frag = /* glsl */ `
    varying float vLife;
    void main(){
      float d=length(gl_PointCoord-vec2(0.5));
      if(d>0.5)discard;
      float soft=smoothstep(0.5,0.1,d);
      vec3 col=mix(vec3(1.0,0.72,0.25),vec3(0.55,0.08,0.03),vLife);
      gl_FragColor=vec4(col,soft*(1.0-vLife*0.9));
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
      <shaderMaterial vertexShader={vert} fragmentShader={frag}
        uniforms={{}} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── Nozzle bell — dark metal + hot emissive ring ────────────────────────────

function Nozzle() {
  return (
    <group>
      {/* Bell shape — wide at exit, narrow at hull */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.35, 12]} />
        <meshStandardMaterial color="#2a2040" roughness={0.9} metalness={0.4} />
      </mesh>
      {/* Hot emissive ring at exit */}
      <mesh position={[0.175, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.13, 0.02, 8, 16]} />
        <meshBasicMaterial color="#ffe0a0" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function EnginePlume({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <Nozzle />
      <OuterFlame />
      <InnerCore />
      <Sparks />
    </group>
  );
}
