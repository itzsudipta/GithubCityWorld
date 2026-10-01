"use client";

import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PersonModel, swing } from './People';
import { CarBody } from './Vehicles';
import { barrierTexture } from '../lib/tex';
import { EventType } from '../lib/world';

const yellow = new THREE.MeshStandardMaterial({ color: '#f1b700', roughness: 0.5, metalness: 0.3 });
const steel = new THREE.MeshStandardMaterial({ color: '#8d99a3', roughness: 0.5, metalness: 0.6 });
const grey = new THREE.MeshStandardMaterial({ color: '#7d8288', roughness: 0.9 });
const pallet = new THREE.MeshStandardMaterial({ color: '#b79b6b', roughness: 0.9 });
const cone = new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.7 });
const net = new THREE.MeshBasicMaterial({ color: '#6fa56f', transparent: true, opacity: 0.22, side: THREE.DoubleSide });
const scafMat = new THREE.LineBasicMaterial({ color: '#aeb5bb' });
const white = new THREE.MeshStandardMaterial({ color: '#f1f3f4', roughness: 0.3, metalness: 0.2 });
const B = new THREE.BoxGeometry(1, 1, 1);

function scaffoldGeo(A: number, H: number) {
  const p: number[] = [];
  for (let x = -A / 2; x <= A / 2 + 0.01; x += 2.4) p.push(x, 0, 0, x, H, 0);
  for (let y = 0; y <= H + 0.01; y += 2) p.push(-A / 2, y, 0, A / 2, y, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

function Worker({ x0, x1, z, phase, color }: { x0: number; x1: number; z: number; phase: number; color: string }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const s = clock.elapsedTime * 0.35 + phase;
    g.current.position.x = x0 + (x1 - x0) * (Math.sin(s) * 0.5 + 0.5);
    g.current.rotation.y = Math.cos(s) * (x1 - x0) > 0 ? Math.PI / 2 : -Math.PI / 2;
    swing(g.current, clock.elapsedTime * 7 + phase);
  });
  return <group ref={g} position={[x0, 0.16, z]}><PersonModel color={color} hat skin={Math.floor(phase) % 4} /></group>;
}

interface Props { w: number; d: number; h: number; sx: number; color: string; active: boolean; types: EventType[]; seed: number; }

export default function Construction({ w, d, h, sx, color, active, types, seed }: Props) {
  const jib = useRef<THREE.Group>(null!);
  const blink = useRef<THREE.MeshBasicMaterial>(null!);
  const hh = Math.max(h, 12);
  const side = useMemo(() => scaffoldGeo(d, Math.min(h, 16)), [d, h]);
  const front = useMemo(() => scaffoldGeo(w, Math.min(h, 16)), [w, h]);
  const barrier = useMemo(() => {
    const t = barrierTexture().clone(); t.repeat.set(w / 2, 1); t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
  }, [w]);
  const ml = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7de3ff', toneMapped: false }), []);
  useFrame(({ clock }) => {
    if (jib.current) jib.current.rotation.y = seed + Math.sin(clock.elapsedTime * 0.25 + seed) * 1.1;
    if (blink.current) blink.current.color.setRGB(Math.sin(clock.elapsedTime * 4) > 0 ? 1.6 : 0.2, 0.05, 0.05);
  });
  const has = (t: EventType) => types.includes(t);
  const uiCount = Math.max(3, Math.floor(w / 1.6));

  return (
    <group>
      {active && (
        <>
          {/* tower crane */}
          <group position={[-w / 2 - 1.2, 0, -d / 2 + 1]}>
            <mesh geometry={B} material={yellow} scale={[0.9, hh + 9, 0.9]} position={[0, (hh + 9) / 2, 0]} castShadow />
            <group ref={jib} position={[0, hh + 9, 0]}>
              <mesh geometry={B} material={yellow} scale={[24, 0.6, 0.8]} position={[7, 0, 0]} castShadow />
              <mesh geometry={B} material={grey} scale={[3, 1.4, 1.4]} position={[-5.5, 0, 0]} castShadow />
              <mesh geometry={B} material={yellow} scale={[1.2, 1.2, 1.2]} position={[0, -1, 0]} />
              <mesh geometry={B} material={steel} scale={[0.1, 6, 0.1]} position={[12, -3.5, 0]} />
              <mesh geometry={B} material={grey} scale={[0.6, 0.5, 0.6]} position={[12, -6.5, 0]} />
              <mesh position={[0, 1, 0]}><sphereGeometry args={[0.25]} /><meshBasicMaterial ref={blink} toneMapped={false} /></mesh>
            </group>
          </group>
          {/* scaffolding with netting */}
          <lineSegments geometry={side} material={scafMat} position={[w / 2 + 0.5, 0, 0]} rotation-y={Math.PI / 2} />
          <mesh material={net} position={[w / 2 + 0.5, Math.min(h, 16) / 2, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[d, Math.min(h, 16)]} /></mesh>
          <lineSegments geometry={front} material={scafMat} position={[0, 0, d / 2 + 0.5]} />
          <mesh material={net} position={[0, Math.min(h, 16) / 2, d / 2 + 0.5]}><planeGeometry args={[w, Math.min(h, 16)]} /></mesh>
          {/* barriers, cones, materials */}
          <mesh geometry={B} material={barrier} scale={[w, 0.9, 0.15]} position={[0, 0.6, d / 2 + 1.9]} />
          {[-1, 1].map((s) => <mesh key={s} material={cone} position={[s * (w / 2 + 0.4), 0.45, d / 2 + 1.9]}><coneGeometry args={[0.28, 0.8, 8]} /></mesh>)}
          <mesh geometry={B} material={pallet} scale={[1.6, 1.1, 1.6]} position={[w / 2 - 1.5, 0.7, d / 2 + 2.9]} castShadow />
          <mesh geometry={B} material={pallet} scale={[1.6, 0.8, 1.6]} position={[w / 2 - 3.3, 0.55, d / 2 + 2.9]} castShadow />
          {[0, 1, 2].map((i) => <mesh key={i} material={grey} position={[-w / 2 + 1.5, 0.45 + (i > 1 ? 0.6 : 0), d / 2 + 2.9 + (i % 2) * 0.6]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.25, 0.25, 3, 8]} /></mesh>)}
          <group position={[-w / 2 + 4, 0.16, d / 2 + 4.6]} scale={0.75}><CarBody type="truck" color="#e8e8ea" /></group>
          {/* the language's developer on site + crew */}
          <Worker x0={-w / 2 + 1} x1={w / 2 - 1} z={d / 2 + 1.2} phase={seed} color={color} />
          <Worker x0={-w / 2 + 2} x1={w / 4} z={d / 2 + 1.2} phase={seed + 2} color={color} />
          <Worker x0={0} x1={w / 2 - 2} z={d / 2 + 1.2} phase={seed + 4} color={color} />
        </>
      )}

      {/* completed upgrades, one per recent commit theme */}
      {has('api') && (
        <group position={[w / 2 - 1.5, h, -d / 2 + 1.5]}>
          <mesh geometry={B} material={steel} scale={[0.4, 7, 0.4]} position={[0, 3.5, 0]} castShadow />
          {[1, -1].map((s) => <mesh key={s} material={white} position={[s * 0.6, 5.6, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.55, 0.55, 0.15, 14]} /></mesh>)}
          <mesh position={[0, 7.2, 0]}><sphereGeometry args={[0.22]} /><meshBasicMaterial color="#ff2a2a" toneMapped={false} /></mesh>
        </group>
      )}
      {has('database') && [0, 1, 2].map((i) => (
        <mesh key={i} material={steel} position={[-w / 2 + 2.2 + i * 3.4, h + 1.5, 0]} castShadow><cylinderGeometry args={[1.3, 1.3, 3, 16]} /></mesh>
      ))}
      {has('ui') && Array.from({ length: uiCount }, (_, i) => (
        <mesh key={i} position={[-w / 2 + 0.8 + (i * (w - 1.6)) / (uiCount - 1), Math.min(h, 12) * 0.5, d / 2 + 0.4]} castShadow>
          <boxGeometry args={[0.22, Math.min(h, 12) * 0.9, 0.5]} /><meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {has('auth') && (
        <group position={[w / 2 - 0.5, 0.16, d / 2 + 2.4]}>
          <mesh geometry={B} material={grey} scale={[2.6, 3, 2.6]} position={[0, 1.5, 0]} castShadow />
          <mesh geometry={B} material={barrier} scale={[3.6, 0.2, 0.2]} position={[-3.2, 1.2, 0]} />
          <mesh position={[0, 3.6, 0]}><boxGeometry args={[0.9, 1.1, 0.12]} /><meshBasicMaterial color="#35e08a" toneMapped={false} /></mesh>
        </group>
      )}
      {has('ml') && (
        <group position={[0, h, 0]}>
          <mesh material={white} castShadow><sphereGeometry args={[Math.min(w, d) * 0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
          <mesh material={ml} position={[0, 0.2, 0]} rotation-x={Math.PI / 2}><torusGeometry args={[Math.min(w, d) * 0.28, 0.12, 8, 32]} /></mesh>
        </group>
      )}
      {has('payment') && (
        <group position={[-w / 2 + 2.5, 0.16, d / 2 + 2.6]}>
          <mesh geometry={B} material={grey} scale={[2.2, 3, 2.2]} position={[0, 1.5, 0]} castShadow />
          <mesh position={[0, 3.2, 0]} castShadow><boxGeometry args={[3.2, 0.25, 3.2]} /><meshStandardMaterial color="#d4a017" metalness={0.6} roughness={0.35} /></mesh>
          <mesh position={[0, 2.3, 1.12]}><boxGeometry args={[1.4, 0.5, 0.1]} /><meshBasicMaterial color="#ffd24a" toneMapped={false} /></mesh>
        </group>
      )}
    </group>
  );
}
