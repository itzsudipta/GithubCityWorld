"use client";

import * as THREE from 'three';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { env, headMat, tailMat } from '../lib/env';
import { SPACING, EXTENT, rw, rng, light, nodeIndex } from '../lib/world';

export type VType = 'car' | 'taxi' | 'bus' | 'truck' | 'service';

const glass = new THREE.MeshStandardMaterial({ color: '#1f2d38', roughness: 0.1, metalness: 0.5 });
const dark = new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.9 });
const white = new THREE.MeshStandardMaterial({ color: '#eceeef', roughness: 0.6 });
const amber = new THREE.MeshBasicMaterial({ color: '#ffb020', toneMapped: false });
const B = new THREE.BoxGeometry(1, 1, 1);
const axle = new THREE.CylinderGeometry(0.36, 0.36, 1, 10).rotateX(Math.PI / 2);
const PALETTE = ['#e8e8ea', '#2b2e33', '#a9adb3', '#b0302c', '#2d5f9a', '#d5d0c5', '#3e6b4f'];

function Part({ s, p, m, cast = true }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material; cast?: boolean }) {
  return <mesh geometry={B} material={m} scale={s} position={p} castShadow={cast} />;
}

// Model faces +x. Length ≈ real-world metres, same scale as buildings/people.
export function CarBody({ type = 'car', color = '#b0302c' }: { type?: VType; color?: string }) {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: type === 'taxi' ? '#f2c200' : type === 'bus' ? '#2f7fc1' : type === 'service' ? '#f3f4f5' : color, roughness: 0.4, metalness: 0.45 }), [type, color]);
  const L = type === 'bus' ? 11 : type === 'truck' ? 8 : type === 'service' ? 4.8 : 4.2;
  const axles = type === 'bus' ? [3.4, -3.4] : type === 'truck' ? [2.8, -0.6, -2.9] : [L * 0.32, -L * 0.32];
  const W = type === 'bus' ? 2.6 : type === 'truck' ? 2.5 : 1.8;
  return (
    <group>
      {axles.map((x) => <mesh key={x} geometry={axle} material={dark} scale={[1, 1, W * 0.98]} position={[x, 0.36, 0]} />)}
      {type === 'bus' && <>
        <Part s={[11, 2.7, 2.6]} p={[0, 1.7, 0]} m={body} />
        <Part s={[10.6, 0.9, 2.64]} p={[0, 2.2, 0]} m={glass} cast={false} />
      </>}
      {type === 'truck' && <>
        <Part s={[2.2, 2.2, 2.4]} p={[3, 1.5, 0]} m={white} />
        <Part s={[1, 0.8, 2.42]} p={[3.4, 2, 0]} m={glass} cast={false} />
        <Part s={[6.2, 3, 2.5]} p={[-1.3, 2.2, 0]} m={body.clone()} />
      </>}
      {(type === 'car' || type === 'taxi') && <>
        <Part s={[4.2, 0.8, 1.8]} p={[0, 0.7, 0]} m={body} />
        <Part s={[2.2, 0.7, 1.6]} p={[-0.2, 1.4, 0]} m={glass} />
        {type === 'taxi' && <Part s={[0.6, 0.25, 0.35]} p={[-0.2, 1.88, 0]} m={amber} cast={false} />}
      </>}
      {type === 'service' && <>
        <Part s={[4.8, 1.9, 2]} p={[0, 1.3, 0]} m={body} />
        <Part s={[4.82, 0.3, 2.02]} p={[0, 1.1, 0]} m={amber} cast={false} />
        <Part s={[1.2, 0.2, 0.5]} p={[0.8, 2.35, 0]} m={amber} cast={false} />
      </>}
      <Part s={[0.1, 0.25, W * 0.7]} p={[L / 2, type === 'bus' ? 0.9 : 0.75, 0]} m={headMat} cast={false} />
      <Part s={[0.1, 0.25, W * 0.7]} p={[-L / 2, type === 'bus' ? 0.9 : 0.75, 0]} m={tailMat} cast={false} />
    </group>
  );
}

interface V {
  type: VType; color: string; axis: 'x' | 'z'; dir: 1 | -1; line: number; pos: number; speed: number; vmax: number;
  g: THREE.Group | null; x: number; z: number; init: boolean;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default function Traffic({ total }: { total: number }) {
  const vehicles = useMemo<V[]>(() => {
    const r = rng(42);
    const out: V[] = [];
    for (let i = 0; i < total; i++) {
      const roll = r();
      const type: VType = roll < 0.08 ? 'bus' : roll < 0.2 ? 'truck' : roll < 0.3 ? 'taxi' : roll < 0.38 ? 'service' : 'car';
      for (let tries = 0; tries < 25; tries++) {
        const axis = r() < 0.5 ? 'x' : 'z';
        const line = r() < 0.3 ? 0 : Math.floor(r() * 9) - 4;
        const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
        const pos = (r() * 2 - 1) * (EXTENT - 14);
        const dn = Math.abs(((pos % SPACING) + SPACING) % SPACING - 0);
        if (Math.min(dn, SPACING - dn) < 13) continue;
        if (out.some((o) => o.axis === axis && o.line === line && o.dir === dir && Math.abs(o.pos - pos) < 12)) continue;
        out.push({ type, color: PALETTE[Math.floor(r() * PALETTE.length)], axis, dir, line, pos, speed: 0, vmax: (type === 'bus' ? 8 : 10 + r() * 3) * (line === 0 ? 1.35 : 1), g: null, x: 0, z: 0, init: false });
        break;
      }
    }
    return out;
  }, [total]);

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), t = clock.elapsedTime;
    const active = Math.round(vehicles.length * env.crowd * env.traffic * (env.weather === 'rain' ? 0.75 : 1));
    const slow = env.weather === 'rain' ? 0.8 : env.weather === 'fog' ? 0.85 : 1;
    vehicles.forEach((v, idx) => {
      if (!v.g) return;
      const on = idx < active;
      v.g.visible = on;
      if (!on) return;
      const d = v.dir;
      const m = d > 0 ? Math.ceil((v.pos + 0.01) / SPACING) * SPACING : Math.floor((v.pos - 0.01) / SPACING) * SPACING;
      const ni = v.axis === 'x' ? m / SPACING : v.line, nj = v.axis === 'x' ? v.line : m / SPACING;
      const dist = (m - v.pos) * d;
      const crossIdx = v.axis === 'x' ? ni : nj;
      const stopAt = rw(crossIdx) / 2 + 2.5;
      let vmax = v.vmax * slow * (dist < 14 ? 0.65 : 1);
      // traffic light
      if (dist > stopAt - 0.3) {
        const st = light(nodeIndex(ni, nj), v.axis, t);
        const gap = dist - stopAt;
        if (st === 2 || (st === 1 && gap > 4)) vmax = Math.min(vmax, Math.sqrt(2 * 6 * Math.max(0, gap)));
      }
      // car following
      for (const u of vehicles) {
        if (u === v || !u.g?.visible || u.axis !== v.axis || u.line !== v.line || u.dir !== v.dir) continue;
        const ahead = (u.pos - v.pos) * d;
        if (ahead > 0 && ahead < 22) vmax = Math.min(vmax, Math.sqrt(2 * 6 * Math.max(0, ahead - 6.5)) + u.speed * 0.5);
      }
      v.speed = vmax < v.speed ? Math.max(vmax, v.speed - 12 * dt) : Math.min(vmax, v.speed + 3.5 * dt);
      v.pos += d * v.speed * dt;

      // reached the junction: go straight / turn
      if ((m - v.pos) * d <= 0) {
        const opts: { w: number; axis: 'x' | 'z'; dir: 1 | -1; turn: boolean }[] = [];
        const along = (v.axis === 'x' ? ni : nj) + d;
        if (Math.abs(along) <= 4) opts.push({ w: 0.6, axis: v.axis, dir: d, turn: false });
        const across = v.axis === 'x' ? nj : ni;
        const other = v.axis === 'x' ? 'z' : 'x';
        const right: 1 | -1 = v.axis === 'x' ? d : ((-d) as 1 | -1), left: 1 | -1 = (-right) as 1 | -1;
        if (Math.abs(across + right) <= 4) opts.push({ w: 0.2, axis: other, dir: right, turn: true });
        if (Math.abs(across + left) <= 4) opts.push({ w: 0.2, axis: other, dir: left, turn: true });
        if (opts.length === 0) {
          // At the outermost road, there is no valid next junction. Turn around
          // instead of dereferencing an empty route list.
          v.dir = (-d) as 1 | -1;
          v.pos = m;
        } else {
          let pick = Math.random() * opts.reduce((a, o) => a + o.w, 0);
          const o = opts.find((q) => (pick -= q.w) <= 0) || opts[opts.length - 1];
          if (o.turn) {
            const oldAxis = v.axis;
            v.axis = o.axis; v.dir = o.dir;
            v.line = oldAxis === 'x' ? ni : nj;
            v.pos = oldAxis === 'x' ? nj * SPACING : ni * SPACING;
          }
        }
      }

      // render (lane offset, right-hand traffic, smoothed through corners)
      const off = rw(v.line) / 4;
      const tx = v.axis === 'x' ? v.pos : v.line * SPACING - v.dir * off;
      const tz = v.axis === 'x' ? v.line * SPACING + v.dir * off : v.pos;
      if (!v.init) { v.x = tx; v.z = tz; v.g.rotation.y = v.axis === 'x' ? (v.dir > 0 ? 0 : Math.PI) : -v.dir * Math.PI / 2; v.init = true; }
      const k = 1 - Math.exp(-9 * dt);
      v.x += (tx - v.x) * k; v.z += (tz - v.z) * k;
      v.g.position.set(v.x, 0.08, v.z);
      const target = v.axis === 'x' ? (v.dir > 0 ? 0 : Math.PI) : (-v.dir * Math.PI) / 2;
      v.g.rotation.y += wrapAngle(target - v.g.rotation.y) * (1 - Math.exp(-6 * dt));
    });
  });

  return (
    <group>
      {vehicles.map((v, i) => (
        <group key={i} ref={(g) => { v.g = g; }}><CarBody type={v.type} color={v.color} /></group>
      ))}
    </group>
  );
}
