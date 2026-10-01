"use client";

import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Construction from './Construction';
import { CarBody } from './Vehicles';
import { facadeTex, emissiveTex, signTexture, Style } from '../lib/tex';
import { windowMats, signMats } from '../lib/env';
import { Placed, rng, classify, EventType, isRecentlyPushed } from '../lib/world';

export interface Commit { msg: string; t: number }

export function spec(p: Placed) {
  const r = rng(p.repo.id);
  const cap = Math.min(p.lot.sx - 6, 17), capD = Math.min(p.lot.sz - 8, 14);
  let w = 10, d = 9, f = 3;
  switch (p.kind) {
    case 'startup': w = 9; d = 8; f = 2 + (r() < 0.5 ? 1 : 0); break;
    case 'office': w = 13; d = 10; f = 5 + Math.floor(r() * 3); break;
    case 'lab': w = p.level >= 3 ? 17 : 14; d = p.level >= 3 ? 12 : 10; f = 3; break;
    case 'data': w = 16; d = 11; f = p.level >= 3 ? 3 : 2; break;
    case 'campus': w = 17; d = 13; f = 5; break;
    case 'hq': w = 16; d = 13; f = 3; break;
  }
  w = Math.min(w, cap); d = Math.min(d, capD);
  const tower = p.kind === 'hq' ? 13 + Math.floor(r() * 5) : 0;
  const h = (p.kind === 'hq' ? 3 + tower : f) * 3.6;
  return { w, d, f, h, tower, bz: p.lot.sz / 2 - 5.5 - d / 2 };
}

interface BlkProps { w: number; h: number; d: number; x?: number; y?: number; z?: number; style: Style; lit: number; tint: string; roof?: string; seed?: number }
function Blk({ w, h, d, x = 0, y = 0, z = 0, style, lit, tint, roof = '#868b90', seed = 0 }: BlkProps) {
  const floors = Math.max(1, Math.round(h / 3.6));
  const mats = useMemo(() => {
    const mk = (dim: number) => {
      const m = facadeTex(style).clone(), e = emissiveTex(style, lit).clone();
      for (const t of [m, e]) { t.repeat.set(dim / 16, floors / 4); t.offset.set((seed * 0.37) % 1, 0); t.needsUpdate = true; }
      const mat = new THREE.MeshStandardMaterial({
        map: m, emissiveMap: e, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0,
        roughness: style === 'glass' ? 0.25 : 0.7, metalness: style === 'glass' ? 0.35 : 0.05, color: tint,
      });
      windowMats.add(mat);
      return mat;
    };
    const sd = mk(d), sw = mk(w), rf = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.9 });
    return [sd, sd, rf, rf, sw, sw];
  }, [w, h, d, style, lit, tint, floors, seed, roof]);
  useEffect(() => () => { mats.forEach((m) => windowMats.delete(m as THREE.MeshStandardMaterial)); }, [mats]);
  return (
    <mesh position={[x, y + h / 2, z]} castShadow receiveShadow material={mats}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

const metal = new THREE.MeshStandardMaterial({ color: '#b4babf', roughness: 0.5, metalness: 0.5 });
const whiteMat = new THREE.MeshStandardMaterial({ color: '#f0f2f3', roughness: 0.3, metalness: 0.2 });
const glassMat = new THREE.MeshStandardMaterial({ color: '#8fc3e0', roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.55 });

function RoofUnits({ w, d, y, seed }: { w: number; d: number; y: number; seed: number }) {
  const r = useMemo(() => rng(seed), [seed]);
  const items = useMemo(() => Array.from({ length: 3 }, () => ({ x: (r() - 0.5) * (w - 4), z: (r() - 0.5) * (d - 4), s: 1 + r() * 1.2 })), [r, w, d]);
  return <>{items.map((u, i) => <mesh key={i} position={[u.x, y + 0.5 * u.s, u.z]} castShadow><boxGeometry args={[1.4 * u.s, u.s, 1.4 * u.s]} /><meshStandardMaterial color="#9aa0a6" roughness={0.7} /></mesh>)}</>;
}

interface Props {
  p: Placed; commits: Commit[]; isNew: boolean;
  onSelect: (id: number) => void; onFocus: (p: Placed) => void;
}

export default function Building({ p, commits, isNew, onSelect, onFocus }: Props) {
  const { w, d, f, h, tower, bz } = useMemo(() => spec(p), [p]);
  const { lot, kind, repo } = p;
  const rise = useRef<THREE.Group>(null!);
  const born = useRef(performance.now());

  const lit = repo.archived ? 0.08 : 0.12 + p.activity * 0.8;
  const old = repo.archived;
  const tint = old ? '#9a8f84' : '#ffffff';
  const seed = repo.id % 97;
  const now = Date.now();
  const recent = commits.filter((c) => now - c.t < 10 * 864e5);
  const types = useMemo(() => Array.from(new Set(recent.map((c) => classify(c.msg)))).filter((t) => t !== 'generic') as EventType[], [commits]); // eslint-disable-line
  const active = isNew || isRecentlyPushed(repo) || (commits[0] ? now - commits[0].t < 36 * 36e5 : false);

  const sign = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: signTexture(repo.name, p.color), toneMapped: false });
    signMats.add(m);
    return m;
  }, [repo.name, p.color]);
  useEffect(() => () => { signMats.delete(sign); }, [sign]);

  useFrame(() => {
    if (isNew && rise.current) {
      const k = Math.min(1, (performance.now() - born.current) / 5000);
      rise.current.scale.y = Math.max(0.02, k * k * (3 - 2 * k));
    }
  });

  const accent = p.color;
  const parked = Math.min(4, 1 + Math.floor(p.activity * 4));
  const fx0 = -lot.sx / 2 + 11, fw = lot.sx - 13.6;
  const style: Style = old ? 'concrete' : kind === 'startup' ? 'brick' : kind === 'data' ? 'louver' : kind === 'lab' ? 'concrete' : 'glass';
  const H = h + 2;

  return (
    <group
      position={[lot.cx, 0.16, lot.cz]} rotation-y={p.rot}
      onClick={(e) => { e.stopPropagation(); if (e.delta < 5) onSelect(repo.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); onFocus(p); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {/* forecourt with parked cars */}
      <mesh position={[fx0 + fw / 2, 0.06, lot.sz / 2 - 4.1]} receiveShadow><boxGeometry args={[fw, 0.12, 3.3]} /><meshStandardMaterial color="#34373b" roughness={0.95} /></mesh>
      {Array.from({ length: parked }, (_, i) => (
        <group key={i} position={[fx0 + 2.8 + i * 5.2, 0.12, lot.sz / 2 - 4.1]}>
          <CarBody type="car" color={['#e8e8ea', '#2b2e33', '#b0302c', '#2d5f9a', '#a9adb3'][(seed + i) % 5]} />
        </group>
      ))}
      {/* monument sign */}
      <group position={[-lot.sx / 2 + 5.2, 0, lot.sz / 2 - 2.7]}>
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[4.4, 1, 0.5]} /><meshStandardMaterial color="#2b3238" roughness={0.6} /></mesh>
        <mesh position={[0, 0.62, 0.26]} material={sign}><planeGeometry args={[4.1, 0.95]} /></mesh>
      </group>
      <group position={[0, 0, bz]}>
        <group ref={rise}>
          {kind === 'startup' && <>
            <Blk w={w} h={h} d={d} style={style} lit={lit} tint={tint} seed={seed} />
            <mesh position={[0, 3, d / 2 + 0.9]} castShadow><boxGeometry args={[w * 0.7, 0.22, 2]} /><meshStandardMaterial color={accent} roughness={0.5} /></mesh>
            <RoofUnits w={w} d={d} y={h} seed={seed} />
          </>}
          {kind === 'office' && <>
            <Blk w={w} h={h} d={d} style={style} lit={lit} tint={tint} seed={seed} />
            <Blk w={w * 0.7} h={Math.max(2, Math.floor(f / 2)) * 3.6} d={d * 0.7} y={h} style={style} lit={lit} tint={tint} seed={seed + 3} />
            <RoofUnits w={w} d={d} y={h + Math.max(2, Math.floor(f / 2)) * 3.6} seed={seed} />
            <mesh position={[0, h * 0.35, d / 2 + 0.05]}><boxGeometry args={[w, 0.35, 0.12]} /><meshStandardMaterial color={accent} roughness={0.4} metalness={0.4} /></mesh>
          </>}
          {kind === 'lab' && <>
            <Blk w={w} h={h} d={d} style={style} lit={lit} tint={tint} seed={seed} roof="#c9cdd0" />
            <Blk w={w * 0.4} h={7.2} d={d * 0.6} x={-w * 0.25} y={h} style="glass" lit={lit} tint={tint} seed={seed + 5} />
            <mesh position={[w * 0.22, h, 0]} material={whiteMat} castShadow><sphereGeometry args={[Math.min(w, d) * 0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
            <mesh position={[w * 0.3, h + 1, d * 0.3]} rotation-x={-0.7} material={metal}><cylinderGeometry args={[0.1, 1.1, 1.4, 14]} /></mesh>
            <mesh position={[0, 0.2 + h * 0.5, d / 2 + 0.05]}><boxGeometry args={[w, 0.25, 0.1]} /><meshStandardMaterial color={accent} /></mesh>
          </>}
          {kind === 'data' && <>
            <Blk w={w} h={h} d={d} style={style} lit={lit} tint={tint} seed={seed} />
            {[-1, 0, 1].map((i) => <mesh key={i} position={[i * (w / 3.4), h + 0.7, -d * 0.15]} castShadow><boxGeometry args={[2.6, 1.4, 3.4]} /><meshStandardMaterial color="#b4b9be" roughness={0.6} /></mesh>)}
            {[-1, 1].map((i) => <mesh key={i} position={[i * (w / 4), h + 2, d * 0.2]} material={metal} castShadow><cylinderGeometry args={[1.1, 1.3, 1.6, 16]} /></mesh>)}
            <mesh position={[0, 1.4, d / 2 + 0.05]}><boxGeometry args={[w, 0.2, 0.1]} /><meshStandardMaterial color={accent} /></mesh>
          </>}
          {kind === 'campus' && <>
            <Blk w={w} h={5 * 3.6} d={7} z={-d / 2 + 3.5} style={style} lit={lit} tint={tint} seed={seed} />
            {[-1, 1].map((s) => <Blk key={s} w={6} h={4 * 3.6} d={d - 7} x={s * (w / 2 - 3)} z={3.5} style={style} lit={lit} tint={tint} seed={seed + s * 2 + 4} />)}
            <mesh position={[0, 0.12, 3.5]} receiveShadow><boxGeometry args={[w - 12, 0.24, d - 7]} /><meshStandardMaterial color="#6f9d48" /></mesh>
            <mesh position={[0, 7, d / 2 - 1]} material={glassMat}><boxGeometry args={[w - 6, 2.2, 2]} /></mesh>
            <mesh position={[0, 0.9, 3]} castShadow><sphereGeometry args={[1.5, 10, 8]} /><meshStandardMaterial color="#5f8f3a" /></mesh>
          </>}
          {kind === 'hq' && <>
            <Blk w={w} h={3 * 3.6} d={d} style="glass" lit={lit} tint={tint} seed={seed} />
            <Blk w={w * 0.55} h={tower * 3.6} d={d * 0.6} x={-w * 0.12} y={3 * 3.6} z={-d * 0.08} style="glass" lit={lit} tint={tint} seed={seed + 7} roof="#6b7077" />
            <mesh position={[-w * 0.12, h + 0.25, -d * 0.08]}><boxGeometry args={[w * 0.55 + 0.4, 0.5, d * 0.6 + 0.4]} /><meshStandardMaterial color={accent} roughness={0.4} metalness={0.4} /></mesh>
            <mesh position={[w * 0.28, 3 * 3.6 + 0.06, d * 0.2]}><cylinderGeometry args={[2.4, 2.4, 0.12, 24]} /><meshStandardMaterial color="#2c3136" /></mesh>
            <mesh position={[w * 0.28, 3 * 3.6 + 0.14, d * 0.2]}><torusGeometry args={[1.7, 0.1, 6, 24]} /><meshStandardMaterial color="#f5c542" /></mesh>
          </>}
          {old && <mesh position={[0, 0.9, d / 2 + 1]}><boxGeometry args={[w, 1.8, 0.05]} /><meshStandardMaterial color="#555" transparent opacity={0.5} wireframe /></mesh>}
        </group>
        <Construction w={w} d={d} h={h} sx={lot.sx} color={accent} active={active} types={types} seed={seed} />
      </group>
    </group>
  );
}
