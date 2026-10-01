"use client";

import * as THREE from 'three';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { env } from '../lib/env';
import { SPACING, EXTENT, rw, rng, light, nodeIndex, doorOf, Placed } from '../lib/world';

const leg = new THREE.BoxGeometry(0.16, 0.75, 0.16).translate(0, -0.375, 0);
const torso = new THREE.BoxGeometry(0.46, 0.66, 0.28);
const head = new THREE.SphereGeometry(0.14, 10, 8);
const bag = new THREE.BoxGeometry(0.32, 0.36, 0.12);
const hatG = new THREE.CylinderGeometry(0.17, 0.19, 0.12, 10);
const pants = new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.9 });
const skins = ['#f0c8a0', '#d9a577', '#b57c52', '#8a5a3b'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
const hatMat = new THREE.MeshStandardMaterial({ color: '#ffd21f', roughness: 0.5 });

// Children order matters: [torso, head, legL, legR, bag, (hat)] — animated by index.
export function PersonModel({ color, hat = false, skin = 0 }: { color: string; hat?: boolean; skin?: number }) {
  const shirt = useMemo(() => new THREE.MeshStandardMaterial({ color: hat ? '#ff7a1a' : color, roughness: 0.8 }), [color, hat]);
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }), [color]);
  return (
    <>
      <mesh geometry={torso} material={shirt} position={[0, 1.1, 0]} castShadow />
      <mesh geometry={head} material={skins[skin % 4]} position={[0, 1.57, 0]} castShadow />
      <mesh geometry={leg} material={pants} position={[-0.12, 0.75, 0]} castShadow />
      <mesh geometry={leg} material={pants} position={[0.12, 0.75, 0]} castShadow />
      <mesh geometry={bag} material={accent} position={[0, 1.15, -0.2]} castShadow />
      {hat && <mesh geometry={hatG} material={hatMat} position={[0, 1.7, 0]} />}
    </>
  );
}

export const swing = (g: THREE.Object3D, phase: number, amp = 0.6) => {
  g.children[2].rotation.x = Math.sin(phase) * amp;
  g.children[3].rotation.x = -Math.sin(phase) * amp;
};

interface W {
  axis: 'x' | 'z'; dir: 1 | -1; line: number; pos: number; side: 1 | -1; speed: number; home: number;
  state: 'walk' | 'enter' | 'inside'; timer: number; ph: number; g: THREE.Group | null; init: boolean; skin: number;
}

export default function People({ placed }: { placed: Placed[] }) {
  const total = Math.min(96, 16 + Math.round(placed.reduce((a, p) => a + p.activity, 0) * 3.5));
  const walkers = useMemo<W[]>(() => {
    if (!placed.length) return [];
    const r = rng(99);
    const wts = placed.map((p) => 0.2 + p.activity), sum = wts.reduce((a, b) => a + b, 0);
    return Array.from({ length: total }, () => {
      let x = r() * sum, home = 0;
      while (home < wts.length - 1 && (x -= wts[home]) > 0) home++;
      return {
        axis: r() < 0.5 ? 'x' : 'z', dir: r() < 0.5 ? 1 : -1, line: Math.floor(r() * 9) - 4, pos: (r() * 2 - 1) * (EXTENT - 5),
        side: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.5, home, state: 'walk', timer: 0, ph: r() * 6, g: null, init: false, skin: Math.floor(r() * 4),
      } as W;
    });
  }, [placed.length, total]); // eslint-disable-line

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05), t = clock.elapsedTime;
    const active = Math.round(walkers.length * env.crowd * (env.weather === 'rain' ? 0.45 : 1));
    walkers.forEach((w, idx) => {
      const g = w.g; if (!g) return;
      if (idx >= active) { g.visible = false; return; }
      const door = doorOf(placed[w.home]);
      if (w.state === 'inside') {
        w.timer -= dt;
        if (w.timer <= 0) {
          w.state = 'walk'; g.visible = true;
          w.axis = 'x'; w.line = Math.max(-4, Math.min(4, Math.round(door.z / SPACING)));
          w.pos = door.x; w.dir = Math.random() < 0.5 ? 1 : -1; w.side = door.z > w.line * SPACING ? 1 : -1;
        }
        return;
      }
      g.visible = true;
      if (w.state === 'enter') {
        const dx = door.x - g.position.x, dz = door.z - g.position.z, L = Math.hypot(dx, dz);
        if (L < 0.5) { w.state = 'inside'; w.timer = 4 + Math.random() * 9; g.visible = false; return; }
        g.position.x += (dx / L) * 1.7 * dt; g.position.z += (dz / L) * 1.7 * dt;
        g.rotation.y = Math.atan2(dx, dz); w.ph += dt * 10; swing(g, w.ph);
        return;
      }
      // walking along a sidewalk
      const d = w.dir;
      const m = d > 0 ? Math.ceil((w.pos + 0.01) / SPACING) * SPACING : Math.floor((w.pos - 0.01) / SPACING) * SPACING;
      const ni = w.axis === 'x' ? m / SPACING : w.line, nj = w.axis === 'x' ? w.line : m / SPACING;
      const crossIdx = w.axis === 'x' ? ni : nj;
      const gap = (m - w.pos) * d - (rw(crossIdx) / 2 + 2.8);
      let speed = w.speed * (env.weather === 'rain' ? 1.25 : 1);
      // wait at kerb while cross traffic has green/yellow
      if (gap > -0.2 && gap < 0.3 && light(nodeIndex(ni, nj), w.axis === 'x' ? 'z' : 'x', t) !== 2) speed = 0;
      w.pos += d * speed * dt;
      if ((m - w.pos) * d <= 0) {
        const straight = Math.abs((w.axis === 'x' ? ni : nj) + d) <= 4;
        if (!straight || Math.random() < 0.3) {
          const oldAxis = w.axis;
          const nd: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          const across = oldAxis === 'x' ? nj : ni;
          w.dir = Math.abs(across + nd) <= 4 ? nd : ((-nd) as 1 | -1);
          w.axis = oldAxis === 'x' ? 'z' : 'x';
          w.line = oldAxis === 'x' ? ni : nj;
          w.pos = (oldAxis === 'x' ? nj : ni) * SPACING;
          w.side = Math.random() < 0.5 ? 1 : -1;
        }
      }
      // sometimes pop into the home building when passing near it
      if (Math.random() < dt * 0.05 && Math.hypot(g.position.x - door.x, g.position.z - door.z) < 14) w.state = 'enter';

      const off = w.side * (rw(w.line) / 2 + 1.3);
      const tx = w.axis === 'x' ? w.pos : w.line * SPACING + off, tz = w.axis === 'x' ? w.line * SPACING + off : w.pos;
      if (!w.init) { g.position.set(tx, 0.16, tz); w.init = true; }
      const k = 1 - Math.exp(-3 * dt);
      g.position.x += (tx - g.position.x) * k; g.position.z += (tz - g.position.z) * k; g.position.y = 0.16;
      const face = w.axis === 'x' ? d * Math.PI / 2 : d > 0 ? 0 : Math.PI;
      g.rotation.y += Math.atan2(Math.sin(face - g.rotation.y), Math.cos(face - g.rotation.y)) * (1 - Math.exp(-6 * dt));
      w.ph += dt * speed * 6; swing(g, w.ph, speed > 0 ? 0.6 : 0);
    });
  });

  return (
    <group>
      {walkers.map((w, i) => (
        <group key={i} ref={(g) => { w.g = g; }}><PersonModel color={placed[w.home].color} skin={w.skin} /></group>
      ))}
    </group>
  );
}
