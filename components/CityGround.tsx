"use client";

import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Inst, { M } from './Inst';
import { env, roadMats, poolMat } from '../lib/env';
import { SPACING, EXTENT, rw, heightAt, rng, RIVER_X, light, nodeIndex, Lot, Placed } from '../lib/world';
import { roadTexture, glowTexture } from '../lib/tex';

const K = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(900, 900, 200, 200);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color(), a = new THREE.Color('#5f8f3a'), b = new THREE.Color('#7aa545'), rock = new THREE.Color('#8a857c'), bed = new THREE.Color('#8a7d5a');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z);
      p.setY(i, h);
      c.copy(a).lerp(b, Math.sin(x * 0.07) * Math.cos(z * 0.06) * 0.5 + 0.5);
      if (h > 12) c.lerp(rock, Math.min(1, (h - 12) / 20));
      if (h < -0.6) c.copy(bed);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <>
      <mesh geometry={geo} receiveShadow><meshStandardMaterial vertexColors roughness={1} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[RIVER_X, -1.1, 0]}>
        <planeGeometry args={[26, 900]} />
        <meshStandardMaterial color="#2f7396" roughness={0.12} metalness={0.25} transparent opacity={0.92} />
      </mesh>
      {/* bridge carrying the main highway over the river */}
      <group position={[RIVER_X, 0, 0]}>
        <mesh position={[0, -0.5, 0]} receiveShadow castShadow><boxGeometry args={[32, 1, 14]} /><meshStandardMaterial color="#9a9a96" roughness={0.9} /></mesh>
        {[-7.2, 7.2].map((z) => <mesh key={z} position={[0, 0.5, z]} castShadow><boxGeometry args={[32, 0.9, 0.4]} /><meshStandardMaterial color="#b4b2ab" /></mesh>)}
        {[-8, 0, 8].map((x) => [-4.5, 4.5].map((z) => <mesh key={x + '' + z} position={[x, -2.2, z]} castShadow><cylinderGeometry args={[0.9, 1.1, 4.4, 10]} /><meshStandardMaterial color="#8d8d88" /></mesh>))}
      </group>
    </>
  );
}

function Road({ axis, k, len }: { axis: 'x' | 'z'; k: number; len: number }) {
  const mat = useMemo(() => {
    const t = roadTexture(k === 0).clone();
    t.repeat.set(len / 16, 1); t.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
    roadMats.add(m);
    return m;
  }, [k, len]);
  useEffect(() => () => { roadMats.delete(mat); }, [mat]);
  const pos: [number, number, number] = axis === 'x' ? [0, 0.06, k * SPACING] : [k * SPACING, 0.04, 0];
  return (
    <group position={pos} rotation-y={axis === 'z' ? Math.PI / 2 : 0}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={mat}><planeGeometry args={[len, rw(k)]} /></mesh>
    </group>
  );
}

function Roads() {
  return (
    <>
      {K.map((k) => (
        <group key={k}>
          <Road axis="x" k={k} len={k === 0 ? 480 : 2 * EXTENT + 12} />
          <Road axis="z" k={k} len={k === 0 ? 480 : 2 * EXTENT + 12} />
        </group>
      ))}
    </>
  );
}

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 8);
const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const sphere = new THREE.SphereGeometry(1, 10, 8);

function Intersections() {
  const d = useMemo(() => {
    const patches: THREE.Matrix4[] = [], cross: THREE.Matrix4[] = [], poles: THREE.Matrix4[] = [], heads: THREE.Matrix4[] = [];
    const sig: { node: number; axis: 'x' | 'z' }[] = [];
    for (const i of K) for (const j of K) {
      const nx = i * SPACING, nz = j * SPACING, ri = rw(i), rj = rw(j);
      patches.push(M(nx, 0.08, nz, ri, 1, rj));
      for (const xs of [nx - (ri / 2 + 1.5), nx + (ri / 2 + 1.5)]) for (let zz = -rj / 2 + 0.6; zz < rj / 2; zz += 1.2) cross.push(M(xs, 0.1, nz + zz, 2, 0.02, 0.6));
      for (const zs of [nz - (rj / 2 + 1.5), nz + (rj / 2 + 1.5)]) for (let xx = -ri / 2 + 0.6; xx < ri / 2; xx += 1.2) cross.push(M(nx + xx, 0.1, zs, 0.6, 0.02, 2));
      for (const [sx, sz, axis] of [[-1, 1, 'x'], [1, -1, 'x'], [1, 1, 'z'], [-1, -1, 'z']] as const) {
        const px = nx + sx * (ri / 2 + 1.0), pz = nz + sz * (rj / 2 + 1.0);
        poles.push(M(px, 2.8, pz, 0.1, 5.6, 0.1));
        heads.push(M(px, 5.7, pz, 0.32, 0.32, 0.32));
        sig.push({ node: nodeIndex(i, j), axis });
      }
    }
    return { patches, cross, poles, heads, sig };
  }, []);
  const asphalt = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b3e43', roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), []);
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e6e6e0', roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), []);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.6 }), []);
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const cols = useMemo(() => [new THREE.Color('#2bff7a'), new THREE.Color('#ffc83a'), new THREE.Color('#ff3b30')], []);
  const initCols = useMemo(() => d.sig.map(() => cols[2]), [d, cols]);
  const acc = useRef(0);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current < 0.25 || !headRef.current) return;
    acc.current = 0;
    const m = headRef.current;
    d.sig.forEach((s, i) => m.setColorAt(i, cols[light(s.node, s.axis, clock.elapsedTime)]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <Inst geometry={plane} material={asphalt} matrices={d.patches} receive />
      <Inst geometry={box} material={white} matrices={d.cross} receive />
      <Inst geometry={cyl} material={steel} matrices={d.poles} shadow />
      <Inst ref={headRef} geometry={sphere} material={bulb} matrices={d.heads} colors={initCols} />
    </>
  );
}

function Lamps() {
  const d = useMemo(() => {
    const poles: THREE.Matrix4[] = [], heads: THREE.Matrix4[] = [], pools: THREE.Matrix4[] = [];
    for (const k of K) for (const axis of ['x', 'z'] as const) for (let c = -4; c < 4; c++) for (const off of [11, 19]) for (const s of [-1, 1]) {
      const along = c * SPACING + off, lat = k * SPACING + s * (rw(k) / 2 + 0.9);
      const at = (a: number, l: number): [number, number] => (axis === 'x' ? [a, l] : [l, a]);
      const [px, pz] = at(along, lat);
      poles.push(M(px, 3.75, pz, 0.09, 7.5, 0.09));
      const [hx, hz] = at(along, lat - s * 0.9);
      heads.push(axis === 'x' ? M(hx, 7.5, hz, 0.6, 0.18, 1.6) : M(hx, 7.5, hz, 1.6, 0.18, 0.6));
      const [qx, qz] = at(along, lat - s * 3);
      pools.push(M(qx, 0.24, qz, 13, 1, 13));
    }
    return { poles, heads, pools };
  }, []);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#59616a', roughness: 0.6 }), []);
  useMemo(() => { poolMat.map = glowTexture(); poolMat.needsUpdate = true; }, []);
  return (
    <>
      <Inst geometry={cyl} material={steel} matrices={d.poles} shadow />
      <Inst geometry={box} material={useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])} matrices={d.heads} />
      <Inst geometry={plane} material={poolMat} matrices={d.pools} />
    </>
  );
}

function LotBase({ lot, park }: { lot: Lot; park: boolean }) {
  return (
    <group position={[lot.cx, 0, lot.cz]}>
      <mesh position={[0, 0.08, 0]} receiveShadow><boxGeometry args={[lot.sx, 0.16, lot.sz]} /><meshStandardMaterial color="#b9b7b0" roughness={0.95} /></mesh>
      <mesh position={[0, 0.09, 0]} receiveShadow><boxGeometry args={[lot.sx - 4.8, 0.18, lot.sz - 4.8]} /><meshStandardMaterial color={park ? '#7aa84a' : '#6a9644'} roughness={1} /></mesh>
      {park && <Park lot={lot} />}
    </group>
  );
}

function Park({ lot }: { lot: Lot }) {
  const r = useMemo(() => rng(lot.i * 17 + lot.j * 5 + 3), [lot]);
  const pond = useMemo(() => r() < 0.45, [r]);
  return (
    <>
      <mesh position={[0, 0.2, 0]} receiveShadow><boxGeometry args={[lot.sx - 5, 0.03, 1.6]} /><meshStandardMaterial color="#cfc8b5" /></mesh>
      <mesh position={[0, 0.2, 0]} receiveShadow><boxGeometry args={[1.6, 0.03, lot.sz - 5]} /><meshStandardMaterial color="#cfc8b5" /></mesh>
      {pond && <mesh position={[4.5, 0.21, 4.5]}><cylinderGeometry args={[3.2, 3.2, 0.04, 24]} /><meshStandardMaterial color="#3a86a8" roughness={0.1} metalness={0.2} /></mesh>}
      {[-1, 1].map((s) => <mesh key={s} position={[s * 3.2, 0.5, 1.4]} castShadow><boxGeometry args={[2, 0.35, 0.6]} /><meshStandardMaterial color="#6b4a2f" /></mesh>)}
    </>
  );
}

function Trees({ placed, parks }: { placed: Placed[]; parks: Lot[] }) {
  const d = useMemo(() => {
    const r = rng(7);
    const list: { x: number; z: number; y: number; s: number; con: boolean }[] = [];
    let guard = 0;
    while (list.length < 460 && guard++ < 4000) {
      const x = (r() * 2 - 1) * 340, z = (r() * 2 - 1) * 340;
      if (Math.max(Math.abs(x), Math.abs(z)) < 138 || Math.abs(x - RIVER_X) < 16 || Math.min(Math.abs(x), Math.abs(z)) < 13) continue;
      const y = heightAt(x, z);
      list.push({ x, z, y, s: 0.8 + r() * 0.9, con: y > 5 || r() < 0.45 });
    }
    for (const p of placed) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (r() < 0.35) continue;
      list.push({ x: p.lot.cx + sx * (p.lot.sx / 2 - 2.8), z: p.lot.cz + sz * (p.lot.sz / 2 - 2.8), y: 0.15, s: 0.55 + r() * 0.25, con: r() < 0.3 });
    }
    for (const l of parks) for (let i = 0; i < 9; i++)
      list.push({ x: l.cx + (r() * 2 - 1) * (l.sx / 2 - 3), z: l.cz + (r() * 2 - 1) * (l.sz / 2 - 3), y: 0.15, s: 0.6 + r() * 0.5, con: r() < 0.4 });
    const con: THREE.Matrix4[] = [], dec: THREE.Matrix4[] = [], trunk: THREE.Matrix4[] = [];
    const cc: THREE.Color[] = [], dc: THREE.Color[] = [];
    const greens = ['#4f8a3a', '#6a9a3f', '#8aa83a', '#3f7a3a'];
    for (const t of list) {
      trunk.push(M(t.x, t.y + 1.5 * t.s, t.z, 0.28 * t.s, 3 * t.s, 0.28 * t.s));
      if (t.con) { con.push(M(t.x, t.y + (2.2 + 4) * t.s, t.z, t.s, t.s, t.s)); cc.push(new THREE.Color('#2f5d34').offsetHSL(0, 0, (r() - 0.5) * 0.06)); }
      else { dec.push(M(t.x, t.y + 4.6 * t.s, t.z, 2.6 * t.s, 2.4 * t.s, 2.6 * t.s)); dc.push(new THREE.Color(greens[Math.floor(r() * 4)])); }
    }
    return { con, dec, trunk, cc, dc };
  }, [placed, parks]);
  const g = useMemo(() => ({
    cone: new THREE.ConeGeometry(2.4, 8, 8), ico: new THREE.IcosahedronGeometry(1, 1),
    bark: new THREE.MeshStandardMaterial({ color: '#5b4330', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
  }), []);
  return (
    <>
      <Inst geometry={cyl} material={g.bark} matrices={d.trunk} />
      <Inst geometry={g.cone} material={g.leaf} matrices={d.con} colors={d.cc} shadow />
      <Inst geometry={g.ico} material={g.leaf} matrices={d.dec} colors={d.dc} shadow />
    </>
  );
}

export default function CityGround({ placed, parks, lots }: { placed: Placed[]; parks: Lot[]; lots: Lot[] }) {
  const parkSet = useMemo(() => new Set(parks.map((l) => l.i * 8 + l.j)), [parks]);
  return (
    <group>
      <Terrain />
      <Roads />
      <Intersections />
      <Lamps />
      {lots.map((l) => <LotBase key={l.i * 8 + l.j} lot={l} park={parkSet.has(l.i * 8 + l.j)} />)}
      <Trees placed={placed} parks={parks} />
    </group>
  );
}
