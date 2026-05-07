import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** Day 64e — shared ocean scene used by both the body atmosphere
 *  (subtle, no painterly post) and the empty state (with painterly
 *  Kuwahara + paper grain post-processing).
 *
 *  Composition:
 *    - HorizonPlane: full-viewport vertex-coloured gradient. Sky
 *      occupies the top 60% with a soft coral hint at the horizon
 *      line (60% from top); twilight ocean blue → deep ocean blue
 *      below it.
 *    - 4 painterly clouds drifting horizontally at varied speeds.
 *    - 2 pale fish silhouettes drifting underwater with a gentle
 *      vertical bob.
 *
 *  Camera convention: same as the cosmic scene — perspective FOV 50,
 *  position [0,0,12]. World extends ~ ±20 horizontally, ±12 vertically
 *  at the camera's depth. */

export function HorizonPlane() {
  const geo = useMemo(() => {
    const W = 120;
    const H = 70;
    const g = new THREE.PlaneGeometry(W, H, 1, 4);
    const posAttr = g.attributes.position!;
    const colors = new Float32Array(posAttr.count * 3);
    const SKY        = new THREE.Color("#A8C7D6");
    const SKY_LOW    = new THREE.Color("#E8C8B0");
    const CORAL      = new THREE.Color("#D9886B");
    const WATER_HIGH = new THREE.Color("#4A6878");
    const WATER_DEEP = new THREE.Color("#1F3A4A");
    const rowColors = [SKY, SKY_LOW, CORAL, WATER_HIGH, WATER_DEEP];
    for (let i = 0; i < posAttr.count; i++) {
      const row = Math.floor(i / 2);
      const c = rowColors[row] ?? WATER_DEEP;
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);
  return (
    <mesh position={[0, 0, -25]} geometry={geo}>
      <meshBasicMaterial vertexColors transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

function makeCloudTexture() {
  const SIZE = 64;
  const c = document.createElement("canvas");
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.7)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

export function Cloud({
  startX,
  y,
  scaleX,
  scaleY,
  speed,
  tone,
}: {
  startX: number;
  y: number;
  scaleX: number;
  scaleY: number;
  speed: number;
  tone: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => makeCloudTexture(), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const wrapWidth = 70;
    ref.current.position.x = ((startX + t * speed) % wrapWidth) - wrapWidth / 2;
  });
  return (
    <mesh ref={ref} position={[startX, y, -18]} scale={[scaleX, scaleY, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} color={tone} transparent depthWrite={false} opacity={0.85} />
    </mesh>
  );
}

export function Fish({
  startX,
  y,
  speed,
  scale,
  tone,
}: {
  startX: number;
  y: number;
  speed: number;
  scale: number;
  tone: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const wrap = 60;
    ref.current.position.x = ((startX + t * speed) % wrap) - wrap / 2;
    ref.current.position.y = y + Math.sin(t * 0.4 + startX) * 0.25;
  });
  return (
    <group ref={ref} position={[startX, y, -16]} scale={scale}>
      <mesh>
        <circleGeometry args={[0.55, 16]} />
        <meshBasicMaterial color={tone} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[-0.6, 0, 0]}>
        <circleGeometry args={[0.22, 3]} />
        <meshBasicMaterial color={tone} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function OceanScene() {
  return (
    <>
      <HorizonPlane />
      <Cloud startX={-20} y={6}    scaleX={14} scaleY={3.2} speed={0.35} tone="#FBF2DE" />
      <Cloud startX={5}   y={9}    scaleX={10} scaleY={2.6} speed={0.5}  tone="#F0E8D6" />
      <Cloud startX={20}  y={4.5}  scaleX={12} scaleY={2.8} speed={0.25} tone="#FBF2DE" />
      <Cloud startX={-8}  y={11}   scaleX={9}  scaleY={2}   speed={0.4}  tone="#FFFFFF" />
      <Fish startX={-12} y={-6.5} speed={0.4} scale={1.6} tone="#A8C7D6" />
      <Fish startX={8}   y={-9}   speed={0.6} scale={1.2} tone="#C8DCE8" />
    </>
  );
}
